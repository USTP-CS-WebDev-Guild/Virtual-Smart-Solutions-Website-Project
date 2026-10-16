export async function verifyResendWebhook(
  rawBody: string,
  headers: Headers,
  secret: string | undefined,
): Promise<boolean> {
  if (!secret) return false;
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (
    !id ||
    !timestamp ||
    !signatures ||
    id.length > 200 ||
    !/^\d{1,12}$/.test(timestamp) ||
    signatures.length > 2048
  )
    return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300)
    return false;
  try {
    const encoded = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    const key = Buffer.from(encoded, "base64");
    if (key.length < 16) return false;
    const { createHmac, timingSafeEqual } = await import("node:crypto");
    const expected = createHmac("sha256", key)
      .update(`${id}.${timestamp}.${rawBody}`)
      .digest();
    return signatures.split(" ").some((candidate) => {
      const [version, value] = candidate.split(",");
      if (version !== "v1" || !value) return false;
      const supplied = Buffer.from(value, "base64");
      return (
        supplied.length === expected.length &&
        timingSafeEqual(supplied, expected)
      );
    });
  } catch {
    return false;
  }
}
