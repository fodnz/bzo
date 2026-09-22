const registerActivityEvents = (client, logger) => {
    const onGroup = event => {
        logger.info("group event", {
            action: event.action,
            groupJid: event.groupJid,
            authorJid: event.authorJid
        });
    };

    const onCall = event => {
        logger.info("incoming call", {
            type: event.type,
            isVideo: event.isVideo,
            from: event.callerPnJid ?? event.callCreatorJid,
            groupJid: event.groupJid
        });
    };

    const onMessageProtocol = event => {
        logger.info("protocol message", {
            jid: event.key?.remoteJid,
            id: event.key?.id,
            type: event.protocolMessage?.type
        });
    };

    const onMessageAddon = event => {
        logger.info("message addon", {
            kind: event.kind,
            jid: event.key?.remoteJid,
            targetMessageId: event.targetMessageId
        });
    };

    const onMessageUnavailable = event => {
        logger.warn("message unavailable", {
            kind: event.kind,
            resendRequested: event.resendRequested,
            jid: event.key?.remoteJid,
            id: event.key?.id
        });
    };

    const onReceipt = event => {
        logger.debug("receipt", {
            status: event.status,
            chatJid: event.chatJid,
            messageIds: event.messageIds
        });
    };

    const onPicture = event => {
        logger.info("picture changed", {
            action: event.action,
            targetJid: event.targetJid,
            authorJid: event.authorJid
        });
    };

    const onPrivacy = () => {
        logger.info("privacy settings updated");
    };

    const onBlocklist = event => {
        logger.info("blocklist updated", {
            size: event.jids?.length ?? 0
        });
    };

    const onBusiness = event => {
        logger.info("business profile updated", {
            action: event.action,
            bizJid: event.bizJid
        });
    };

    const onOwnUsername = event => {
        logger.info("own username changed", {
            kind: event.kind,
            username: event.username
        });
    };

    const onOfflineResume = event => {
        logger.info("offline resume", {
            status: event.status,
            remainingStanzas: event.remainingStanzas,
            totalStanzas: event.totalStanzas,
            forced: event.forced
        });
    };

    const onHistorySyncChunk = event => {
        logger.info("history sync chunk", {
            messagesCount: event.messagesCount,
            conversationsCount: event.conversationsCount,
            progress: event.progress
        });
    };

    const onMexNotification = event => {
        logger.debug("mex notification", {
            kind: event.kind,
            operationName: event.operationName
        });
    };

    const onDebugClientError = ({ error }) => {
        logger.error("client error", {
            message: error instanceof Error ? error.message : String(error)
        });
    };

    client.on("group", onGroup);
    client.on("call", onCall);
    client.on("message_protocol", onMessageProtocol);
    client.on("message_addon", onMessageAddon);
    client.on("message_unavailable", onMessageUnavailable);
    client.on("receipt", onReceipt);
    client.on("picture", onPicture);
    client.on("privacy", onPrivacy);
    client.on("blocklist", onBlocklist);
    client.on("business", onBusiness);
    client.on("own_username", onOwnUsername);
    client.on("offline_resume", onOfflineResume);
    client.on("history_sync_chunk", onHistorySyncChunk);
    client.on("mex_notification", onMexNotification);
    client.on("debug_client_error", onDebugClientError);

    return () => {
        client.off("group", onGroup);
        client.off("call", onCall);
        client.off("message_protocol", onMessageProtocol);
        client.off("message_addon", onMessageAddon);
        client.off("message_unavailable", onMessageUnavailable);
        client.off("receipt", onReceipt);
        client.off("picture", onPicture);
        client.off("privacy", onPrivacy);
        client.off("blocklist", onBlocklist);
        client.off("business", onBusiness);
        client.off("own_username", onOwnUsername);
        client.off("offline_resume", onOfflineResume);
        client.off("history_sync_chunk", onHistorySyncChunk);
        client.off("mex_notification", onMexNotification);
        client.off("debug_client_error", onDebugClientError);
    };
};

export { registerActivityEvents };
