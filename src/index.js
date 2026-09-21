import config from "./config/config.js";
import { createClient } from "./client.js";
import { logger } from "./config/logger.js";
import { store } from "./store.js";
import registerHandler from "./handler.js";
import { createConnectionSupervisor } from "./connection.js";

const startClient = async () => {
    const client = createClient({
        sessionId: config.sessionId,
        store,
        logger
    });

    const disposeHandler = await registerHandler(client);
    const connection = createConnectionSupervisor(client);

    client.on("auth_qr", async () => {
        try {
            await client.auth.requestPairingCode(
                config.botPhoneNumber,
                true,
                config.pairingCode
            );
        } catch (error) {
            logger.error("pairing code request failed", {
                message: error instanceof Error ? error.message : String(error)
            });
        }
    });

    client.on("auth_pairing_code", ({ code }) => {
        logger.info("pairing code received", {
            code: code.match(/.{1,4}/g)?.join("-") ?? code
        });
    });

    client.on("auth_paired", ({ credentials }) => {
        logger.info("whatsapp paired", {
            meJid: credentials.meJid
        });
    });

    await connection.start();

    let shuttingDown = false;

    const shutdown = async signal => {
        if (shuttingDown) return;

        shuttingDown = true;

        logger.info("shutting down", { signal });

        await connection.stop();
        await disposeHandler();
    };

    process.once("SIGINT", async () => {
        await shutdown("SIGINT");
        process.exit(0);
    });

    process.once("SIGTERM", async () => {
        await shutdown("SIGTERM");
        process.exit(0);
    });

    return client;
};

await startClient();
