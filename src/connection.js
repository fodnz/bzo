import { logger } from "./config/logger.js";

const FATAL_REASONS = new Set([
    "stream_error_replaced",
    "stream_error_device_removed",
    "stream_error_force_logout",
    "failure_not_authorized",
    "failure_banned",
    "failure_locked",
    "failure_client_too_old",
    "failure_bad_user_agent",
    "primary_identity_key_change"
]);

const createReconnectDelay = (reason, code, attempt) => {
    if (reason === "stream_error_force_login" || code === 515) {
        return 0;
    }

    if (code === 402) {
        return 60_000;
    }

    return Math.min(30_000, 1_000 * 2 ** attempt);
};

const createConnectionSupervisor = client => {
    let stopped = false;
    let connecting = false;
    let reconnectTimer = null;
    let reconnectAttempt = 0;

    const connect = async () => {
        if (stopped || connecting) return;

        connecting = true;

        try {
            await client.connect();
        } catch (error) {
            logger.error("connection attempt failed", {
                message: error instanceof Error ? error.message : String(error)
            });

            scheduleReconnect("connect_error", null);
        } finally {
            connecting = false;
        }
    };

    const scheduleReconnect = (reason, code) => {
        if (stopped || reconnectTimer) return;

        const delayMs = createReconnectDelay(
            reason,
            code,
            reconnectAttempt
        );

        reconnectAttempt += 1;

        logger.warn("reconnecting", {
            reason,
            code,
            attempt: reconnectAttempt,
            delayMs
        });

        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            void connect();
        }, delayMs);
    };

    const onConnection = event => {
        if (event.status === "open") {
            reconnectAttempt = 0;

            logger.info("whatsapp connected", {
                isNewLogin: event.isNewLogin
            });

            return;
        }

        logger.warn("whatsapp disconnected", {
            reason: event.reason,
            code: event.code,
            isLogout: event.isLogout
        });

        if (
            stopped ||
            event.isLogout ||
            event.reason === "client_disconnected" ||
            FATAL_REASONS.has(event.reason)
        ) {
            return;
        }

        scheduleReconnect(event.reason, event.code);
    };

    const onStreamFailure = event => {
        logger.warn("whatsapp stream failure", {
            reason: event.failureReason,
            code: event.failureCode,
            message: event.failureMessage
        });
    };

    const start = async () => {
        stopped = false;
        client.on("connection", onConnection);
        client.on("stream_failure", onStreamFailure);
        await connect();
    };

    const stop = async () => {
        stopped = true;

        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        client.off("connection", onConnection);
        client.off("stream_failure", onStreamFailure);

        try {
            await client.disconnect();
        } catch (error) {
            logger.error("disconnect failed", {
                message: error instanceof Error ? error.message : String(error)
            });
        }
    };

    return {
        start,
        stop
    };
};

export { createConnectionSupervisor };
