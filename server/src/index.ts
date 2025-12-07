import fs from 'fs';
import { buildApp } from './app.js';

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

// SSL configuration
const useHttps = process.env.USE_HTTPS === 'true';
const httpsOptions = useHttps ? {
  key: fs.readFileSync(process.env.SSL_KEY || '/etc/letsencrypt/live/filya.frost-ez.co.uk/privkey.pem'),
  cert: fs.readFileSync(process.env.SSL_CERT || '/etc/letsencrypt/live/filya.frost-ez.co.uk/fullchain.pem'),
} : undefined;

async function start() {
  const app = await buildApp(httpsOptions);

  try {
    await app.listen({ port: PORT, host: HOST });
    const protocol = useHttps ? 'https' : 'http';
    console.log(`Server running at ${protocol}://${HOST}:${PORT}`);
    console.log(`API available at ${protocol}://${HOST}:${PORT}/api`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
