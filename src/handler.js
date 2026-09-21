import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import config from "./config/config.js";
import { logger } from "./config/logger.js";

const pluginsPath = fileURLToPath(new URL("./plugins/", import.meta.url));

const loadPlugins = async () => {
    const files = (await readdir(pluginsPath, { withFileTypes: true }))
        .filter(file => file.isFile() && file.name.endsWith(".js"))
        .sort((a, b) => a.name.localeCompare(b.name));

    const plugins = await Promise.all(
        files.map(async file => {
            const module = await import(
                pathToFileURL(join(pluginsPath, file.name)).href
            );

            const handler = module.default;

            if (typeof handler !== "function") {
                throw new TypeError(
                    `Invalid plugin: ${file.name}. Default export must be a function.`
                );
            }

            if (!(handler.command instanceof RegExp)) {
                throw new TypeError(
                    `Invalid plugin: ${file.name}. handler.command must be a RegExp.`
                );
            }

            if (typeof handler.owner !== "boolean") {
                throw new TypeError(
                    `Invalid plugin: ${file.name}. handler.owner must be a boolean.`
                );
            }

            return handler;
        })
    );

    return plugins;
};

const getText = message =>
    message?.conversation ??
    message?.extendedTextMessage?.text ??
    "";

const getSender = event => {
    const jid =
        event.key.participantAlt ??
        event.key.participant ??
        event.key.remoteJidAlt ??
        event.key.remoteJid;

    return jid?.split("@")[0]?.split(":")[0] ?? "";
};

const registerHandler = async client => {
    const plugins = await loadPlugins();

    client.on("message", async event => {
        const text = getText(event.message).trim();
        const jid = event.key?.remoteJid;

        if (!jid) return;

        const sender = getSender(event);
        const isOwner = sender === config.owner;

        if (config.self && !isOwner) return;

        const plugin = plugins.find(handler => {
            handler.command.lastIndex = 0;
            return handler.command.test(text);
        });

        if (!plugin) return;

        if (plugin.owner && !isOwner) return;

        try {
            await plugin(event, jid, { client });
        } catch (error) {
            logger.error("plugin execution failed", {
                plugin: plugin.command.toString(),
                message: error instanceof Error ? error.message : String(error)
            });
        }
    });
};

export default registerHandler;
