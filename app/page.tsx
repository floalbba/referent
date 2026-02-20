"use client";

import { useState } from "react";

type ActionType = "about" | "theses" | "telegram" | null;

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState("");
  const [parsedContent, setParsedContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function getContent(): Promise<string | null> {
    if (parsedContent.trim()) return parsedContent;
    if (!url.trim()) return null;
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setResult(data?.error ?? `Ошибка ${res.status}`);
      return null;
    }
    const content = data.content ?? "";
    setParsedContent(content);
    return content;
  }

  async function handleAction(type: ActionType) {
    if (!url.trim()) {
      setResult("Введите URL статьи.");
      return;
    }
    setLoading(true);
    setResult("");
    try {
      const content = await getContent();
      if (!content) {
        setLoading(false);
        return;
      }
      const res = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, action: type, url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(data?.error ?? `Ошибка ${res.status}`);
        return;
      }
      setResult(data.result ?? "");
    } catch (e) {
      setResult("Ошибка запроса: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">
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
        }}
        placeholder="https://example.com/article"
        className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent mb-6"
        disabled={loading}
      />

      <div className="flex flex-wrap gap-3 mb-8">
        <button
          type="button"
          onClick={() => handleAction("about")}
          disabled={loading}
          className="px-4 py-2.5 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          О чем статья?
        </button>
        <button
          type="button"
          onClick={() => handleAction("theses")}
          disabled={loading}
          className="px-4 py-2.5 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Тезисы
        </button>
        <button
          type="button"
          onClick={() => handleAction("telegram")}
          disabled={loading}
          className="px-4 py-2.5 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Пост для Telegram
        </button>
      </div>

      <label className="block text-sm font-medium text-slate-600 mb-2">
        Результат
      </label>
      <div
        className="w-full min-h-[200px] max-h-[60vh] overflow-auto p-4 rounded-lg border border-slate-300 bg-white text-slate-700 whitespace-pre-wrap break-words font-mono text-sm"
        aria-live="polite"
        aria-busy={loading}
      >
        {loading ? (
          <span className="text-slate-500">Загрузка…</span>
        ) : result ? (
          result
        ) : (
          <span className="text-slate-400">
            Введите URL и нажмите одну из кнопок.
          </span>
        )}
      </div>
    </main>
  );
}
