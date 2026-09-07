/**
 * Vercel entry point.
 *
 * Vercel does not run `node server.js` and leave it running. It wraps this file
 * as a serverless function: the code wakes up when a request arrives, answers
 * it, and goes back to sleep. So we export the Express app itself rather than
 * calling app.listen().
 *
 * Running locally is unaffected — `npm run dev` still uses src/server.js.
 */
module.exports = require('../src/app');
