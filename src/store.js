import { createStore } from "zapo-js";
import { createSqliteStore } from "@zapo-js/store-sqlite";

import config from "./config/config.js";
import { logger } from "./config/logger.js";

const SqliteCacheTtlMs = Object.freeze({
    retryMs: 60_000,
    groupMetadataMs: 3 * 60_000,
    chatMetadataMs: 30 * 60_000,
    deviceListMs: 5 * 60_000,
    messageSecretMs: 30 * 60_000
});

const SqliteBatchSizes = Object.freeze({
    signalPreKey: 1000,
    signalHasSession: 1000,
    deviceList: 1000
});

const SqlitePragmas = Object.freeze({
    journal_mode: "WAL",
    synchronous: "NORMAL",
    busy_timeout: 10_000,
    cache_size: -40_000,
    mmap_size: 268_435_456
});

const sqlite = createSqliteStore({
    path: config.path.store,
    driver: "node",
    pragmas: SqlitePragmas,
    cacheTtlMs: SqliteCacheTtlMs,
    batchSizes: SqliteBatchSizes,
    logger
});

const store = createStore({
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

export { store }; 