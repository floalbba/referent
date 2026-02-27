import { NextResponse } from "next/server";
import { InferenceClient } from "@huggingface/inference";
import { chatWithFallback } from "@/lib/openrouter";

const HF_IMAGE_MODEL = "black-forest-labs/FLUX.1-schnell";

export async function POST(request: Request) {
  const openRouterKey = (
    process.env.OPENROUTER_API_KEY ?? ""
  ).trim().replace(/^["']|["']$/g, "");
  const hfKey = (
    process.env.HUGGINGFACE_API_KEY ?? ""
  ).trim().replace(/^["']|["']$/g, "");

  if (!openRouterKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY не настроен." },
      { status: 503 }
    );
  }
  if (!hfKey) {
    return NextResponse.json(
      { error: "HUGGINGFACE_API_KEY не настроен. Добавьте в .env.local (ключ с huggingface.co/settings/tokens, права Inference Providers)." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const content =
      typeof body?.content === "string" ? body.content.trim() : "";
    if (!content) {
      return NextResponse.json(
        { error: "Нет текста статьи. Сначала загрузите статью." },
        { status: 400 }
      );
    }

    // 1. Генерация промпта для изображения через OpenRouter (с fallback при 429)
    const promptForImage = `Create a short image generation prompt in English (max 150 words) for a text-to-image model like FLUX or Stable Diffusion. The prompt should capture the main visual idea, mood, and key elements of the article. Output ONLY the prompt, no explanations, no quotes.

Article:

${content.slice(0, 15_000)}`;

    let imagePrompt: string;
    try {
      imagePrompt = await chatWithFallback(openRouterKey, [
        { role: "user", content: promptForImage },
      ]);
    } catch (err: unknown) {
      const e = err as { status?: number };
      if (e?.status === 401) {
        return NextResponse.json(
          { error: "Неверный OPENROUTER_API_KEY. Проверьте .env.local." },
          { status: 401 }
        );
      }
      if (e?.status === 402) {
        return NextResponse.json(
          { error: "Недостаточно средств на OpenRouter. Пополните баланс." },
          { status: 402 }
        );
      }
      if (e?.status === 429) {
        return NextResponse.json(
          { error: "Лимит запросов OpenRouter. Подождите минуту." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Не удалось создать промпт для изображения." },
        { status: 502 }
      );
    }

    if (!imagePrompt?.trim()) {
      return NextResponse.json(
        { error: "Пустой промпт от модели." },
        { status: 502 }
      );
    }

    // 2. Генерация изображения через Hugging Face Inference Providers (FLUX.1-schnell)
    const client = new InferenceClient(hfKey);
    const dataUrl = await client.textToImage(
      {
        model: HF_IMAGE_MODEL,
        inputs: imagePrompt.slice(0, 1000),
        provider: "auto",
      },
      { outputType: "dataUrl" }
    );

    if (!dataUrl || typeof dataUrl !== "string") {
      return NextResponse.json(
        { error: "Hugging Face не вернул изображение." },
        { status: 502 }
      );
    }

    return NextResponse.json({ image: dataUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    let errMsg = "Произошла ошибка при генерации иллюстрации.";
    let status = 502;
    if (msg.includes("401") || msg.includes("Unauthorized")) {
      errMsg = "Неверный HUGGINGFACE_API_KEY. Проверьте .env.local и права токена (Inference Providers).";
      status = 401;
    } else if (msg.includes("402") || msg.includes("credits") || msg.includes("insufficient")) {
      errMsg = "Недостаточно кредитов Hugging Face. Пополните баланс на huggingface.co/settings/billing.";
      status = 402;
    } else if (msg.includes("410") || msg.includes("Gone")) {
      errMsg = "Модель больше не доступна. Обновите приложение.";
      status = 410;
    } else if (msg.includes("timeout") || msg.includes("AbortError")) {
      errMsg = "Превышено время ожидания. Генерация изображения заняла слишком много времени.";
      status = 504;
    }
    return NextResponse.json(
      { error: errMsg },
      { status }
    );
  }
}
