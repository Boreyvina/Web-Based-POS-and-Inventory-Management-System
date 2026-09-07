require('dotenv').config();

const required = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`\n[config] Missing .env values: ${missing.join(', ')}`);
  console.error('[config] Copy .env.example to .env and fill it in.\n');
  process.exit(1);
}

module.exports = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  qr: {
    // Either point at a picture of your bank QR...
    staticImageUrl: process.env.QR_STATIC_IMAGE_URL || '',
    // ...or fill these in so the app can generate one with the amount included.
    acquirerId: process.env.QR_ACQUIRER_ID || '',
    accountId: process.env.QR_ACCOUNT_ID || '',
    merchantTag: process.env.QR_MERCHANT_TAG || '29',
    merchantName: process.env.QR_MERCHANT_NAME || '',
    merchantCity: process.env.QR_MERCHANT_CITY || 'PHNOM PENH',
    merchantCategoryCode: process.env.QR_MCC || '5499',
    countryCode: process.env.QR_COUNTRY || 'KH',
  },
  store: {
    name: process.env.STORE_NAME || 'My Store',
    address: process.env.STORE_ADDRESS || '',
    phone: process.env.STORE_PHONE || '',
    currency: process.env.CURRENCY || 'USD',
    taxRate: Number(process.env.TAX_RATE) || 0,
  },
};
