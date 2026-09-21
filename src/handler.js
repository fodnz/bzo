import { watch } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import config from "./config/config.js";
import { logger } from "./config/logger.js";

const pluginsPath = fileURLToPath(new URL("./plugins/", import.meta.url));
const reloadDelayMs = 250;

const getText = message =>
    message?.conversation ??
    message?.extendedTextMessage?.text ??
    "";

const getSender = event => {
    const jid =
        event.key?.participantAlt ??
        event.key?.participant ??
        event.key?.remoteJidAlt ??
        event.key?.remoteJid;

    return jid?.split("@")[0]?.split(":")[0] ?? "";
};

const getOwner = () => String(config.owner ?? "").replace(/\D/g, "");

const validatePlugin = (handler, fileName) => {
    if (typeof handler !== "function") {
        throw new TypeError(
            `Invalid plugin: ${fileName}. Default export must be a function.`
        );
    }

    if (!(handler.command instanceof RegExp)) {
        throw new TypeError(
            `Invalid plugin: ${fileName}. handler.command must be a RegExp.`
        );
    }

    if (typeof handler.owner !== "boolean") {
        throw new TypeError(
            `Invalid plugin: ${fileName}. handler.owner must be a boolean.`
        );
    }
};

const loadPlugin = async (fileName, previous) => {
    const filePath = join(pluginsPath, fileName);
    const metadata = await stat(filePath);

    if (
        previous?.filePath === filePath &&
        previous.mtimeMs === metadata.mtimeMs &&
        previous.size === metadata.size
    ) {
        return previous;
    }

    const moduleUrl = pathToFileURL(filePath);
    moduleUrl.searchParams.set("v", String(metadata.mtimeMs));

    const module = await import(moduleUrl.href);
    const handler = module.default;

    validatePlugin(handler, fileName);

    return Object.freeze({
        fileName,
        filePath,
        mtimeMs: metadata.mtimeMs,
        size: metadata.size,
        handler
    });
};

const buildRegistry = async previousRegistry => {
    await mkdir(pluginsPath, { recursive: true });

    const files = (await readdir(pluginsPath, { withFileTypes: true }))
        .filter(file => file.isFile() && file.name.endsWith(".js"))
        .map(file => file.name)
        .sort((a, b) => a.localeCompare(b));

    const previousFiles = new Map(
        previousRegistry.map(plugin => [plugin.fileName, plugin])
    );

    const plugins = await Promise.all(
        files.map(fileName => loadPlugin(fileName, previousFiles.get(fileName)))
    );

    const commands = new Map();

    for (const plugin of plugins) {
        const key = plugin.handler.command.toString();

        if (commands.has(key)) {
            logger.warn("duplicate plugin command", {
                command: key,
                plugins: [commands.get(key), plugin.fileName]
            });
        } else {
            commands.set(key, plugin.fileName);
        }
    }

    return plugins;
};

const findPlugin = (plugins, text) => {
    for (const plugin of plugins) {
        const handler = plugin.handler;

        handler.command.lastIndex = 0;
        const match = handler.command.exec(text);
        handler.command.lastIndex = 0;

        if (match) {
            return {
                plugin,
                match
            };
        }
    }

    return null;
};

const registerHandler = async client => {
    let plugins = await buildRegistry([]);
    let reloadTimer = null;
    let reloadPromise = null;
    let reloadRequested = false;
    let reloadReason = "initial";
    let disposed = false;

    const reloadPlugins = reason => {
        reloadRequested = true;
        reloadReason = reason;

        if (reloadPromise) {
            return reloadPromise;
        }

        reloadPromise = (async () => {
            while (reloadRequested && !disposed) {
                reloadRequested = false;
                const reason = reloadReason;

                try {
                    const nextPlugins = await buildRegistry(plugins);
                    plugins = nextPlugins;

                    logger.info("plugins reloaded", {
                        count: plugins.length,
                        reason
                    });
                } catch (error) {
                    logger.error("plugin reload failed", {
                        reason,
                        message:
                            error instanceof Error ? error.message : String(error)
                    });
                }
            }
        })().finally(() => {
            reloadPromise = null;
        });

        return reloadPromise;
    };

    const scheduleReload = reason => {
        if (disposed) return;

        if (reloadTimer) {
            clearTimeout(reloadTimer);
        }

        reloadTimer = setTimeout(() => {
            reloadTimer = null;
            void reloadPlugins(reason);
        }, reloadDelayMs);
    };

    const watcher = watch(pluginsPath, (eventType, fileName) => {
        const name = fileName?.toString();

        if (name && !name.endsWith(".js")) return;

        scheduleReload(name ? `${eventType}:${name}` : eventType);
    });

    watcher.on("error", error => {
        logger.error("plugin watcher failed", {
            message: error instanceof Error ? error.message : String(error)
        });
    });

    const onMessage = async event => {
        const text = getText(event.message).trim();
        const jid = event.key?.remoteJid;

        if (!jid) return;

        const sender = getSender(event);
        const owner = getOwner();
        const isOwner =
            owner.length > 0 &&
            sender.replace(/\D/g, "") === owner;

        if (config.self && !isOwner) return;

        const registry = plugins;
        const result = findPlugin(registry, text);

        if (!result) return;

        const { plugin, match } = result;
        const handler = plugin.handler;

        if (handler.owner && !isOwner) return;

        try {
            await handler(event, {
                client,
                jid,
                sender,
                isOwner,
                text,
                match
            });
        } catch (error) {
            logger.error("plugin execution failed", {
                plugin: plugin.fileName,
                command: handler.command.toString(),
                message: error instanceof Error ? error.message : String(error)
            });
        }
    };

    client.on("message", onMessage);

    logger.info("plugins loaded", {
        count: plugins.length
    });

    return async () => {
        disposed = true;

        client.off("message", onMessage);

        if (reloadTimer) {
            clearTimeout(reloadTimer);
            reloadTimer = null;
        }

        watcher.close();

        if (reloadPromise) {
            await reloadPromise;
        }
    };
};

export default registerHandler;
