const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { clientUrl, nodeEnv } = require('./config/env');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

/**
 * CORS decides which websites may call this API from a browser.
 *
 * In development we allow any origin, because the app is opened from whatever
 * IP your laptop happens to have on the wifi that day, and that address
 * changes. In production, only the addresses you list are allowed.
 */
const allowedOrigins = [clientUrl, 'http://localhost:5173', 'http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Postman, curl, same-origin
      if (nodeEnv !== 'production') return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
if (nodeEnv === 'development') app.use(morgan('dev'));

// Uploaded product photos, served straight off disk.
// maxAge: filenames are random and never reused, so they cache forever.
app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', 'uploads'), { maxAge: '30d', fallthrough: true })
);

app.use('/api', require('./routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
