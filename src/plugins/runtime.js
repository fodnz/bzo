import process from "node:process";
import os from "node:os";

const formatUptime = seconds => {
    const total = Math.floor(seconds);
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secondsRemaining = total % 60;

    return [
        days ? `${days}d` : "",
        hours ? `${hours}h` : "",
        minutes ? `${minutes}m` : "",
        `${secondsRemaining}s`
    ].filter(Boolean).join(" ");
};

const handler = async (m, { client, jid }) => {
    const message = [
        `Node.js: ${process.version}`,
        `V8: ${process.versions.v8}`,
        `PID: ${process.pid}`,
        `Uptime: ${formatUptime(process.uptime())}`,
        `Platform: ${process.platform}`,
        `Architecture: ${process.arch}`,
        `CPU Cores: ${os.cpus().length}`,
        `Exec Path: ${process.execPath}`,
        `Working Dir: ${process.cwd()}`
    ].join("\n");

    await client.message.send(jid, message, {
        quote: m
    });
};

handler.owner = false;
handler.command = /^(runtime)$/i;

export default handler;
