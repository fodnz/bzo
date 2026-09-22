import { watch } from "node:fs";

import { buildPluginRegistry, findPlugin, pluginsPath } from "./registry.js";
import { getSender, getText, isOwner } from "./context.js";

const RELOAD_DELAY_MS = 250;

const registerDispatcher = async (client, config, logger) => {
    let registry = await buildPluginRegistry(new Map(), logger);
    let reloadTimer = null;
    let reloadPromise = null;
    let reloadRequested = false;
    let reloadReason = "initial";
    let disposed = false;

    const reloadPlugins = reason => {
        if (disposed) return reloadPromise;

        reloadRequested = true;
        reloadReason = reason;

        if (reloadPromise) return reloadPromise;

        reloadPromise = (async () => {
            while (reloadRequested && !disposed) {
                reloadRequested = false;
                const currentReason = reloadReason;

                try {
                    registry = await buildPluginRegistry(registry, logger);

                    logger.info("plugins reloaded", {
                        count: registry.size,
                        reason: currentReason
                    });
                } catch (error) {
                    logger.error("plugin reload failed", {
                        reason: currentReason,
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
        }, RELOAD_DELAY_MS);
    };

    const hotReloadEnabled = config.environment !== "production";
    let watcher = null;

    if (hotReloadEnabled) {
        watcher = watch(pluginsPath, (eventType, fileName) => {
            const name = fileName?.toString();

            if (name && !name.endsWith(".js")) return;

            scheduleReload(name ? `${eventType}:${name}` : eventType);
        });

        watcher.on("error", error => {
            logger.error("plugin watcher failed", {
                message: error instanceof Error ? error.message : String(error)
            });
        });
    }

    const onMessage = async event => {
        const jid = event.key?.remoteJid;

        if (!jid) return;
        if (event.key?.fromMe && !config.selfOnly) return;

        const sender = getSender(event);
        const owner = isOwner(sender, config.owner);

        if (config.selfOnly && !owner) return;

        const text = getText(event).trim();
        const match = findPlugin(registry, text);

        if (!match) return;

        const { plugin, match: commandMatch } = match;
        const { handler } = plugin;

        if (handler.owner && !owner) return;

        try {
            await client.message.sendReceipt(event, { type: "read" });
        } catch (error) {
            logger.warn("failed to send read receipt", {
                plugin: plugin.fileName,
                message: error instanceof Error ? error.message : String(error)
            });
        }

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
        count: registry.size,
        hotReload: hotReloadEnabled
    });

    return async () => {
        disposed = true;

        client.off("message", onMessage);

        if (reloadTimer) {
            clearTimeout(reloadTimer);
            reloadTimer = null;
        }

        watcher?.close();

        if (reloadPromise) {
            await reloadPromise;
        }
    };
};

export { registerDispatcher };
