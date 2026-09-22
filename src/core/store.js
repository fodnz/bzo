import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createStore } from "zapo-js";
import { createSqliteStore } from "@zapo-js/store-sqlite";

const cacheTtlMs = Object.freeze({
    retryMs: 60_000,
    groupMetadataMs: 3 * 60_000,
    chatMetadataMs: 30 * 60_000,
    deviceListMs: 5 * 60_000,
    messageSecretMs: 30 * 60_000
});

const batchSizes = Object.freeze({
    signalPreKey: 1000,
    signalHasSession: 1000,
    deviceList: 1000
});

const pragmas = Object.freeze({
    journal_mode: "WAL",
    synchronous: "NORMAL",
    busy_timeout: 10_000,
    cache_size: -40_000,
    mmap_size: 268_435_456
});

const createBotStore = (config, logger) => {
    const storePath = resolve(process.cwd(), config.storePath);

    mkdirSync(dirname(storePath), { recursive: true });

    const sqlite = createSqliteStore({
        path: storePath,
        driver: "node",
        pragmas,
        cacheTtlMs,
        batchSizes,
        logger
    });

    return createStore({
        backends: {
            sqlite
        },
        providers: {
            auth: "sqlite",
            signal: "sqlite",
            preKey: "sqlite",
            session: "sqlite",
            identity: "sqlite",
            senderKey: "sqlite",
            appState: "sqlite",
            privacyToken: "sqlite",
            messages: "sqlite",
            threads: "sqlite",
            contacts: "sqlite"
        }
    });
};

export { createBotStore };
