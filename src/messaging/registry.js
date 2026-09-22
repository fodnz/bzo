import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const pluginsPath = fileURLToPath(new URL("../plugins/", import.meta.url));

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
    moduleUrl.searchParams.set("v", `${metadata.mtimeMs}-${metadata.size}`);

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

const buildPluginRegistry = async (previousRegistry, logger) => {
    await mkdir(pluginsPath, { recursive: true });

    const files = (await readdir(pluginsPath, { withFileTypes: true }))
        .filter(file => file.isFile() && file.name.endsWith(".js"))
        .map(file => file.name)
        .sort((a, b) => a.localeCompare(b));

    const previousFiles = new Map(previousRegistry);
    const nextRegistry = new Map();

    for (const fileName of files) {
        const previous = previousFiles.get(fileName);
        const plugin = await loadPlugin(fileName, previous);

        nextRegistry.set(fileName, plugin);

        if (plugin !== previous) {
            logger?.info("plugin loaded", {
                plugin: fileName,
                command: plugin.handler.command.toString(),
                owner: plugin.handler.owner
            });
        }
    }

    const commands = new Map();

    for (const plugin of nextRegistry.values()) {
        const command = plugin.handler.command.toString();

        if (commands.has(command)) {
            throw new Error(
                `Duplicate plugin command ${command}: ${commands.get(command)} and ${plugin.fileName}`
            );
        }

        commands.set(command, plugin.fileName);
    }

    return nextRegistry;
};

const findPlugin = (registry, text) => {
    for (const plugin of registry.values()) {
        const { handler } = plugin;

        handler.command.lastIndex = 0;
        const match = handler.command.exec(text);
        handler.command.lastIndex = 0;

        if (match) {
            return { plugin, match };
        }
    }

    return null;
};

export { buildPluginRegistry, findPlugin, pluginsPath };
