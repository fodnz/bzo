import "dotenv/config";

const REQUIRED_ENV = ["SESSION_ID", "PATH_STORE"];

const readEnv = () => {
    const missing = REQUIRED_ENV.filter(name => !process.env[name]);

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(", ")}`
        );
    }

    return Object.freeze({
        environment: process.env.NODE_ENV ?? "development",
        logLevel: process.env.LOG_LEVEL ?? "info",
        serviceName: process.env.SERVICE_NAME ?? "bzo",

        owner: process.env.OWNER ?? "",
        selfOnly: process.env.SELF === "true",

        botPhoneNumber: process.env.BOT_NUMBER ?? "",
        sessionId: process.env.SESSION_ID,
        pairingCode: process.env.PAIRING_CODE ?? "",

        storePath: process.env.PATH_STORE
    });
};

const config = readEnv();

export default config;
