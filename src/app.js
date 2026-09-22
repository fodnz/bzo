import config from "./config/env.js";
import { createLogger } from "./core/logger.js";
import { createBotStore } from "./core/store.js";
import { createBotClient } from "./core/client.js";
import { createConnectionSupervisor } from "./core/connection/index.js";
import { registerAuth } from "./auth/index.js";
import { registerActivityEvents } from "./events/activity.js";
import { registerDispatcher } from "./messaging/dispatcher.js";

const createApp = async () => {
    const logger = await createLogger(config);
    const store = createBotStore(config, logger);
    const client = createBotClient(config, store, logger);

    const disposeDispatcher = await registerDispatcher(client, config, logger);
    const disposeAuth = registerAuth(client, logger, config);
    const disposeActivity = registerActivityEvents(client, logger);
    const connection = createConnectionSupervisor(client, logger);

    const start = () => connection.start();

    const stop = async () => {
        await connection.stop();
        await disposeDispatcher();
        disposeAuth();
        disposeActivity();
        await store.destroy();
    };

    return Object.freeze({ client, logger, start, stop });
};

export { createApp };
