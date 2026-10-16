type BodyResult = { ok: true; text: string } | { ok: false; status: number };

// Enforce the real byte count while reading. Content-Length is only a hint.
// A stalled or dishonest client must not make us buffer an unlimited body.
export async function readBodyText(
  request: Request,
  maxBytes: number,
  timeoutMs = 10_000,
): Promise<BodyResult> {
  const declared = request.headers.get("Content-Length");
  if (
    declared !== null &&
    (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)))
  )
    return { ok: false, status: 400 };
  if (Number(declared || 0) > maxBytes) return { ok: false, status: 413 };
  if (!request.body) return { ok: true, text: "" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let emptyReads = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("body_timeout")), timeoutMs);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      if (!value.byteLength) {
        if (++emptyReads > 16) return { ok: false, status: 400 };
        continue;
      }
      total += value.byteLength;
      if (total > maxBytes) return { ok: false, status: 413 };
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      ok: true,
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    };
  } catch (error) {
    return {
      ok: false,
      status:
        error instanceof Error && error.message === "body_timeout" ? 408 : 400,
    };
  } finally {
    clearTimeout(timer);
    // Do not wait for an uncooperative producer's cancel callback.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
