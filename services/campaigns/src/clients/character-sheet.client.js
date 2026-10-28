// HTTP-клієнт до character-sheet — задокументований виняток із правила
// «сервіси не викликають один одного» (docs/conventions.md): правила станів,
// таймера й відпочинку живуть лише там, тож campaigns не дублює їх, а
// просить character-sheet застосувати. Заголовок Authorization пересилається
// як є — права (ГМ кампанії персонажа чи адмін) перевіряє сам character-sheet.

const TIMEOUT_MS = 5000;

function baseUrl() {
  return (process.env.CHARACTER_SHEET_URL || 'http://character-sheet:3005').replace(/\/+$/, '');
}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// Недоступність або таймаут → 502; відповідь-помилка character-sheet
// (400/403/404) прокидається з тим самим статусом і повідомленням.
async function request(method, path, { authorization, body } = {}) {
  let response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw httpError(502, 'Сервіс листів персонажів недоступний');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status >= 500) throw httpError(502, 'Сервіс листів персонажів повернув помилку');
    throw httpError(response.status, data?.message || 'Помилка сервісу листів персонажів');
  }
  return data;
}

const CharacterSheetClient = {
  // → { results: [{ character_id, name, skipped, hours_added, checks, fatigue_before, fatigue_after, timer }] }
  advanceTimer(authorization, { characterIds, hours, sourceKey }) {
    return request('POST', '/timer/advance', {
      authorization,
      body: { character_ids: characterIds, hours, ...(sourceKey ? { source_key: sourceKey } : {}) },
    });
  },
};

module.exports = CharacterSheetClient;
module.exports.TIMEOUT_MS = TIMEOUT_MS;
