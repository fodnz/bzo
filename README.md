# bzo

🧩 A lightweight and extensible WhatsApp bot powered by [zapo-js](https://github.com/vinikjkkj/zapo).

## Getting started

```bash
npm install
cp .env.example .env
npm run dev
```

Fill in `.env` before starting:

| Variable | Required | Description |
| --- | --- | --- |
| `SESSION_ID` | yes | Identifier for this WhatsApp session's stored credentials. |
| `PATH_STORE` | yes | Path to the SQLite database file. |
| `NODE_ENV` | no | `development` (default) enables pretty logs and plugin hot-reload; `production` disables both. |
| `LOG_LEVEL` | no | `trace` \| `debug` \| `info` (default) \| `warn` \| `error`. |
| `SERVICE_NAME` | no | Name attached to every log line. |
| `OWNER` | no | Phone number (digits only) allowed to run owner-only commands. |
| `SELF` | no | `true` restricts the bot to only react to the owner's own messages. |
| `BOT_NUMBER` | no | Phone number used to request a pairing code instead of scanning a QR. |
| `PAIRING_CODE` | no | A specific 8-character pairing code to request. |

## Structure

```
src/
├── index.js                 entrypoint: bootstrap, signals, crash handling
├── app.js                   composition root: wires every module together
├── config/
│   ├── env.js                loads and validates environment variables
│   └── client-options.js     WaClient tuning defaults
├── core/
│   ├── logger.js             pino logger factory
│   ├── store.js               SQLite-backed zapo store factory
│   ├── client.js               WaClient factory
│   └── connection/
│       ├── index.js            connect/reconnect supervisor
│       └── policy.js           which disconnects are fatal, backoff timing
├── auth/
│   └── index.js               QR, pairing code, and paired event handling
├── events/
│   └── activity.js            groups, calls, receipts, profile & telemetry events
├── messaging/
│   ├── context.js             text extraction, sender resolution, owner check
│   ├── registry.js            plugin discovery, validation, hot-reload
│   └── dispatcher.js           routes incoming messages to matching plugins
└── plugins/
    ├── mem.js
    ├── ping.js
    └── runtime.js
```

Each module exposes a small factory or `register*` function and returns a
dispose callback where relevant, so `app.js` can start and stop the whole
bot cleanly — used for graceful shutdown on `SIGINT`/`SIGTERM`.

## Writing a plugin

Drop a file in `src/plugins/`. Its default export is the command handler,
tagged with a `command` regex and an `owner` flag:

```js
const handler = async (message, { client, jid }) => {
    await client.message.send(jid, "pong", { quote: message });
};

handler.owner = false;
handler.command = /^(ping)$/i;

export default handler;
```

In development, plugins are hot-reloaded on save. In production, the file
watcher is disabled and plugins load once at startup.
