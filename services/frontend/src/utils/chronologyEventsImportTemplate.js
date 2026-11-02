// Шаблон для POST /api/chronology/:id/events/import — JSONC (з коментарями),
// той самий прийом, що й у locationImportTemplate.js. Місяці (month_id) і
// супутники (moon_id) належать конкретному календарю, тож викликач передає
// months/moons цього відкритого календаря — шаблон друкує їхні id поруч з
// назвою, щоб не ходити за ними окремо. eventTypes — з адмін-панелі
// (chronologyApi.listEventTypes), для підказки ключів.
export function buildChronologyEventsImportTemplate({ months = [], moons = [], eventTypes = [] } = {}) {
  const monthList = months.length
    ? months.map((m) => `//     ${m.id} — ${m.name}`).join('\n')
    : '//     (у цьому календарі ще немає місяців)';
  const moonList = moons.length
    ? moons.map((m) => `//     ${m.id} — ${m.name}`).join('\n')
    : '//     (у цьому календарі ще немає супутників)';
  const typeList = eventTypes.length
    ? eventTypes.map((t) => `${t.key} (${t.label})`).join(', ')
    : '(ще не задані в адмін-панелі)';

  return `// Шаблон імпорту подій для POST /api/chronology/:id/events/import — у
// календар, що зараз відкрито. Масив об'єктів — кожен є окремою подією.
// Поле "id" ігнорується. Невалідні записи (без name/color, з чужим
// month_id тощо) просто пропускаються — відповідь рахує imported/skipped.
//
// Поля:
//   name               — обов'язкове, рядок
//   color              — обов'язкове, "#rrggbb" (ігнорується, якщо є event_type —
//                        колір тоді бере тип, але поле однаково мусить бути валідним)
//   event_type         — ключ типу події або null. Доступні зараз: ${typeList}
//   description        — рядок або null. Підтримує [[1d6]] і [текст](URL)
//   is_public          — true / false
//   year               — число або null
//   month_id           — id місяця ЦЬОГО календаря або null:
${monthList}
//   day                — число (день місяця) або null
//   recurrence         — один з: none, yearly, monthly, weekly, interval_days, lunar
//   recurrence_interval — додатне ціле — лише для interval_days ("кожні N днів")
//                          і lunar ("кожні N циклів супутника")
//   moon_id            — id супутника ЦЬОГО календаря — обов'язково для recurrence "lunar":
${moonList}
//   moon_phase         — число від 0 до 100 (не включно) — відсоток циклу супутника, лише для "lunar"
//   end_year/end_month_id/end_day — те саме, що year/month_id/day, для кінця тривалої події
//   duration_display   — один з: start, start_end, every_day, none
//   location_id        — uuid локації (сервіс maps) або null — взаємовиключне з region
//   region             — рядок (вільна назва місця) або null
//   participant_ids    — масив uuid персонажів-учасників (сервіс character-sheet) або []
//   campaign_id        — uuid кампанії або null (null — загальна лорна подія, видима всюди)
[
  {
    "name": "Приклад: Падіння Вірантії",
    "color": "#b03a2e",
    "event_type": null,
    "description": "Облога столиці Старого Легіону.",
    "is_public": true,
    "year": 600,
    "month_id": null,
    "day": null,
    "recurrence": "none",
    "recurrence_interval": null,
    "moon_id": null,
    "moon_phase": null,
    "end_year": null,
    "end_month_id": null,
    "end_day": null,
    "duration_display": "start",
    "location_id": null,
    "region": "Віранта",
    "participant_ids": [],
    "campaign_id": null
  }
]
`;
}
