import * as cheerio from "cheerio";
import { NextResponse } from "next/server";

const CONTENT_SELECTORS = [
  "article",
  "main",
  "[role='main']",
  ".post",
  ".post-content",
  ".content",
  ".entry-content",
  ".article-body",
  ".article-content",
  ".post-body",
  "#content",
  ".page-content",
];

function getText($: cheerio.CheerioAPI, el: cheerio.Element): string {
  return $(el).text().replace(/\s+/g, " ").trim();
}

function findLongestText($: cheerio.CheerioAPI, selector: string): string {
  let best = "";
  $(selector).each((_, el) => {
    const text = getText($, el);
    if (text.length > best.length) best = text;
  });
  return best;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json(
        { error: "Укажите URL статьи." },
        { status: 400 }
      );
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Ошибка загрузки: ${res.status} ${res.statusText}` },
        { status: 422 }
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Дата: <time datetime>, meta article:published_time, .date, .published и т.д.
    let date = "";
    const $time = $("time[datetime]").first();
    if ($time.length) {
      date = $time.attr("datetime") ?? $time.text().trim();
    }
    if (!date) {
      date =
        $('meta[property="article:published_time"]').attr("content") ??
        $('meta[name="date"]').attr("content") ??
        $('meta[name="publishdate"]').attr("content") ??
        $(".date").first().text().replace(/\s+/g, " ").trim() ??
        $(".published").first().text().replace(/\s+/g, " ").trim() ??
        $("[class*='date']").first().text().replace(/\s+/g, " ").trim() ??
        "";
    }

    // Заголовок: h1, og:title, <title>, .post-title, .entry-title
    let title = "";
    const $h1 = $("h1").first();
    if ($h1.length) title = $h1.text().replace(/\s+/g, " ").trim();
    if (!title) {
      title =
        $('meta[property="og:title"]').attr("content") ??
        $("title").first().text().replace(/\s+/g, " ").trim() ??
        $(".post-title").first().text().replace(/\s+/g, " ").trim() ??
        $(".entry-title").first().text().replace(/\s+/g, " ").trim() ??
        $(".article-title").first().text().replace(/\s+/g, " ").trim() ??
        "";
    }

    // Основной контент: первый непустой и достаточно длинный блок
    let content = "";
    for (const sel of CONTENT_SELECTORS) {
      content = findLongestText($, sel);
      if (content.length > 100) break;
    }
    if (!content || content.length < 50) {
      content = $("body").text().replace(/\s+/g, " ").trim();
    }
    if (content) {
      content = content.slice(0, 50_000);
    }

    return NextResponse.json({ date, title, content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка парсинга";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
