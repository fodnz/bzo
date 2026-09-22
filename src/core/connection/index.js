import { WA_DISCONNECT_REASONS } from "zapo-js/protocol";

import { getReconnectDelayMs, shouldReconnect } from "./policy.js";

const createConnectionSupervisor = (client, logger) => {
    let started = false;
    let stopped = false;
    let connecting = false;
    let reconnectTimer = null;
    let reconnectAttempt = 0;

    const clearReconnectTimer = () => {
        if (!reconnectTimer) return;

        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    };

    const scheduleReconnect = (reason, code) => {
        if (stopped || connecting || reconnectTimer) return;

        const delayMs = getReconnectDelayMs(reason, code, reconnectAttempt);

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
        if (stopped || connecting) return;

        connecting = true;
        let failed = false;

        try {
            await client.connect();
        } catch (error) {
            failed = true;

            logger.warn("whatsapp connection attempt failed", {
                message: error instanceof Error ? error.message : String(error)
            });
        } finally {
            connecting = false;
        }

        if (failed) {
            scheduleReconnect("connect_error", null);
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

        if (!shouldReconnect(event)) {
            if (event.reason === WA_DISCONNECT_REASONS.FAILURE_CLIENT_TOO_OLD) {
                logger.warn("client_too_old recovery is handled by zapo-js");
            } else if (event.isLogout) {
                logger.error("whatsapp session logged out");
            }

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

    const onStanzaError = event => {
        logger.warn("whatsapp stanza error", {
            code: event.code,
            text: event.text
        });
    };

    const start = async () => {
        if (started) return;

        started = true;
        stopped = false;
        reconnectAttempt = 0;

        client.on("connection", onConnection);
        client.on("stream_failure", onStreamFailure);
        client.on("stanza_error", onStanzaError);

        await connect();
    };

    const stop = async () => {
        if (stopped) return;

        stopped = true;
        clearReconnectTimer();

        client.off("connection", onConnection);
        client.off("stream_failure", onStreamFailure);
        client.off("stanza_error", onStanzaError);

        try {
            await client.disconnect();
        } catch (error) {
            logger.error("whatsapp disconnect failed", {
                message: error instanceof Error ? error.message : String(error)
            });
        }
    };

    return Object.freeze({ start, stop });
};

export { createConnectionSupervisor };
