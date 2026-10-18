# tools

Спільний сервіс допоміжних інструментів гри. Зараз у ньому два: **сузір'я** (візерунок із зірок і ліній) та **кастомні колоди карт** (таро чи будь-які інші). Нові допоміжні інструменти додаються сюди ж окремим префіксом. Порт **3018** (`/api/tools/` через Nginx), схема БД `tools`.

## Ендпоінти

Шляхи — відносно кореня сервіса. Усі потребують `Authorization: Bearer <access-token>` (`requireAuth`, `JWT_ACCESS_SECRET`). Однакові для `/constellations` і `/decks`:

| Метод | Шлях | Опис | Відповідь |
|---|---|---|---|
| GET | `/` | список: власні + публічні (адмін бачить усі). `?scope=mine` лише власні, `?scope=public` публічні чужі, `?search=` за назвою | `200 { items }` — без важкого `data`, зі стислим підсумком |
| POST | `/` | створити (будь-який авторизований) | `201 { item }` / `400` |
| GET | `/:id` | один запис із `data` | `200 { item }` / `404` (не існує або чужий приватний) |
| PUT | `/:id` | повна заміна полів; `is_public` необов'язковий (без нього лишається як був) | `200 { item }` / `400` / `403` / `404` |
| DELETE | `/:id` | видалити | `200 { message }` / `403` / `404` |
| GET | `/:id/export` | файл експорту | `200` JSON без id, власника й публічності, з тегом `type` |
| POST | `/import` | файл експорту або масив (до 50); усе або нічого; імпортоване завжди приватне | `201 { imported, items }` / `400` |

Читати може власник, будь-хто (якщо `is_public`) та адмін; писати — власник і адмін.

### Сузір'я (`/constellations`)

Тіло: `{ name, description?, is_public?, data: { stars, lines } }`.

- `stars`: `[{ id, x, y, size, name, description }]` — `size` 1, 2 або 3, до 200 зірок; `id` унікальний у межах документа.
- `lines`: `[{ a, b }]` — `a`/`b` це `id` зірок, до 500; лінія A–B і B–A однакові (дублі відкидаються), лінія саму до себе — `400`.
- У списку замість `data` приходить `preview` (лише `id/x/y/size` зірок і лінії для міні-прев'ю) та `stars_count`, `lines_count`.

### Колоди (`/decks`)

Тіло: `{ name, description?, is_public?, back_image_url?, data: { suits, ranks, cards } }`.

- `suits`: `[{ id, name, image_url }]` (до 12), `ranks`: `[{ id, name }]` (до 60).
- `cards`: `[{ id, suit_id|null, rank_id|null, name, image_url }]` (до 200). Карти без масті (наприклад, старші аркани) мають `suit_id: null`. Карти зберігаються явно, а не як «масть × номінал», щоб кожній можна було дати власні назву й зображення.
- Зображення — лише `/uploads/...` (завантаження через media, `entity_type=deck-card`) або `https://`.
- У списку: `back_image_url`, `cards_count`, `suits_count`.

## Схема БД

Міграція `database/migrations/100-tools-service.sql`. Таблиці `tools.constellations` і `tools.decks`: `id`, `created_by` (id з `auth.users`, без FK між схемами), `name`, `description`, `data JSONB`, `is_public`, `created_at`, `updated_at`; у колод ще `back_image_url`. Зірки/лінії/карти лежать у `data` цілим документом — їх завжди читають і пишуть разом, а експорт/імпорт лишається тривіальним. Структуру `data` перевіряє сервіс (`src/lib/*-data.js`), не БД.

Читання `auth.users` (ім'я власника у списку) — той самий міжсхемний `JOIN`, що в інших сервісах.

## Змінні оточення

Спільний `.env`: `POSTGRES_*`, `JWT_ACCESS_SECRET`, `FRONTEND_URL`; власна — `PORT` (3018).

## Тести

Jest, без БД (моки `config/db` і моделей):

```bash
docker exec walp-tools npx jest      # у запущеному dev-контейнері
cd services/tools && npm ci && npm test
```
