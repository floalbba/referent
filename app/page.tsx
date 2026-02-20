"use client";

import { useState, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getFriendlyParseError, getFriendlyAiError, getFriendlyIllustrationError } from "@/lib/errors";

type ActionType = "about" | "theses" | "telegram" | null;

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [parsedContent, setParsedContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  async function getContent(): Promise<string | null> {
    if (parsedContent.trim()) return parsedContent;
    if (!url.trim()) return null;
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    });
    let data: { error?: string; content?: string } = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (!res.ok) {
      setError(getFriendlyParseError(res.status, data?.error));
      setResult("");
      return null;
    }
    setError("");
    const content = data.content ?? "";
    setParsedContent(content);
    return content;
  }

  const STATUS_LABELS: Record<NonNullable<ActionType> | "illustration", string> = {
    about: "Генерирую краткое описание…",
    theses: "Генерирую тезисы…",
    telegram: "Генерирую пост для Telegram…",
    illustration: "Создаю иллюстрацию…",
  };

  async function handleAction(type: NonNullable<ActionType>) {
    if (!url.trim()) {
      setError("Укажите URL статьи.");
      setResult("");
      return;
    }
    setLoading(true);
    setResult("");
    setError("");
    try {
      if (!parsedContent.trim()) {
        setStatus("Загружаю статью…");
      }
      const content = await getContent();
      if (!content) {
        setLoading(false);
        setStatus("");
        return;
      }
      setStatus(STATUS_LABELS[type]);
      const res = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, action: type, url: url.trim() }),
      });
      let data: { error?: string; result?: string } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        setError(getFriendlyAiError(res.status, data?.error));
        setResult("");
        return;
      }
      setError("");
      setResult(data.result ?? "");
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      setError("Не удалось выполнить запрос. Проверьте подключение к интернету.");
      setResult("");
    } finally {
      setLoading(false);
      setStatus("");
    }
  }

  async function handleIllustration() {
    if (!url.trim()) {
      setError("Укажите URL статьи.");
      setResult("");
      return;
    }
    setLoading(true);
    setResult("");
    setError("");
    try {
      if (!parsedContent.trim()) {
        setStatus("Загружаю статью…");
      }
      const content = await getContent();
      if (!content) {
        setLoading(false);
        setStatus("");
        return;
      }
      setStatus(STATUS_LABELS.illustration);
      const res = await fetch("/api/illustration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      let data: { error?: string; image?: string } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        setError(getFriendlyIllustrationError(res.status, data?.error));
        setResult("");
        return;
      }
      setError("");
      setResult(data.image ?? "");
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      setError("Не удалось выполнить запрос. Проверьте подключение к интернету.");
      setResult("");
    } finally {
      setLoading(false);
      setStatus("");
    }
  }

  function handleClear() {
    setUrl("");
    setResult("");
    setError("");
    setParsedContent("");
    setStatus("");
    setLoading(false);
  }

  async function handleCopy() {
    if (!result) return;
    if (result.startsWith("data:image")) return; // для изображений — кнопка «Скачать»
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Не удалось скопировать в буфер обмена.");
    }
  }

  const isImageResult = result.startsWith("data:image");

  function handleDownloadImage() {
    if (!result.startsWith("data:image")) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = "illustration.png";
    a.click();
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10 max-w-2xl mx-auto overflow-x-hidden">
      <h1 className="text-xl sm:text-2xl font-semibold text-slate-800 mb-6">
        Referent
      </h1>

      <label className="block text-sm font-medium text-slate-600 mb-2">
        URL англоязычной статьи
      </label>
      <input
        type="url"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setParsedContent("");
          setError("");
        }}
        placeholder="Введите URL статьи, например: https://example.com/article"
        className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
        disabled={loading}
      />
      <p className="mt-1.5 mb-6 text-xs text-slate-500">
        Укажите ссылку на англоязычную статью
      </p>

      <div className="space-y-4 mb-8">
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleAction("about")}
            disabled={loading}
            title="Краткое описание статьи в 2–3 предложениях"
            className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            О чем статья?
          </button>
          <button
            type="button"
            onClick={() => handleAction("theses")}
            disabled={loading}
            title="Основные мысли статьи по пунктам"
            className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            Тезисы
          </button>
          <button
            type="button"
            onClick={() => handleAction("telegram")}
            disabled={loading}
            title="Готовый пост для Telegram с кратким содержанием и ссылкой на источник"
            className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            Пост для Telegram
          </button>
          <button
            type="button"
            onClick={handleIllustration}
            disabled={loading}
            title="Генерация иллюстрации по содержанию статьи"
            className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            Иллюстрация
          </button>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleClear}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-600 font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Очистить
          </button>
        </div>
      </div>

      {status ? (
        <div className="mb-4 py-2 px-3 rounded-lg bg-slate-100 text-slate-600 text-sm">
          {status}
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-2">
        <label className="text-sm font-medium text-slate-600 shrink-0">Результат</label>
        {result ? (
          isImageResult ? (
            <button
              type="button"
              onClick={handleDownloadImage}
              className="self-start sm:self-auto text-sm px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
            >
              Скачать
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCopy}
              className="self-start sm:self-auto text-sm px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
            >
              {copied ? "Скопировано" : "Копировать"}
            </button>
          )
        ) : null}
      </div>
      <div
        ref={resultRef}
        className={`w-full min-w-0 min-h-[200px] max-h-[70vh] overflow-auto rounded-lg border border-slate-300 bg-white ${
          isImageResult ? "p-2 flex items-center justify-center" : "p-4"
        }`}
        aria-live="polite"
        aria-busy={loading}
      >
        {loading ? (
          <span className="text-slate-500 p-4">Загрузка…</span>
        ) : result ? (
          isImageResult ? (
            <img
              src={result}
              alt="Сгенерированная иллюстрация"
              className="max-w-full h-auto rounded-md object-contain"
            />
          ) : (
            <span className="text-slate-700 whitespace-pre-wrap break-words font-mono text-sm block">
              {result}
            </span>
          )
        ) : (
          <span className="text-slate-400 p-4 block">
            Введите URL и нажмите одну из кнопок.
          </span>
        )}
      </div>
    </main>
  );
}
