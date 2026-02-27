/**
 * OpenRouter API с fallback по моделям при 429.
 * Основная: openai/gpt-oss-120b:free → при 429 retry через 3 с → meta-llama/llama-3.3-70b-instruct:free → openrouter/free.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODELS: readonly string[] = [
  "openai/gpt-oss-120b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openrouter/free",
];

export interface OpenRouterError {
  status: number;
  text: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function doRequest(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[]
): Promise<{ ok: boolean; status: number; data?: { content: string }; text: string }> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(process.env.VERCEL_URL && {
        "HTTP-Referer": `https://${process.env.VERCEL_URL}`,
      }),
    },
    body: JSON.stringify({ model, messages }),
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, text };
  }
  let content = "";
  try {
    const data = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
    content = data?.choices?.[0]?.message?.content?.trim() ?? "";
  } catch {
    /* ignore */
  }
  return { ok: true, status: res.status, data: { content }, text };
}

/**
 * Вызов OpenRouter с fallback при 429.
 * Возвращает текст ответа или выбрасывает OpenRouterError.
 */
export async function chatWithFallback(
  apiKey: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  let lastError: OpenRouterError | null = null;

  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    const result = await doRequest(apiKey, model, messages);

    if (result.ok && result.data?.content) {
      return result.data.content;
    }

    if (result.status !== 429) {
      const err: OpenRouterError = { status: result.status, text: result.text };
      throw err;
    }

    lastError = { status: 429, text: result.text };

    if (i === 0) {
      await sleep(3000);
      const retry = await doRequest(apiKey, model, messages);
      if (retry.ok && retry.data?.content) {
        return retry.data.content;
      }
      if (retry.status !== 429) {
        const err: OpenRouterError = { status: retry.status, text: retry.text };
        throw err;
      }
      lastError = { status: 429, text: retry.text };
    }
  }

  throw lastError ?? { status: 429, text: "Rate limit" };
}
