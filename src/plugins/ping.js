const handler = async (m, jid, { client }) => {
    const start = performance.now();

    const sent = await client.message.send(jid, "...", {
        quote: m
    });

    const ms = Math.round(performance.now() - start);

    await client.message.send(jid, `${ms}ms`, {
        editKey: {
            id: sent.id
        }
    });
};

handler.owner = false;
handler.command = /^(ping)$/i;

export default handler;
