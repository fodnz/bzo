const formatBytes = bytes =>
    `${(bytes / 1024 / 1024).toFixed(2)} MB`;

const handler = async (m, jid, { client }) => {
    const memory = process.memoryUsage();

    const message = [
        `RSS: ${formatBytes(memory.rss)}`,
        `Heap Total: ${formatBytes(memory.heapTotal)}`,
        `Heap Used: ${formatBytes(memory.heapUsed)}`,
        `External: ${formatBytes(memory.external)}`,
        `Array Buffers: ${formatBytes(memory.arrayBuffers)}`
    ].join("\n");

    await client.message.send(jid, message, {
        quote: m
    });
};

handler.owner = false;
handler.command = /^(mem)$/i;

export default handler;
