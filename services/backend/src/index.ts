import { createServer } from './server.js';

const app = createServer();
const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`\n======================================================`);
    console.log(`🚀 Relay Autonomous Personal AI Backend running on http://${HOST}:${PORT}`);
    console.log(`📡 Health check: http://${HOST}:${PORT}/health`);
    console.log(`======================================================\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
