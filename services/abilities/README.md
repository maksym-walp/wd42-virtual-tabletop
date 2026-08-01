# abilities

Сервіс "Вміння та маневри" — власні та канонічні (ГМ) записи вмінь (за
архетипами) і бойових маневрів, плюс уніфіковані колекції (набори), якими
можна ділитись через публічне посилання і які можуть містити вміння й
маневри одночасно. Порт **3009** (`/api/abilities/` через Nginx).

Маневри влилися в цей сервіс з окремого `services/maneuvers` міграцією
`52-merge-maneuvers-into-abilities.sql` — таблиця `maneuvers.entries` стала
`abilities.maneuvers`, а колишні `maneuvers.collections`/`collection_items`
злилися в уже існуючі `abilities.collections`/`collection_items`. Вміння й
маневри лишаються окремими моделями/контролерами (`ability.model.js` vs
`maneuver.model.js`) — вони мають по-справжньому різні поля (`archetypes`
vs `duration_actions`) і різну логіку добору вузлів дерева розвитку
(архетип-залежний список для вмінь, жорстко `fighter` для маневрів), тож
спільної "kind"-моделі, як у `equipment`, тут немає. Уніфікований лише шар
колекцій.

## Ендпоінти

Усі шляхи — відносно кореня сервіса (Nginx проксує `/api/abilities/*` сюди). Авторизація — `Authorization: Bearer <access-token>`, перевіряється `requireAuth` (JWT, `JWT_ACCESS_SECRET`).

### Вміння (`/`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/` | так | — (query: `search`, `sort`, `archetype`, `scope`, `limit`) | `200 { abilities: [...] }` |
| GET | `/:id` | так | — | `200 { ability }` / `404` |
| POST | `/` | так | `{ name, archetypes?, description?, is_public?, prerequisite_node_ids?, prerequisite_logic?, image_url? }` | `201 { ability }` / `400` (без `name`) |
| PUT | `/:id` | так | те саме, що й POST | `200 { ability }` / `404` |
| DELETE | `/:id` | так | — | `200 { message }` / `404` |

### Маневри (`/maneuvers`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/maneuvers` | так | — (query: `search`, `sort`, `scope`, `limit`) | `200 { maneuvers: [...] }` |
| GET | `/maneuvers/:id` | так | — | `200 { maneuver }` / `404` |
| POST | `/maneuvers` | так | `{ name, duration_actions?, description?, is_public?, prerequisite_node_ids?, prerequisite_logic?, image_url? }` | `201 { maneuver }` / `400` (без `name`) |
| PUT | `/maneuvers/:id` | так | те саме, що й POST | `200 { maneuver }` / `404` |
| DELETE | `/maneuvers/:id` | так | — | `200 { message }` / `404` |

Примітки:
- `create` в обох валідує наявність `name` у тілі запиту (`400 { message: 'name є обовʼязковим' }`, якщо відсутнє).
- `update`/`delete` повертають `404`, якщо запис не знайдено **або** належить іншому користувачу (запис не є власним).
- `scope=canonical` фільтрує записи, створені адміном (ГМ-контент); `scope=user` — усе інше; `scope=community` — публічні записи інших, не канонічні (рейл "Творіння спільноти" на Dashboard).
- Вміння: `archetype` фільтрує за `$n = ANY(archetypes)`. Маневри: `sort` приймає `name` (за замовчуванням) або `duration_actions`.
- `GET /` та `GET /maneuvers` бачать власні записи користувача плюс усі публічні (`is_public = true`) записи інших.

### Колекції (`/collections`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/collections/public/:id` | ні | — | `200 { collection }` / `404` |
| GET | `/collections` | так | — (query: `search`, `scope`) | `200 { collections: [...] }` |
| GET | `/collections/:id` | так | — | `200 { collection }` / `404` |
| POST | `/collections` | так | `{ name, description?, is_public?, prerequisite_node_ids?, prerequisite_logic? }` | `201 { collection }` / `400` (без `name`) |
| PUT | `/collections/:id` | так | те саме, що й POST | `200 { collection }` / `404` |
| DELETE | `/collections/:id` | так | — | `200 { message }` / `404` |
| POST | `/collections/:id/items` | так | `{ item_id }` | `201 { item }` / `400` (без `item_id`) / `404` |
| DELETE | `/collections/:id/items/:itemId` | так | — | `200 { message }` / `404` |

Примітки:
- `GET /collections/public/:id` — неавтентифікований шлях для посилань на публічні колекції (аналог `character_sheet`'s `/public/:id`); повертає `404`, якщо колекція не існує або не публічна.
- Колекція збирає вміння й маневри **разом** — вид передавати не треба: сервіс сам визначає, у якій із двох таблиць (`abilities.entries` чи `abilities.maneuvers`) лежить `item_id`, і записує це в `item_kind`.
- Додавати елементи (`POST .../items`) може лише власник колекції, і лише записи, які він бачить (власні або публічні). `404`, якщо не виконано хоч одну з цих умов.
- Кожен об'єкт колекції у відповіді містить вкладений масив `items` — snapshot полів пов'язаних записів (`id, name, description, type, archetypes, duration_actions, is_public, prerequisite_node_ids, prerequisite_logic, image_url`; `archetypes`/`duration_actions` — той з двох, що має цей `type`, інший — `null`), а не просто список id.

Усі неочікувані помилки моделі (наприклад, збій БД) не перехоплюються контролерами — вони прокидаються далі у глобальний error-handler (`err.statusCode || 500`), визначений у `src/index.js`.

## Схема БД

Сервіс володіє схемою `abilities`:

- `abilities.entries` — самі вміння (`user_id`, `name`, `archetypes`, `description`, `is_public`, `prerequisite_node_ids`, `prerequisite_logic`, `image_url`, …).
- `abilities.maneuvers` — самі маневри (`user_id`, `name`, `duration_actions` (1–3), `description`, `is_public`, `prerequisite_node_ids`, `prerequisite_logic`, `image_url`, …).
- `abilities.collections` — колекції/набори (`user_id`, `name`, `description`, `is_public`, `prerequisite_node_ids`, `prerequisite_logic`, …) — спільні для вмінь і маневрів.
- `abilities.collection_items` — зв'язка `collection_id` ↔ `item_id` + `item_kind` (`ability` / `maneuver` — у якій із двох таблиць шукати рядок). FK на каталог тут немає (одна колонка не може посилатися на дві таблиці), тож звʼязки прибирає сама модель при видаленні запису — див. `deleteQuery` у `src/models/ability.model.js` / `maneuver.model.js`.

На id вмінь/маневрів ззовні посилаються `character_sheet.abilities.ability_id` /
`character_sheet.maneuvers.maneuver_id`, `compendium.compendium_maneuvers.maneuver_id`
— голими UUID, без FK.

Крім того, читає (без запису):
- `skill_tree.nodes` — щоб підставити назви вузлів-передумов (`prerequisite_node_ids`) у відповідь.
- `auth.users` — щоб визначити, чи запис/колекція створені адміном (`is_canonical`).

## Змінні оточення

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — підключення до спільної БД.
- `JWT_ACCESS_SECRET` — перевірка access-токена в `requireAuth`.
- `FRONTEND_URL` — дозволений origin для CORS.
- `PORT` — порт, на якому слухає сервіс (за замовчуванням `3009`; у docker-compose задається окремо).

## Тести

```bash
cd services/abilities
npm install
npm test
```

Або через Docker (з кореня репозиторію), без локального Node.js:
```bash
docker compose run --rm abilities npm test
```

Покриття: моделі (`src/models/__tests__`), контролери (`src/controllers/__tests__`), auth-middleware (`src/middleware/__tests__`). Контролери тестуються з замоканими моделями (`jest.mock`) — перевіряються коди статусів (`400`/`404`/`200`/`201`), форма відповіді та те, що неочікувані помилки моделі не перехоплюються, а прокидаються далі (обробляє глобальний error-handler у `src/index.js`).
