import { readdir, stat } from "node:fs/promises";
import { watch } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import config from "./config/config.js";
import { logger } from "./config/logger.js";

const pluginsPath = fileURLToPath(new URL("./plugins/", import.meta.url));

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

const loadPlugins = async currentRegistry => {
    const entries = (await readdir(pluginsPath, { withFileTypes: true }))
        .filter(entry => entry.isFile() && entry.name.endsWith(".js"))
        .sort((a, b) => a.name.localeCompare(b.name));

    const nextRegistry = new Map();

    for (const entry of entries) {
        const filePath = join(pluginsPath, entry.name);
        const fileStat = await stat(filePath);
        const currentPlugin = currentRegistry.get(entry.name);

        if (currentPlugin?.mtimeMs === fileStat.mtimeMs) {
            nextRegistry.set(entry.name, currentPlugin);
            continue;
        }

        try {
            const moduleUrl = `${pathToFileURL(filePath).href}?v=${fileStat.mtimeMs}`;
            const module = await import(moduleUrl);
            const handler = module.default;

            validatePlugin(handler, entry.name);

            nextRegistry.set(entry.name, {
                handler,
                mtimeMs: fileStat.mtimeMs
            });

            logger.info("plugin loaded", {
                plugin: entry.name,
                command: handler.command.toString(),
                owner: handler.owner
            });
        } catch (error) {
            logger.error("plugin load failed", {
                plugin: entry.name,
                message: error instanceof Error ? error.message : String(error)
            });

            if (currentPlugin) {
                nextRegistry.set(entry.name, currentPlugin);
            }
        }
    }

    return nextRegistry;
};

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

const findPlugin = (registry, text) => {
    for (const plugin of registry.values()) {
        plugin.handler.command.lastIndex = 0;
        const match = plugin.handler.command.exec(text);
        plugin.handler.command.lastIndex = 0;

        if (match) {
            return {
                handler: plugin.handler,
                match
            };
        }
    }

    return null;
};

const registerHandler = async client => {
    let registry = new Map();
    let reloadTimer = null;
    let reloadChain = Promise.resolve();

    try {
        registry = await loadPlugins(registry);
    } catch (error) {
        logger.error("plugin discovery failed", {
            message: error instanceof Error ? error.message : String(error)
        });
    }

    const onMessage = async event => {
        const text = getText(event.message).trim();
        const jid = event.key?.remoteJid;

        if (!jid) return;

        const sender = getSender(event);
        const isOwner = sender === config.owner;

        if (config.self && !isOwner) return;

        const result = findPlugin(registry, text);

        if (!result) return;

        const { handler, match } = result;

        if (handler.owner && !isOwner) return;

        try {
            await handler(event, jid, {
                client,
                jid,
                sender,
                isOwner,
                text,
                match
            });
        } catch (error) {
            logger.error("plugin execution failed", {
                command: handler.command.toString(),
                message: error instanceof Error ? error.message : String(error)
            });
        }
    };

    const reloadPlugins = () => {
        reloadChain = reloadChain
            .then(async () => {
                const nextRegistry = await loadPlugins(registry);
                registry = nextRegistry;
            })
            .catch(error => {
                logger.error("plugin reload failed", {
                    message: error instanceof Error ? error.message : String(error)
                });
            });

        return reloadChain;
    };

    const scheduleReload = () => {
        clearTimeout(reloadTimer);

        reloadTimer = setTimeout(() => {
            reloadTimer = null;
            void reloadPlugins();
        }, 150);
    };

    const watcher = watch(pluginsPath, { persistent: false }, (_eventType, fileName) => {
        if (!fileName || !String(fileName).endsWith(".js")) return;
        scheduleReload();
    });

    client.on("message", onMessage);

    return async () => {
        clearTimeout(reloadTimer);
        watcher.close();
        await reloadChain;
        client.off("message", onMessage);
    };
};

export default registerHandler;
