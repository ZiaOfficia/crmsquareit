import "server-only";

/* Free, open-source AI through any OpenAI-compatible chat API.

   Pick one (first match wins):
   1. AI_BASE_URL / AI_API_KEY / AI_MODEL
                                  Any compatible server, e.g. OpenRouter's free models (https://openrouter.ai/api/v1).
   2. GROQ_API_KEY=...            Groq's free tier with an open-weight model (default openai/gpt-oss-120b,
                                  Apache-2.0). Free key: https://console.groq.com/keys
   3. Nothing set                 Ollama on this computer (https://ollama.com), model qwen2.5:7b
                                  (`ollama pull qwen2.5:7b`). Local development only.
   Groq retires models now and then; if the chosen one is gone we switch to the next open model it offers. */

type Provider = { name: string; baseUrl: string; apiKey?: string; model: string };

/** Open-weight chat models, best first, for when the configured one is retired. */
const OPEN_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b"];
let fallbackModel: string | null = null;

export function aiProvider(): Provider {
  const env = process.env;
  if (env.AI_BASE_URL)
    return { name: "custom", baseUrl: env.AI_BASE_URL.replace(/\/+$/, ""), apiKey: env.AI_API_KEY || env.GROQ_API_KEY, model: env.AI_MODEL || OPEN_MODELS[0] };
  if (env.GROQ_API_KEY) return { name: "Groq", baseUrl: "https://api.groq.com/openai/v1", apiKey: env.GROQ_API_KEY, model: fallbackModel || env.AI_MODEL || OPEN_MODELS[0] };
  return { name: "Ollama", baseUrl: "http://localhost:11434/v1", model: env.AI_MODEL || "qwen2.5:7b" };
}

export class AiError extends Error {}

/** Picks the best open model the server still offers, or null. */
async function findOpenModel(p: Provider): Promise<string | null> {
  try {
    const res = await fetch(`${p.baseUrl}/models`, { headers: p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}, signal: AbortSignal.timeout(15_000), cache: "no-store" });
    const ids = new Set(((await res.json()) as { data?: { id: string }[] }).data?.map((m) => m.id) ?? []);
    return OPEN_MODELS.find((m) => ids.has(m) && m !== p.model) ?? null;
  } catch {
    return null;
  }
}

/** Sends a chat to the model and returns its reply parsed as JSON. */
export async function chatJson(system: string, user: string, opts: { temperature?: number; maxTokens?: number } = {}, retried = false): Promise<unknown> {
  const p = aiProvider();
  let res: Response;
  try {
    res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}) },
      body: JSON.stringify({
        model: p.model,
        temperature: opts.temperature ?? 0.3,
        // Reasoning models (gpt-oss) spend part of this thinking before they answer.
        max_tokens: opts.maxTokens ?? 12000,
        ...(p.model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    });
  } catch (e) {
    if (p.name === "Ollama")
      throw new AiError("AI isn't set up yet. Add a free GROQ_API_KEY to the .env file (get one at console.groq.com/keys), or install Ollama and run “ollama pull qwen2.5:7b”.");
    if (e instanceof Error && e.name === "TimeoutError") throw new AiError("The AI took too long to answer. Try again, or shorten the notes.");
    throw new AiError(`Couldn't reach the AI service (${p.name}). Check the internet connection and try again.`);
  }
  if (res.status === 404 && p.name !== "Ollama" && !retried) {
    const next = await findOpenModel(p);
    if (next) {
      console.warn(`[ai] ${p.name}: model ${p.model} unavailable, switching to ${next}`);
      fallbackModel = next;
      return chatJson(system, user, opts, true);
    }
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) throw new AiError(`The AI key was rejected by ${p.name}. Check GROQ_API_KEY / AI_API_KEY in .env.`);
    if (res.status === 429) throw new AiError("The free AI limit was reached for the moment. Wait a minute and try again.");
    if (res.status === 404 && p.name === "Ollama") throw new AiError(`Ollama doesn't have the model “${p.model}”. Run: ollama pull ${p.model}`);
    console.error(`[ai] ${p.name} ${res.status}: ${body.slice(0, 500)}`);
    throw new AiError(`The AI service returned an error (${res.status}). Try again in a moment.`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? "";
  return parseJsonLoose(text);
}

/** Models sometimes wrap JSON in ``` fences or add a sentence around it. */
function parseJsonLoose(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new AiError("The AI's answer wasn't in the expected format. Please try again.");
  }
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** Turns a failed response into a friendly AiError (same wording as chatJson). */
async function failure(p: Provider, res: Response): Promise<AiError> {
  const body = await res.text().catch(() => "");
  if (res.status === 401 || res.status === 403) return new AiError(`The AI key was rejected by ${p.name}. Check GROQ_API_KEY / AI_API_KEY in .env.`);
  if (res.status === 429) return new AiError("The free AI limit was reached for the moment. Wait a minute and try again.");
  if (res.status === 404 && p.name === "Ollama") return new AiError(`Ollama doesn't have the model “${p.model}”. Run: ollama pull ${p.model}`);
  console.error(`[ai] ${p.name} ${res.status}: ${body.slice(0, 500)}`);
  return new AiError(`The AI service returned an error (${res.status}). Try again in a moment.`);
}

/**
 * Streams a chat reply as plain text. Throws AiError before the stream starts
 * if the provider can't be reached or refuses the request.
 */
export async function chatStream(messages: ChatMessage[], opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {}, retried = false): Promise<ReadableStream<Uint8Array>> {
  const p = aiProvider();
  let res: Response;
  try {
    res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}) },
      body: JSON.stringify({
        model: p.model,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 4000,
        ...(p.model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
        stream: true,
        messages,
      }),
      signal: opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(90_000)]) : AbortSignal.timeout(90_000),
      cache: "no-store",
    });
  } catch (e) {
    if (p.name === "Ollama")
      throw new AiError("AI isn't set up yet. Add a free GROQ_API_KEY to the environment (get one at console.groq.com/keys), or install Ollama and run “ollama pull qwen2.5:7b”.");
    if (e instanceof Error && e.name === "TimeoutError") throw new AiError("The AI took too long to answer. Try again.");
    throw new AiError(`Couldn't reach the AI service (${p.name}). Check the internet connection and try again.`);
  }
  if (res.status === 404 && p.name !== "Ollama" && !retried) {
    const next = await findOpenModel(p);
    if (next) {
      console.warn(`[ai] ${p.name}: model ${p.model} unavailable, switching to ${next}`);
      fallbackModel = next;
      return chatStream(messages, opts, true);
    }
  }
  if (!res.ok || !res.body) throw await failure(p, res);

  // Server-sent events: "data: {json}\n\n" … "data: [DONE]". Pass on only the answer text.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
        if (done) {
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        let out = "";
        for (const line of lines) {
          const data = line.trim();
          if (!data.startsWith("data:")) continue;
          const json = data.slice(5).trim();
          if (json === "[DONE]") continue;
          try {
            const delta = (JSON.parse(json) as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content;
            if (delta) out += delta;
          } catch {
            /* ignore keep-alive or partial lines */
          }
        }
        if (out) {
          controller.enqueue(encoder.encode(out));
          return;
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}
