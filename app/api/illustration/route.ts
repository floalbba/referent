import { NextResponse } from "next/server";
import { InferenceClient } from "@huggingface/inference";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "deepseek/deepseek-r1-0528:free";
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

    // 1. Генерация промпта для изображения через OpenRouter
    const promptForImage = `Create a short image generation prompt in English (max 150 words) for a text-to-image model like FLUX or Stable Diffusion. The prompt should capture the main visual idea, mood, and key elements of the article. Output ONLY the prompt, no explanations, no quotes.

Article:

${content.slice(0, 15_000)}`;

    const openRouterRes = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        ...(process.env.VERCEL_URL && {
          "HTTP-Referer": `https://${process.env.VERCEL_URL}`,
        }),
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: "user", content: promptForImage }],
      }),
    });

    if (!openRouterRes.ok) {
      return NextResponse.json(
        { error: "Не удалось создать промпт для изображения." },
        { status: 502 }
      );
    }

    const openRouterData = (await openRouterRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const imagePrompt =
      openRouterData?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!imagePrompt) {
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
