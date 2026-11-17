import crypto from 'node:crypto';

const DEFAULT_WEBHOOK_SECRET = 'whsec_sandbox_test_secret_change_in_prod';
const DEFAULT_SESSION_SECRET = 'sess_sandbox_test_secret_change_in_prod';

export function getWebhookSecret(): string {
  return process.env.WEBHOOK_SECRET || DEFAULT_WEBHOOK_SECRET;
}

export function getSessionSecret(): string {
  return process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET;
}

export function hashPassword(password: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto
    .pbkdf2Sync(password, actualSalt, 100000, 64, 'sha512')
    .toString('hex');
  return `${actualSalt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derivedHex = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedBuffer = Buffer.from(derivedHex, 'hex');
  if (keyBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
}

export function generateSessionToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashSessionToken(rawToken: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(rawToken)
    .digest('hex');
}

/**
 * Signs a webhook payload using the format: `t=<timestamp>,v1=<hmac_hex>`
 */
export function signWebhookPayload(
  rawBody: string,
  timestampSeconds: number = Math.floor(Date.now() / 1000),
  secret: string = getWebhookSecret()
): string {
  const signedContent = `${timestampSeconds}.${rawBody}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedContent, 'utf8')
    .digest('hex');
  return `t=${timestampSeconds},v1=${signature}`;
}

/**
 * Verifies a webhook signature header `t=<timestamp>,v1=<hmac_hex>`
 * Enforces timing-safe comparison and replay window tolerance (default 300s).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string = getWebhookSecret(),
  toleranceSeconds: number = 300,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): { valid: boolean; reason?: string } {
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return { valid: false, reason: 'En-tête de signature X-Webhook-Signature manquant' };
  }

  const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.trim().split('=');
    if (k && v) acc[k] = v;
    return acc;
  }, {});

  const timestampStr = parts['t'];
  const providedSig = parts['v1'];

  if (!timestampStr || !providedSig) {
    return { valid: false, reason: 'Format de signature invalide (attendu: t=...,v1=...)' };
  }

  const timestamp = Number(timestampStr);
  if (!Number.isInteger(timestamp)) {
    return { valid: false, reason: 'Horodatage de signature invalide' };
  }

  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return { valid: false, reason: 'Horodatage hors de la fenêtre de tolérance anti-rejeu' };
  }

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  try {
    const providedBuf = Buffer.from(providedSig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (
      providedBuf.length !== expectedBuf.length ||
      providedSig.length !== expectedSig.length
    ) {
      return { valid: false, reason: 'Signature cryptographique HMAC invalide' };
    }
    const matches = crypto.timingSafeEqual(providedBuf, expectedBuf);
    return matches
      ? { valid: true }
      : { valid: false, reason: 'Signature cryptographique HMAC invalide' };
  } catch {
    return { valid: false, reason: 'Erreur lors de la vérification de la signature' };
  }
}
