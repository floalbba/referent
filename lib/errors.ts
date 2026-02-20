/**
 * Маппинг ошибок API в дружественные сообщения на русском.
 * Сырые тексты из API не показываются пользователю.
 */

export function getFriendlyParseError(status: number, errorCode?: string): string {
  if (status === 400) {
    return "Укажите URL статьи.";
  }
  if (errorCode === "ARTICLE_LOAD_FAILED" || status === 422 || status === 500) {
    return "Не удалось загрузить статью по этой ссылке.";
  }
  return "Не удалось загрузить статью по этой ссылке.";
}

const AI_FRIENDLY_MESSAGES: Record<number, string> = {
  400: "Нет текста для обработки. Сначала загрузите статью.",
  401: "Проблема с API-ключом. Проверьте настройки в .env.local или Vercel.",
  402: "Недостаточно средств. Пополните баланс OpenRouter.",
  429: "Слишком много запросов. Подождите минуту и попробуйте снова.",
  500: "Произошла ошибка. Попробуйте позже.",
  502: "Сервис AI временно недоступен. Попробуйте позже.",
  503: "API-ключ не настроен. Добавьте OPENROUTER_API_KEY в настройках.",
};

export function getFriendlyAiError(status: number, apiError?: string): string {
  const mapped = AI_FRIENDLY_MESSAGES[status];
  if (mapped) return mapped;
  // Используем сообщение от API только если оно похоже на дружественное (кириллица)
  if (apiError && /[\u0400-\u04FF]/.test(apiError)) {
    return apiError;
  }
  return "Произошла ошибка. Попробуйте позже.";
}
