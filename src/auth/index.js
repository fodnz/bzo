const registerAuth = (client, logger, config) => {
    const onAuthQr = async ({ qr, ttlMs }) => {
        logger.info("qr code issued", { ttlMs });

        if (!config.botPhoneNumber) return;

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
    };

    const onPairingCode = ({ code }) => {
        logger.info("pairing code received", {
            code: code.match(/.{1,4}/g)?.join("-") ?? code
        });
    };

    const onPairingRequired = ({ forceManual }) => {
        logger.info("pairing input required", { forceManual });
    };

    const onPasskeyRequired = ({ hasSigner }) => {
        logger.warn("passkey linking required", { hasSigner });
    };

    const onPaired = ({ credentials }) => {
        logger.info("whatsapp paired", { meJid: credentials.meJid });
    };

    client.on("auth_qr", onAuthQr);
    client.on("auth_pairing_code", onPairingCode);
    client.on("auth_pairing_required", onPairingRequired);
    client.on("auth_passkey_required", onPasskeyRequired);
    client.on("auth_paired", onPaired);

    return () => {
        client.off("auth_qr", onAuthQr);
        client.off("auth_pairing_code", onPairingCode);
        client.off("auth_pairing_required", onPairingRequired);
        client.off("auth_passkey_required", onPasskeyRequired);
        client.off("auth_paired", onPaired);
    };
};

export { registerAuth };
