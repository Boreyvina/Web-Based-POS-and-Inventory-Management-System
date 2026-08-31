const app = require('./app');
const { port, nodeEnv } = require('./config/env');
const { testConnection } = require('./config/db');

(async () => {
  try {
    await testConnection();
    console.log('[db] Connected to MySQL');
  } catch (err) {
    console.error('[db] Could not connect to MySQL:', err.message);
    console.error('[db] Check your .env values and that the MySQL service is running.');
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`[server] Running in ${nodeEnv} mode on http://localhost:${port}`);
    console.log(`[server] Health check: http://localhost:${port}/api/health`);
  });
})();
