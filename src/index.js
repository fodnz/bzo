import { createApp } from "./app.js";

const main = async () => {
    const app = await createApp();

    let shuttingDown = false;

    const shutdown = async signal => {
        if (shuttingDown) return;

        shuttingDown = true;
        app.logger.info("shutting down", { signal });

        try {
            await app.stop();
        } catch (error) {
            app.logger.error("shutdown failed", {
                message: error instanceof Error ? error.message : String(error)
            });

            process.exitCode = 1;
        }
    };

    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));

    process.on("unhandledRejection", reason => {
        app.logger.error("unhandled rejection", {
            message: reason instanceof Error ? reason.message : String(reason)
        });
    });

    process.on("uncaughtException", error => {
        app.logger.error("uncaught exception", {
            message: error instanceof Error ? error.message : String(error)
        });
    });

    await app.start();
};

await main();
