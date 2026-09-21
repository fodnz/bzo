import config from "./config/config.js";

const getText = message =>
    message?.conversation ??
    message?.extendedTextMessage?.text ??
    "";

const getSender = event => {
    const jid =
        event.key.participantAlt ??
        event.key.participant ??
        event.key.remoteJidAlt ??
        event.key.remoteJid;

    return jid?.split("@")[0]?.split(":")[0] ?? "";
};

const registerHandler = client => {
    client.on("message", async event => {
        const text = getText(event.message).trim().toLowerCase();

        if (text !== "ping") return;

        const sender = getSender(event);
        const self = config.self === true || config.self === "true";

        if (self && sender !== config.owner) return;

        const jid = event.key.remoteJid;

        if (!jid) return;

        const start = performance.now();

        const sent = await client.message.send(jid, "...", {
            quote: event
        });

        const ms = Math.round(performance.now() - start);

        await client.message.send(jid, `${ms}ms`, {
            editKey: {
                id: sent.id
            }
        });
    });
};

export default registerHandler;
