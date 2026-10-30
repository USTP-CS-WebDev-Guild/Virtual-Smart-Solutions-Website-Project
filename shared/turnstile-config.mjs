// Dashboard keys start with 0x. Cloudflare's 1x/2x/3x testing keys must
// never make a hosted production form or Auth endpoint appear protected.
export function isRealTurnstileSiteKey(value) {
  return typeof value === 'string' && /^0x[A-Za-z0-9_-]{20,98}$/.test(value) && !/^0x0+$/.test(value);
}

export function isRealTurnstileSecretKey(value) {
  return typeof value === 'string' && /^0x[A-Za-z0-9_-]{30,198}$/.test(value) && !/^0x0+$/.test(value);
}
