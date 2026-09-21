const getText = event =>
    event.message?.conversation ??
    event.message?.extendedTextMessage?.text ??
    "";

const getSender = event => {
    const jid =
        event.key?.participantAlt ??
        event.key?.participant ??
        event.key?.remoteJidAlt ??
        event.key?.remoteJid;

    return jid?.split("@")[0]?.split(":")[0] ?? "";
};

const normalizePhone = value =>
    String(value ?? "").replace(/\D/g, "");

const isOwner = (sender, owner) => {
    const normalizedOwner = normalizePhone(owner);

    return (
        normalizedOwner.length > 0 &&
        normalizePhone(sender) === normalizedOwner
    );
};

const findPlugin = (registry, text) => {
    for (const plugin of registry.values()) {
        const { handler } = plugin;

        handler.command.lastIndex = 0;
        const match = handler.command.exec(text);
        handler.command.lastIndex = 0;

        if (match) {
            return {
                plugin,
                match
            };
        }
    }

    return null;
};

export { findPlugin, getSender, getText, isOwner };