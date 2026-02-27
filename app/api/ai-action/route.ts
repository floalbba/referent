import { chatWithFallback } from "@/lib/openrouter";

const PROMPTS: Record<string, string> = {
  about:
    "Кратко (2–3 предложения) опиши, о чём эта статья. Ответ на русском.",
  theses:
    "Составь тезисы статьи (основные мысли по пунктам). Ответ на русском.",
  telegram:
    "Сделай пост для Telegram: краткое содержание, цепляющее начало, до ~500 символов. Ответ на русском.",
};

export async function POST(request: Request) {
  const raw = process.env.OPENROUTER_API_KEY ?? "";
  const apiKey = raw.trim().replace(/^["']|["']$/g, "").trim();
  if (!apiKey) {
    const message = process.env.VERCEL
      ? "Добавьте OPENROUTER_API_KEY в Vercel: Project → Settings → Environment Variables. Затем Deployments → Redeploy."
      : "API-ключ не найден. Добавьте OPENROUTER_API_KEY в .env.local и перезапустите dev-сервер.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  try {
    const body = await request.json();
    const content =
      typeof body?.content === "string" ? body.content.trim() : "";
    const action = body?.action;
    const url = typeof body?.url === "string" ? body.url.trim() : "";

    if (!content) {
      return NextResponse.json(
        { error: "Нет текста. Сначала нажмите «Получить статью»." },
        { status: 400 }
      );
    }

    const promptText = PROMPTS[action];
    if (!promptText) {
      return NextResponse.json(
        { error: "Неизвестное действие. Используйте: about, theses, telegram." },
        { status: 400 }
      );
    }

    const prompt = `${promptText}

Статья:

${content.slice(0, 100_000)}`;

    let result = await chatWithFallback(apiKey, [{ role: "user", content: prompt }]);

    if (!result) {
      return NextResponse.json(
        { error: "Пустой ответ от модели" },
        { status: 502 }
      );
    }

    if (action === "telegram" && url) {
      result = `${result}\n\nИсточник: ${url}`;
    }

    return NextResponse.json({ result });
  } catch (err: unknown) {
    const e = err as { status?: number };
    if (e?.status === 401) {
      return NextResponse.json(
        {
          error:
            "OpenRouter отклонил ключ. Проверьте OPENROUTER_API_KEY в .env.local (без кавычек и пробелов), перезапустите dev-сервер.",
        },
        { status: 401 }
      );
    }
    if (e?.status === 402) {
      return NextResponse.json(
        {
          error:
            "Недостаточно средств на счёте OpenRouter. Пополните баланс: https://openrouter.ai/settings/credits",
        },
        { status: 402 }
      );
    }
    if (e?.status === 429) {
      return NextResponse.json(
        {
          error:
            "Лимит запросов. Подождите минуту и попробуйте снова: https://openrouter.ai/settings/integrations",
        },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: "Сервис AI временно недоступен. Попробуйте позже." },
      { status: 502 }
    );
  }
}
