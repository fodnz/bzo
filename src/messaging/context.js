const MAX_UNWRAP_DEPTH = 8;

const unwrapMessage = message => {
    let current = message;
    let depth = 0;

    while (current && depth < MAX_UNWRAP_DEPTH) {
        const inner =
            current.ephemeralMessage?.message ??
            current.viewOnceMessage?.message ??
            current.viewOnceMessageV2?.message ??
            current.viewOnceMessageV2Extension?.message ??
            current.documentWithCaptionMessage?.message ??
            current.editedMessage?.message ??
            null;

        if (!inner) break;

        current = inner;
        depth += 1;
    }

    return current;
};

const getText = event => {
    const message = unwrapMessage(event.message);

    if (!message) return "";

    return (
        message.conversation ??
        message.extendedTextMessage?.text ??
        message.imageMessage?.caption ??
        message.videoMessage?.caption ??
        message.documentMessage?.caption ??
        message.buttonsResponseMessage?.selectedButtonId ??
        message.listResponseMessage?.singleSelectReply?.selectedRowId ??
        message.templateButtonReplyMessage?.selectedId ??
        ""
    );
};

const getSender = event => {
    const jid =
        event.key?.participantAlt ??
        event.key?.participant ??
        event.key?.remoteJidAlt ??
        event.key?.remoteJid;

    return jid?.split("@")[0]?.split(":")[0] ?? "";
};

const normalizePhone = value => String(value ?? "").replace(/\D/g, "");

const isOwner = (sender, owner) => {
    const normalizedOwner = normalizePhone(owner);

    return (
        normalizedOwner.length > 0 &&
        normalizePhone(sender) === normalizedOwner
    );
};

export { getSender, getText, isOwner };
