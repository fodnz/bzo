import { createPinoLogger } from "zapo-js";

import config from "./config.js";

const logger = await createPinoLogger({
    level: config.logLevel,
    pretty: config.environment !== "production",
    name: config.serviceName,
    base: {
        service: config.serviceName
    }
});

export { logger };