import { buildApp } from './app.js';

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`Server running at http://${HOST}:${PORT}`);
    console.log(`API available at http://${HOST}:${PORT}/api`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
