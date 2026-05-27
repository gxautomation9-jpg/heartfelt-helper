import { createFileRoute } from "@tanstack/react-router";

// Free, unlimited cloud TTS proxy backed by Google Translate's public TTS
// endpoint. Used as a fallback when the browser has no local voice for the
// requested language (most commonly Arabic on Windows / Linux Chrome) and as
// an always-available "cloud" voice option in the picker.
//
// Each request is capped to ~200 chars (matches our speech chunk size).
// Voice ids follow `cloud:<lang>-<region>-<gender>` — region defaults to a
// sensible accent (Egyptian for Arabic, US for English).

const LANG_MAP: Record<string, string> = {
  "cloud:ar-eg-female": "ar",
  "cloud:ar-eg-male": "ar",
  "cloud:ar-sa-female": "ar",
  "cloud:en-us-female": "en",
  "cloud:en-us-male": "en",
  "cloud:en-gb-female": "en-gb",
};

async function fetchTranslateTts(text: string, tl: string): Promise<Response> {
  const url = new URL("https://translate.google.com/translate_tts");
  url.searchParams.set("ie", "UTF-8");
  url.searchParams.set("q", text);
  url.searchParams.set("tl", tl);
  url.searchParams.set("client", "tw-ob");
  url.searchParams.set("ttsspeed", "1");

  return fetch(url.toString(), {
    headers: {
      // Required — Google blocks default fetch UA.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Referer: "https://translate.google.com/",
      Accept: "audio/mpeg, audio/*;q=0.9, */*;q=0.5",
    },
  });
}

async function handleTts(text: string, voice: string): Promise<Response> {
  const trimmed = (text || "").trim().slice(0, 200);
  if (!trimmed) {
    return Response.json({ error: "empty_text" }, { status: 400 });
  }
  const tl = LANG_MAP[voice] ?? (voice.startsWith("cloud:ar") ? "ar" : "en");

  try {
    const upstream = await fetchTranslateTts(trimmed, tl);
    if (!upstream.ok || !upstream.body) {
      return Response.json(
        { error: "upstream_failed", status: upstream.status },
        { status: 502 },
      );
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    return Response.json(
      { error: "tts_failed", message: String((err as Error)?.message ?? err) },
      { status: 500 },
    );
  }
}

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const text = url.searchParams.get("text") ?? "";
        const voice = url.searchParams.get("voice") ?? "cloud:en-us-female";
        return handleTts(text, voice);
      },
      POST: async ({ request }) => {
        let body: { text?: string; voice?: string } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          /* fall through */
        }
        return handleTts(body.text ?? "", body.voice ?? "cloud:en-us-female");
      },
    },
  },
});
