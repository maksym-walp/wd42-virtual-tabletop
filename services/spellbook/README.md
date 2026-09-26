# spellbook

Бекенд-сервіс книги заклинань: каталог заклинань та іменовані колекції заклинань (свої й публічні). Порт **3003**, проксується через Nginx на `/api/spellbook/`.

## Ендпоінти

Усі відповіді — JSON. Заклинання монтуються в корінь роутера, колекції — під `/collections` (монтується до заклинань, інакше `GET /:id` з `spell.routes.js` перехопив би `/collections`).

Токен передається як `Authorization: Bearer <access-token>` (`requireAuth` перевіряє його через `JWT_ACCESS_SECRET` і кладе payload у `req.user`, `req.user.sub` — id користувача). Без валідного токена — `401`.

### Заклинання (`/`)

| Метод | Шлях      | Авторизація | Тіло запиту | Відповідь |
|-------|-----------|-------------|-------------|-----------|
| GET   | `/`       | обов'язкова | — (query: `nature`, `spell_kind`, `ritual`, `complexity`, `tradition`, `search`, `sort`, `scope`) | `200 { spells: [...] }` — власні + публічні заклинання |
| GET   | `/:id`    | обов'язкова | — | `200 { spell }` (з `parent_spell` і `derived_spells`) / `404` якщо не знайдено або недоступне |
| GET   | `/:id/tree` | обов'язкова | — | `200 { nodes: [{ id, name, parent_spell_id, complexity, level_count }] }` — усе видиме дерево, до якого належить заклинання (корінь має `parent_spell_id = null`) / `404` |
| POST  | `/`       | обов'язкова | `{ name, magic_type, spell_kind?, mechanical_desc?, narrative_desc?, energy_cost?, action_time?, ritual?, duration_value?, duration_unit?, range_desc?, components?, is_public?, prerequisite_node_ids?, prerequisite_logic?, image_url?, complexity?, levels?, parent_spell_id?, derived_spell_ids? }` | `201 { spell }` / `400` якщо відсутнє `name` або зв'язки утворюють цикл |
| PUT   | `/:id`    | обов'язкова | ті самі поля, що й у `POST` | `200 { spell }` / `404` якщо не знайдено або належить іншому користувачу |
| DELETE| `/:id`    | обов'язкова | — | `200 { message }` / `404` якщо не знайдено або належить іншому користувачу |

Query-параметри `GET /`:
- `magic_type` — фільтр за школою магії (`arcana`/`elemental`/`integral`/`infernal`/`blight`);
- `spell_kind`, `ritual` — точний фільтр за відповідними колонками;
- `complexity` — одне чи кілька значень (`primitive`/`simple`/`medium`/`complex`/`extreme`); заклинання підходить, якщо будь-який його рівень має обрану складність;
- `tradition` — один чи кілька id традицій;
- `search` — пошук за назвою (`ILIKE %search%`);
- `sort` — `name` (типово), `action_time` або `energy_cost`, невідоме значення тихо falls back на `name`;
- `scope` — `canonical` (лише авторства адмінів) або `user` (усе інше); без параметра — без додаткового фільтра.

### Колекції (`/collections`)

| Метод | Шлях                          | Авторизація | Тіло запиту | Відповідь |
|-------|-------------------------------|-------------|-------------|-----------|
| GET   | `/collections/public/:id`     | без токена  | — | `200 { collection }` / `404` якщо не знайдено або не публічна |
| GET   | `/collections`                | обов'язкова | — (query: `search`, `scope`) | `200 { collections: [...] }` |
| GET   | `/collections/:id`            | обов'язкова | — | `200 { collection }` / `404` |
| POST  | `/collections`                | обов'язкова | `{ name, description?, is_public?, prerequisite_node_ids?, prerequisite_logic? }` | `201 { collection }` / `400` якщо відсутнє `name` |
| PUT   | `/collections/:id`            | обов'язкова | ті самі поля, що й у `POST` | `200 { collection }` / `404` якщо не знайдено або належить іншому користувачу |
| DELETE| `/collections/:id`            | обов'язкова | — | `200 { message }` / `404` |
| POST  | `/collections/:id/items`      | обов'язкова | `{ spell_id }` | `201 { item }` / `400` якщо відсутнє `spell_id` / `404` якщо колекцію (не власну) або заклинання (недоступне) не знайдено |
| DELETE| `/collections/:id/items/:itemId` | обов'язкова | — | `200 { message }` / `404` |

`collection.items` у відповіді — вкладений масив повних об'єктів заклинань (JSON-агрегація на боці БД), а не просто список id.

Помилки, що не є `400`/`404` (несподівані збої моделі/БД), не перехоплюються в контролерах — вони пролітають до глобального error-хендлера в `src/index.js`, який віддає `err.statusCode || 500`.

## Схема БД

Сервіс володіє схемою `spellbook` (створюється в `database/init/02-spellbook.sql`, доповнюється `database/migrations/20-collections.sql` та іншими міграціями):

- **`spellbook.spells`** — каталог заклинань: `id`, `user_id`, `name`, `magic_type` (CHECK: `arcana`/`elemental`/`integral`/`infernal`/`blight`), `spell_kind`, `mechanical_desc`, `narrative_desc`, `energy_cost`, `action_time` (1–3), `ritual` (`impossible`/`possible`/`required`), `duration_value`, `duration_unit`, `range_desc`, `components` (`TEXT[]`), `is_public`, `prerequisite_node_ids` (`UUID[]`, бере вузли з `skill_tree.nodes`), `prerequisite_logic` (`and`/`or`), `image_url`, `complexity` (CHECK: `primitive`/`simple`/`medium`/`complex`/`extreme` або `NULL`), `levels` (`JSONB`), `parent_spell_id` (FK → `spells`, `ON DELETE SET NULL` — «Потрібно вивчити»), `created_at`, `updated_at`.
  - **Дерево заклинань** — у заклинання максимум одне батьківське (`parent_spell_id`); «Похідні» обчислюються як заклинання, чий `parent_spell_id` вказує на це. `derived_spell_ids` у `POST`/`PUT` змінює `parent_spell_id` у рядках самих похідних — лише власних (або будь-яких для адміна); якщо поле відсутнє, похідні не змінюються. `validateLineage` не дає утворити цикл.
  - **Рівні** — хронологічні версії заклинання. Колонки рядка — це рівень 1; `levels` — масив рівнів 2..N, кожен — повний знімок полів `complexity`, `spell_kind`, `energy_cost`, `action_time`, `ritual`, `duration_value`, `duration_unit`, `range_desc`, `components`, `mechanical_desc`, `narrative_desc`, `lore_creator`, `lore_creator_npc_id` (нормалізується `normalizeLevels` у моделі). Назва, природа, зображення, видимість, традиції, колекції та вимоги дерева спільні для всіх рівнів. Фільтри/сортування (крім `complexity`) і лист персонажа працюють з рівнем 1.
- **`spellbook.collections`** — іменовані колекції заклинань: `id`, `user_id`, `name`, `description`, `is_public`, `prerequisite_node_ids`, `prerequisite_logic`, `created_at`, `updated_at`.
- **`spellbook.collection_items`** — зв'язка колекція↔заклинання: `id`, `collection_id` (FK → `collections`, `ON DELETE CASCADE`), `spell_id` (FK → `spells`, `ON DELETE CASCADE`), `created_at`, `UNIQUE (collection_id, spell_id)`.

Видимість: заклинання/колекція доступні, якщо `user_id` запитувача збігається з власником, або запис публічний (`is_public = true`). `is_owner`/`is_canonical` у відповідях моделі обчислюються приєднанням до `auth.users` (роль `admin` = канонічний контент).

## Змінні оточення

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — підключення до спільної БД (`src/config/db.js`).
- `JWT_ACCESS_SECRET` — перевірка access-токена в `requireAuth` (`src/middleware/auth.middleware.js`).
- `FRONTEND_URL` — дозволений origin для CORS (типово `http://localhost`).
- `PORT` — порт, на якому слухає сервіс (типово `3003`; у `docker-compose.yml` задається явно).

Повний список — у кореневому `.env.example`.

## Тести

```bash
cd services/spellbook
npm install
npm test
```

Тести — Jest, контролери й моделі мокають залежності (`jest.mock('../../models/...')` / `jest.mock('../../config/db')`), без підключення до реальної БД. Лежать поряд із кодом у `src/**/__tests__`.
