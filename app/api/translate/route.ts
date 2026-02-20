import { NextResponse } from "next/server";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "deepseek/deepseek-r1-0528:free";

export async function POST(request: Request) {
  const raw = process.env.OPENROUTER_API_KEY ?? "";
  const apiKey = raw.trim().replace(/^["']|["']$/g, "").trim();
  if (!apiKey) {
    const message = process.env.VERCEL
      ? "Перевод доступен только при локальном запуске (ключ в .env.local)."
      : "API-ключ не найден. Добавьте OPENROUTER_API_KEY в .env.local и перезапустите dev-сервер.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  try {
    const body = await request.json();
    const content =
      typeof body?.content === "string" ? body.content.trim() : "";
    if (!content) {
      return NextResponse.json(
        { error: "Нет текста для перевода. Сначала получите статью." },
        { status: 400 }
      );
    }

    const prompt = `Translate the following English article into Russian. Preserve paragraphs and structure. Do not add comments or explanations, only the translation.

Article:

${content.slice(0, 100_000)}`;

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(process.env.VERCEL_URL && {
          "HTTP-Referer": `https://${process.env.VERCEL_URL}`,
        }),
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 401) {
        return NextResponse.json(
          {
            error:
              "OpenRouter отклонил ключ. Проверьте OPENROUTER_API_KEY в .env.local (без кавычек и пробелов), перезапустите dev-сервер.",
          },
          { status: 401 }
        );
      }
      if (res.status === 402) {
        return NextResponse.json(
          {
            error:
              "Недостаточно средств на счёте OpenRouter. Пополните баланс: https://openrouter.ai/settings/credits",
          },
          { status: 402 }
        );
      }
      if (res.status === 429) {
        return NextResponse.json(
          {
            error:
              "Лимит запросов. Подождите минуту и попробуйте снова: https://openrouter.ai/settings/integrations",
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: `OpenRouter: ${res.status} ${errText}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const translated = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!translated) {
      return NextResponse.json(
        { error: "Пустой ответ от модели" },
        { status: 502 }
      );
    }

    return NextResponse.json({ translation: translated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка перевода";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
