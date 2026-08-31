/**
 * Builds an EMVCo merchant-presented QR payload (the standard behind KHQR /
 * Bakong, PromptPay, QRIS and most bank QRs in the region).
 *
 * The payload is a string of TLV blocks: a 2-digit tag, a 2-digit length, then
 * the value. Nested blocks use the same format inside their own value. The last
 * block is always a CRC over everything before it, so a scanner can tell a
 * corrupted code from a valid one.
 *
 * IMPORTANT FOR YOUR TEAM: the field values (especially the merchant account
 * tag and the account identifier) are issued by your bank. Generate one code
 * and scan it with the real banking app before trusting this in a demo. If your
 * bank does not publish those details, set QR_STATIC_IMAGE_URL in .env instead
 * and the app will show your saved QR picture with the amount beside it.
 */

/** CRC-16/CCITT-FALSE — the checksum EMVCo specifies. */
function crc16(input) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** One TLV block: tag + zero-padded length + value. */
function tlv(tag, value) {
  if (value === undefined || value === null || value === '') return '';
  const str = String(value);
  return `${tag}${String(str.length).padStart(2, '0')}${str}`;
}

const CURRENCY_CODES = { USD: '840', KHR: '116', THB: '764', VND: '704', EUR: '978' };

/**
 * @param {object} cfg     merchant details from .env
 * @param {number} amount  the amount to charge, or null for a static code
 * @param {string} billRef receipt number, shown in the customer's bank app
 */
function buildPayload(cfg, amount, billRef) {
  const dynamic = amount !== null && amount !== undefined && Number(amount) > 0;

  // Tag 29/30 wraps the bank-specific account details.
  const account =
    tlv('00', cfg.acquirerId) +      // e.g. kh.gov.nbc.bakong
    tlv('01', cfg.accountId);        // your account identifier

  let payload =
    tlv('00', '01') +                                   // format indicator
    tlv('01', dynamic ? '12' : '11') +                  // 12 = one-time, 11 = reusable
    tlv(cfg.merchantTag || '29', account) +
    tlv('52', cfg.merchantCategoryCode || '5499') +     // 5499 = misc food store
    tlv('53', CURRENCY_CODES[cfg.currency] || '840') +
    (dynamic ? tlv('54', Number(amount).toFixed(2)) : '') +
    tlv('58', cfg.countryCode || 'KH') +
    tlv('59', (cfg.merchantName || 'STORE').slice(0, 25)) +
    tlv('60', (cfg.merchantCity || 'PHNOM PENH').slice(0, 15)) +
    (billRef ? tlv('62', tlv('01', String(billRef).slice(0, 25))) : '');

  // The CRC covers the payload including its own tag and length, so append
  // "6304" first and checksum that.
  payload += '6304';
  return payload + crc16(payload);
}

module.exports = { buildPayload, crc16, tlv };
