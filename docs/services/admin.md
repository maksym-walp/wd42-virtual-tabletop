# admin

Адмін-панель сайту: редагування конфігів сайту (key/value(jsonb) у `admin.site_configs`), список користувачів з керуванням ролями і резервне копіювання всієї БД у JSON. Порт **3011**, проксується Nginx як `/api/admin/`.

## Конфіги (`/configs`)

Усі маршрути — лише для `role = 'admin'` (`src/middleware/requireAdmin.middleware.js`, підключений після звичайного `requireAuth`). Дозволені ключі (`ALLOWED_KEYS` у `src/controllers/config.controller.js`): `weapon_types`, `weapon_grips`, `spell_kinds`, `conditions`, `currencies`, `magic_forms`, `character_races`, `event_types` — інший `key` у `PUT` повертає `404`.

| Метод | Шлях | Тіло запиту | Відповідь |
|---|---|---|---|
| GET | `/configs` | — | `200 { configs: [{key, value, updated_at}, ...] }` |
| GET | `/configs/:key` | — | `200 { config }` / `404` якщо не знайдено |
| PUT | `/configs/:key` | `{ value: [...] }` | `200 { config }` / `404` для невідомого `key` / `400` якщо `value` не пройшов валідацію ключа |

Базова форма `value` — впорядкований непорожній масив `{key, label}` з унікальними `key` (`^[a-z0-9_]+$`): `key` — внутрішнє значення, яке зберігається на записах (наприклад `equipment.weapons.weapon_type`), `label` — те, що бачить користувач. Адмін-панель на фронтенді сама генерує `key` з `label` при створенні нового елемента й більше його не змінює — існуючі записи посилаються саме на `key`. Деякі ключі мають розширену форму:

| Ключ | Що це | Додатково до `{key, label}` |
|---|---|---|
| `weapon_types`, `weapon_grips` | типи зброї та особливості зброї | — |
| `spell_kinds` | види заклинань | — (міграція 83) |
| `conditions` | стани персонажа (`key` = `type` у `conditions` листа) | набір ключів **фіксований** (`fatigue, illness, trauma`, міграція 109): редагуються лише `label` і `description` (до 2000 символів), `max_level` завжди `5`. Ефекти рівнів задає [character-sheet](character-sheet.md) (`src/rules/conditions.js`) |
| `currencies` | пари номіналів одного регіону | `description`; `high` і `low` — `{ key, name, metal? }` (ключі номіналів унікальні в усьому конфігу — це ключі в `money` персонажа); `convertible` (bool), `rate` (ціле ≥ 2, якщо `convertible`) |
| `magic_forms` | форми магії | набір ключів **фіксований** (`arcana, elemental, integral, pact, nature, blight` — CHECK у БД, міграція 93): редагуються лише `label` і `description` |
| `character_races` | які публічні раси компендіуму гравець може обрати при створенні персонажа (міграції 88, 95, 96) | **порожній масив коректний**; елемент — `{ race_id (UUID), is_main? (boolean, типово `true`; неосновні раси гравець бачить лише після «Інші народи»), bonus_characteristic?, bonus_value? (ненульове ціле від −10 до 10, типово 1 — бонус до 4 навичок характеристики), bonus_budget? (0–20), peoples: [{ people_id (UUID), skill_bonuses: [{ skill, value (ненульове ціле від −10 до 10) }] }] }`; не `{key, label}`. Існування й публічність записів компендіуму тут не перевіряються — [character-sheet](character-sheet.md) відсіює недоступні при читанні |
| `event_types` | типи подій хронології (міграція 103) | `color` (`#rrggbb`); порожній масив коректний — події тоді користуються власним кольором |

## Користувачі (`/users`)

Лише для адмінів (`requireAuth` + `requireAdmin` на весь роутер). Модель — `src/models/user.model.js`, читає й пише `auth.users` міжсхемно.

| Метод | Шлях | Тіло запиту | Відповідь |
|---|---|---|---|
| GET | `/users` | — | `200 { users: [{ id, email, username, role, is_active, created_at }] }` |
| PATCH | `/users/:id/role` | `{ role: 'user' \| 'game_master' \| 'admin' }` | `200 { user }` / `400` (невідома роль або спроба змінити власну роль) / `404` |

Адмін не може знизити роль самому собі — щоб не лишитися без жодного адміна. Нова роль потрапляє в access-токен користувача при наступному `/refresh` (≈15 хв без перелогіну).

## Бекап (`/backup`)

Лише для адмінів. Модель — `src/models/backup.model.js`, контролер — `src/controllers/backup.controller.js`.

| Метод | Шлях | Тіло запиту | Відповідь |
|---|---|---|---|
| GET | `/backup` | — | `200` zip: `manifest.json` + `data/<схема>.<таблиця>.json` для **кожної** таблиці БД |
| POST | `/backup/restore` | `multipart/form-data`, поле `files` (один або кілька `.zip`/`.json`) | `200 { mode, restored: [{table, rows, ignoredColumns}], cleared, skipped, warnings }` / `400` / `409` |

- Дамп робиться в одній `REPEATABLE READ` транзакції; JSON генерує сам Postgres (`json_agg`), тож дати/numeric/масиви не проходять через JS-типи.
- **Повне відновлення** — якщо серед файлів є `manifest.json` (тобто завантажено цілий архів): спорожнюються всі таблиці, навіть відсутні в бекапі. **Часткове** — лише окремі `<схема>.<таблиця>.json`: замінюються тільки вони.
- Відновлення — одна транзакція з `session_replication_role = replica` (FK-тригери вимкнені, тож порядок таблиць неважливий; потрібен суперюзер БД). Будь-яка помилка → повний відкат.
- Вставка через `json_populate_recordset`: колонки, яких уже нема в таблиці, ігноруються (`ignoredColumns`), відсутні в бекапі — отримують default.
- `public.schema_migrations` потрапляє в архів, але не відновлюється. Якщо в `manifest.migrations` є міграції, не застосовані в поточній БД, — `409`: спершу `database/migrate.sh`.
- Медіафайли (volume `media_data`) до бекапу не входять.
- Ліміт завантаження 200 МБ — узгоджений із `client_max_body_size` для `/api/admin/` у `nginx/*.conf`.

## Хто читає ці конфіги

Інші сервіси читають `admin.site_configs` напряму через cross-schema SQL, а не через цей HTTP API (той самий підхід, що й читання `auth.users`). Цей сервіс лише обслуговує саму адмін-панель (список/редагування).

| Сервіс | Ключі | Де |
|---|---|---|
| [equipment](equipment.md) | `weapon_types`, `weapon_grips` | `catalog.model.js` `getWeaponOptions` |
| [spellbook](spellbook.md) | `spell_kinds`, `magic_forms` | `spell.model.js` |
| [character-sheet](character-sheet.md) | `conditions`, `currencies`, `character_races` | `site-config.model.js`, `GET /config` |
| [chronology](chronology.md) | `event_types` | `chronology-event.model.js` `getEventTypes` |

## Схема БД

`database/migrations/55-weapon-grip-multi-and-admin-configs.sql` створює схему `admin` і таблицю `admin.site_configs (key VARCHAR(50) PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ)`. Початкові значення ключів засівають міграції: 55 (`weapon_types`, `weapon_grips`), 83 (`spell_kinds`), 88 (`conditions`, `currencies`, `character_races`; `conditions` перезаписано міграцією 109 — три стани), 93 (`magic_forms`), 103 (`event_types`). Нових міграцій для додавання ключа в `ALLOWED_KEYS` не потрібно — рядок створюється першим `PUT` (upsert).

## Змінні оточення

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — підключення до БД (`src/config/db.js`).
- `JWT_ACCESS_SECRET` — перевірка access-токена (`src/middleware/auth.middleware.js`).
- `FRONTEND_URL` — дозволений origin для CORS (`src/index.js`), за замовчуванням `http://localhost`.
- `PORT` — порт сервіса (`src/index.js`), за замовчуванням `3011`.

## Тести

```bash
cd services/admin
npm install
npm test
```
