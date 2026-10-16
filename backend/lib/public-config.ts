export function isPublishableKey(value: string): boolean {
  if (value.startsWith('sb_publishable_')) return value.length > 20;
  if (value.startsWith('sb_secret_')) return false;
  try {
    return (
      JSON.parse(Buffer.from(value.split('.')[1] || '', 'base64url').toString()).role === 'anon'
    );
  } catch {
    return false;
  }
}
