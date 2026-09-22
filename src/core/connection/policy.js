import {
    WA_DISCONNECT_REASONS,
    WA_FAILURE_REASONS,
    WA_STREAM_SIGNALING
} from "zapo-js/protocol";

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

const shouldReconnect = event => {
    if (event.status !== "close") return false;
    if (event.isLogout) return false;

    if (event.reason === WA_DISCONNECT_REASONS.CLIENT_DISCONNECTED) {
        return false;
    }

    if (event.reason === WA_DISCONNECT_REASONS.FAILURE_CLIENT_TOO_OLD) {
        return false;
    }

    return !fatalReasons.has(event.reason);
};

const getReconnectDelayMs = (reason, code, attempt) => {
    if (
        reason === WA_DISCONNECT_REASONS.STREAM_ERROR_FORCE_LOGIN ||
        code === WA_STREAM_SIGNALING.FORCE_LOGIN_CODE
    ) {
        return 0;
    }

    if (code === WA_FAILURE_REASONS.TEMP_BANNED) {
        return 60_000;
    }

    return Math.min(30_000, 1_000 * 2 ** attempt);
};

export { getReconnectDelayMs, shouldReconnect };
