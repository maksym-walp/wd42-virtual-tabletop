# admin

Адмін-панель сайту: редагування конфігів сайту (key/value(jsonb) у `admin.site_configs`), список користувачів і резервне копіювання всієї БД у JSON. Порт **3011**, проксується Nginx як `/api/admin/`.

## Ендпоінти (`/configs`)

Усі маршрути — лише для `role = 'admin'` (`src/middleware/requireAdmin.middleware.js`, підключений після звичайного `requireAuth`). Дозволених ключів наразі два: `weapon_types`, `weapon_grips` — інший `key` у `PUT` повертає `404`.

| Метод | Шлях | Тіло запиту | Відповідь |
|---|---|---|---|
| GET | `/configs` | — | `200 { configs: [{key, value, updated_at}, ...] }` |
| GET | `/configs/:key` | — | `200 { config }` / `404` якщо не знайдено |
| PUT | `/configs/:key` | `{ value: [{key, label}, ...] }` | `200 { config }` / `404` для невідомого `key` / `400` якщо `value` не непорожній масив `{key, label}` з унікальними `key` |

`value` — впорядкований масив `{key, label}`: `key` — внутрішнє значення, яке зберігається на записах (наприклад `equipment.weapons.weapon_type`), `label` — те, що бачить користувач. Адмін-панель на фронтенді сама генерує `key` з `label` при створенні нового елемента й більше його не змінює — існуючі записи каталогу посилаються саме на `key`.

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

`equipment`-сервіс (форма/фільтри зброї) читає `weapon_types`/`weapon_grips` напряму через cross-schema SQL (`services/equipment/src/models/catalog.model.js` `getWeaponOptions`, той самий підхід, що й читання `auth.users`/`spellbook.spells` звідти ж) — не через цей HTTP API. Цей сервіс лише обслуговує саму адмін-панель (список/редагування).

## Схема БД

`database/migrations/55-weapon-grip-multi-and-admin-configs.sql` створює схему `admin` і таблицю `admin.site_configs (key VARCHAR(50) PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ)`, засіяну поточними значеннями `weapon_types`/`weapon_grips`.

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
