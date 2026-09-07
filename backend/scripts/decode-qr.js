/**
 * Reads an existing bank QR and prints the .env values you need.
 *
 * HOW TO USE
 *   1. Open your banking app and show your merchant/receive QR.
 *   2. Scan it with any QR reader app that shows the RAW TEXT
 *      (not one that opens it as a link). The text starts with "0002".
 *   3. Paste that text here:
 *
 *        node scripts/decode-qr.js "00020101021229..."
 *
 * This does not contact your bank or send anything anywhere. It just splits
 * the string into its labelled parts, which is all a QR code ever was.
 */
const { crc16 } = require('../src/utils/emvqr');

const EMV_TAGS = {
  '00': 'Payload format indicator',
  '01': 'Point of initiation (11 = reusable, 12 = one-time)',
  '52': 'Merchant category code  -> QR_MCC',
  '53': 'Currency code (840 = USD, 116 = KHR)',
  '54': 'Amount',
  '58': 'Country                 -> QR_COUNTRY',
  '59': 'Merchant name           -> QR_MERCHANT_NAME',
  '60': 'Merchant city           -> QR_MERCHANT_CITY',
  '62': 'Additional data',
  '63': 'Checksum (CRC)',
};

function parse(payload) {
  const out = [];
  let i = 0;
  while (i < payload.length) {
    const tag = payload.slice(i, i + 2);
    const len = parseInt(payload.slice(i + 2, i + 4), 10);
    if (Number.isNaN(len)) break;
    out.push({ tag, value: payload.slice(i + 4, i + 4 + len) });
    i += 4 + len;
  }
  return out;
}

// Only trim the ends. Do NOT strip spaces inside — merchant names and cities
// legitimately contain them ("MY STORE", "PHNOM PENH"), and removing those
// shifts every field after them and breaks the checksum.
const payload = (process.argv[2] || '').replace(/[\r\n\t]/g, '').trim();
if (!payload) {
  console.error('Usage: node scripts/decode-qr.js "<the raw text from your bank QR>"');
  process.exit(1);
}

console.log('\n--- What is inside this QR ---\n');

const fields = parse(payload);
let merchantTag = null;
let acquirerId = null;
let accountId = null;

for (const { tag, value } of fields) {
  const isMerchantAccount = Number(tag) >= 26 && Number(tag) <= 51;
  const label = EMV_TAGS[tag] || (isMerchantAccount ? 'Merchant account block' : 'Other');

  console.log(`  ${tag}  ${label}`);

  if (isMerchantAccount) {
    merchantTag = merchantTag ?? tag;
    for (const sub of parse(value)) {
      const subLabel =
        sub.tag === '00' ? 'acquirer   -> QR_ACQUIRER_ID' :
        sub.tag === '01' ? 'account id -> QR_ACCOUNT_ID' : 'extra';
      console.log(`        ${sub.tag}  ${subLabel}: ${sub.value}`);
      if (sub.tag === '00' && !acquirerId) acquirerId = sub.value;
      if (sub.tag === '01' && !accountId) accountId = sub.value;
    }
  } else {
    console.log(`        value: ${value}`);
  }
}

// Verify the checksum, so you know you copied the whole string.
const body = payload.slice(0, -4);
const expected = crc16(body);
const actual = payload.slice(-4).toUpperCase();
console.log(`\n  Checksum: ${actual} ${expected === actual ? 'valid' : `INVALID (expected ${expected}) — the text was cut off or mistyped`}`);

const nameField = fields.find((f) => f.tag === '59');
const cityField = fields.find((f) => f.tag === '60');
const mccField = fields.find((f) => f.tag === '52');
const countryField = fields.find((f) => f.tag === '58');

console.log('\n--- Paste these into backend/.env ---\n');
console.log(`QR_ACQUIRER_ID=${acquirerId || '(not found)'}`);
console.log(`QR_ACCOUNT_ID=${accountId || '(not found)'}`);
console.log(`QR_MERCHANT_TAG=${merchantTag || '29'}`);
console.log(`QR_MERCHANT_NAME=${nameField ? nameField.value : 'MY STORE'}`);
console.log(`QR_MERCHANT_CITY=${cityField ? cityField.value : 'PHNOM PENH'}`);
console.log(`QR_MCC=${mccField ? mccField.value : '5499'}`);
console.log(`QR_COUNTRY=${countryField ? countryField.value : 'KH'}`);
console.log('\nThen restart the backend and test a real scan before your demo.\n');
