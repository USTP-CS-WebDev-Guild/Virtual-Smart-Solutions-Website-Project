import { afterEach, describe, expect, it, vi } from "vitest";
import { readBodyText } from "../../backend/http/body";
import { parseBody } from "../../backend/http/responses";

function streamed(chunks: Uint8Array[], cancel = vi.fn()) {
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const value = chunks.shift();
      if (value) controller.enqueue(value);
      else controller.close();
    },
    cancel,
  });
  return new Request("https://site.example/api/inquiries", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
}
describe("bounded request streaming", () => {
  afterEach(() => vi.useRealTimers());
  it("rejects actual streamed bytes even without Content-Length and cancels the reader", async () => {
    const cancel = vi.fn();
    const request = streamed(
      [new Uint8Array(5), new Uint8Array(5), new Uint8Array(100)],
      cancel,
    );
    expect(await readBodyText(request, 8)).toEqual({ ok: false, status: 413 });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("bounds UTF-8 bytes rather than characters", async () => {
    expect(
      await readBodyText(streamed([new TextEncoder().encode("éé")]), 3),
    ).toEqual({ ok: false, status: 413 });
  });
  it("stops an empty-chunk producer before it can monopolize the microtask queue", async () => {
    const cancel = vi.fn();
    const request = streamed(
      Array.from({ length: 20 }, () => new Uint8Array()),
      cancel,
    );
    expect(await readBodyText(request, 100)).toEqual({
      ok: false,
      status: 400,
    });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("rejects malformed UTF-8 and dishonest Content-Length", async () => {
    expect(await readBodyText(streamed([new Uint8Array([0xff])]), 20)).toEqual({
      ok: false,
      status: 400,
    });
    const request = new Request("https://site.example", {
      method: "POST",
      body: "{}",
      headers: { "Content-Length": "-1" },
    });
    expect(await readBodyText(request, 20)).toEqual({ ok: false, status: 400 });
  });
  it("times out a stalled producer and releases resources", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const request = new Request("https://site.example", {
      method: "POST",
      duplex: "half",
      body: new ReadableStream({ cancel }),
    } as RequestInit);
    const result = readBodyText(request, 100, 20);
    await vi.advanceTimersByTimeAsync(21);
    expect(await result).toEqual({ ok: false, status: 408 });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("requires JSON content type before parsing a mutation", async () => {
    const response = await parseBody(
      new Request("https://site.example", { method: "POST", body: "{}" }),
      100,
    );
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(415);
  });
});
