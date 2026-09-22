import { WaClient } from "zapo-js";

import { clientOptions } from "../config/client-options.js";

const createBotClient = (config, store, logger) =>
    new WaClient(
        {
            ...clientOptions,
            store,
            sessionId: config.sessionId
        },
        logger
    );

export { createBotClient };
