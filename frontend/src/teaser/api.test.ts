import { afterEach, expect, test, vi } from "vitest";
import { teaserRequest } from "./api";

afterEach(() => vi.unstubAllGlobals());

test("network failure names the unavailable backend", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  await expect(teaserRequest("/api/runs")).rejects.toThrow("Local backend unavailable");
});

test("proxy HTML is not a successful backend response", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html></html>", { status: 200 })));
  await expect(teaserRequest("/api/runs")).rejects.toThrow("Local backend unavailable");
});

test("mutations send bounded JSON and preserve server errors as text", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Approval changed" }), {
    status: 400, headers: { "Content-Type": "application/json" },
  }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(teaserRequest("/api/runs", {})).rejects.toThrow("Approval changed");
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", body: "{}" });
});