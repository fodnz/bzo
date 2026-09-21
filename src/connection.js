import {
    WA_DISCONNECT_REASONS,
    WA_FAILURE_REASONS,
    WA_STREAM_SIGNALING
} from "zapo-js";

import { logger } from "./config/logger.js";

const reconnectBaseDelayMs = 1_000;
const reconnectMaxDelayMs = 30_000;
const temporaryBanDelayMs = 60_000;

const fatalReasons = new Set([
    WA_DISCONNECT_REASONS.STREAM_ERROR_REPLACED,
    WA_DISCONNECT_REASONS.STREAM_ERROR_DEVICE_REMOVED,
    WA_DISCONNECT_REASONS.STREAM_ERROR_FORCE_LOGOUT,
    WA_DISCONNECT_REASONS.FAILURE_NOT_AUTHORIZED,
    WA_DISCONNECT_REASONS.FAILURE_BANNED,
    WA_DISCONNECT_REASONS.FAILURE_LOCKED,
    WA_DISCONNECT_REASONS.FAILURE_BAD_USER_AGENT,
    WA_DISCONNECT_REASONS.PRIMARY_IDENTITY_KEY_CHANGE
]);

const createReconnectDelay = (reason, code, attempt) => {
    if (
        reason === WA_DISCONNECT_REASONS.STREAM_ERROR_FORCE_LOGIN ||
        code === WA_STREAM_SIGNALING.FORCE_LOGIN_CODE
    ) {
        return 0;
    }

    if (code === WA_FAILURE_REASONS.TEMP_BANNED) {
        return temporaryBanDelayMs;
    }

    return Math.min(
        reconnectMaxDelayMs,
        reconnectBaseDelayMs * 2 ** attempt
    );
};

const createConnectionSupervisor = client => {
    let started = false;
    let stopped = false;
    let blocked = false;
    let connecting = false;
    let reconnectTimer = null;
    let reconnectAttempt = 0;

    const clearReconnectTimer = () => {
        if (!reconnectTimer) return;

        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    };

    const scheduleReconnect = (reason, code) => {
        if (stopped || blocked || connecting || reconnectTimer) return;

        const delayMs = createReconnectDelay(
            reason,
            code,
            reconnectAttempt
        );

        reconnectAttempt += 1;

        logger.warn("scheduling whatsapp reconnect", {
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

    const connect = async () => {
        if (stopped || blocked || connecting) return;

        connecting = true;

        try {
            await client.connect();
        } catch (error) {
            logger.warn("whatsapp connection attempt failed", {
                message: error instanceof Error ? error.message : String(error)
            });
        } finally {
            connecting = false;
        }

        if (!stopped && !blocked && !client.getState().connected) {
            scheduleReconnect("connect_failed", null);
        }
    };

    const onConnection = event => {
        if (event.status === "open") {
            reconnectAttempt = 0;
            clearReconnectTimer();

            logger.info("whatsapp connection opened", {
                isNewLogin: event.isNewLogin
            });

            return;
        }

        if (stopped) return;

        logger.warn("whatsapp connection closed", {
            reason: event.reason,
            code: event.code,
            isLogout: event.isLogout
        });

        if (
            event.isLogout ||
            event.reason === WA_DISCONNECT_REASONS.CLIENT_DISCONNECTED
        ) {
            blocked = true;
            clearReconnectTimer();
            return;
        }

        if (event.reason === WA_DISCONNECT_REASONS.FAILURE_CLIENT_TOO_OLD) {
            logger.warn(
                "zapo-js is handling client_too_old recovery automatically"
            );
            return;
        }

        if (fatalReasons.has(event.reason)) {
            blocked = true;
            clearReconnectTimer();

            logger.error("fatal whatsapp connection reason", {
                reason: event.reason,
                code: event.code
            });

            return;
        }

        scheduleReconnect(event.reason, event.code);
    };

    const onStreamFailure = event => {
        logger.warn("whatsapp stream failure", {
            reason: event.failureReason,
            code: event.failureCode,
            message: event.failureMessage,
            url: event.failureUrl
        });
    };

    const start = async () => {
        if (started) return;

        started = true;
        stopped = false;
        blocked = false;
        reconnectAttempt = 0;

        client.on("connection", onConnection);
        client.on("stream_failure", onStreamFailure);

        await connect();
    };

    const stop = async () => {
        if (stopped) return;

        stopped = true;
        blocked = true;
        clearReconnectTimer();

        client.off("connection", onConnection);
        client.off("stream_failure", onStreamFailure);

        try {
            await client.disconnect();
        } catch (error) {
            logger.error("whatsapp disconnect failed", {
                message: error instanceof Error ? error.message : String(error)
            });
        }
    };

    return Object.freeze({
        start,
        stop
    });
};

export { createConnectionSupervisor };
