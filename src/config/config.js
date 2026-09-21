import "dotenv/config";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const getEnv = name => process.env[name];

const storePath = resolve(process.cwd(), getEnv("PATH_STORE"));

mkdirSync(dirname(storePath), { recursive: true });

const config = Object.freeze({
    environment: getEnv("NODE_ENV"),
    logLevel: getEnv("LOG_LEVEL"),
    serviceName: getEnv("SERVICE_NAME"),

    owner: getEnv("OWNER"),
    self: getEnv("SELF"),

    path: Object.freeze({
        store: storePath
    }),

    botPhoneNumber: getEnv("BOT_NUMBER"),
    sessionId: getEnv("SESSION_ID"),
    pairingCode: getEnv("PAIRING_CODE")
});

export default config;
