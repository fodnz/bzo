import { watch } from "node:fs";

import config from "../config/config.js";
import { logger } from "../config/logger.js";
import { buildPluginRegistry, pluginsPath } from "./loader.js";
import { findPlugin, getSender, getText, isOwner } from "./matcher.js";

const reloadDelayMs = 250;

const registerHandler = async client => {
    let registry = await buildPluginRegistry(new Map());
    let reloadTimer = null;
    let reloadPromise = null;
    let reloadRequested = false;
    let reloadReason = "initial";
    let disposed = false;

    const reloadPlugins = reason => {
        if (disposed) return;

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
                    const nextRegistry = await buildPluginRegistry(registry);
                    registry = nextRegistry;

                    logger.info("plugins reloaded", {
                        count: registry.size,
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
        const text = getText(event).trim();
        const jid = event.key?.remoteJid;

        if (!jid) return;

        const sender = getSender(event);
        const owner = isOwner(sender, config.owner);

        if (config.self && !owner) return;

        const match = findPlugin(registry, text);

        if (!match) return;

        const { plugin, match: commandMatch } = match;
        const { handler } = plugin;

        if (handler.owner && !owner) return;

        try {
            await handler(event, {
                client,
                jid,
                sender,
                isOwner: owner,
                text,
                match: commandMatch
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
        count: registry.size
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