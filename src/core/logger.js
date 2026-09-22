import { createPinoLogger } from "zapo-js";

const createLogger = config =>
    createPinoLogger({
        level: config.logLevel,
        pretty: config.environment !== "production",
        name: config.serviceName,
        base: {
            service: config.serviceName
        }
    });

export { createLogger };
