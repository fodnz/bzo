import { WaClient } from "zapo-js";

const ClientOptions = Object.freeze({
    connectTimeoutMs: 15_000,

    deviceBrowser: "Chrome",
    deviceOsDisplayName: "Linux",
    deviceOsVersion: "22.04",

    iqTimeoutMs: 15_000,
    nodeQueryTimeoutMs: 15_000,
    keepAliveIntervalMs: 15_000,
    deadSocketTimeoutMs: 20_000,

    mediaTimeoutMs: 30_000,
    appStateSyncTimeoutMs: 30_000,
    messageAckTimeoutMs: 10_000,

    messageMaxAttempts: 5,
    messageRetryDelayMs: 500,

    signalFetchKeyBundlesTimeoutMs: 20_000,

    markOnlineOnConnect: true,
    recoverFromClientTooOld: true,

    history: {
        enabled: true,
        requireFullSync: false,
        groupBundles: false
    },

    addons: {
        autoDecrypt: true,
        persistAllSecrets: true
    },

    writeBehind: {
        maxPendingKeys: 8000,
        maxWriteConcurrency: 8,
        flushTimeoutMs: 3_000
    },

    linkPreview: {
        enabled: true,
        fetchTimeoutMs: 10_000,
        maxHtmlBytes: 2 * 1024 * 1024,
        maxThumbnailBytes: 5 * 1024 * 1024,
        allowPrivateHosts: false
    },

    logoutStoreClear: {
        messages: false,
        threads: false,
        contacts: false,

        auth: true,
        signal: true,
        preKey: true,
        session: true,
        identity: true,
        senderKey: true,
        appState: true,
        privacyToken: true
    }
});

const createClient = ({ sessionId, store, logger }) => {
    return new WaClient(
        {
            ...ClientOptions,
            store,
            sessionId
        },
        logger
    );
};

export { createClient };
