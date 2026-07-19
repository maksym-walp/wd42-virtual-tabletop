# abilities

Сервіс вмінь (за архетипами) — власні та канонічні (ГМ) записи вмінь, плюс колекції (набори) вмінь, якими можна ділитись через публічне посилання. Порт **3009** (`/api/abilities/` через Nginx).

## Ендпоінти

Усі шляхи — відносно кореня сервіса (Nginx проксує `/api/abilities/*` сюди). Авторизація — `Authorization: Bearer <access-token>`, перевіряється `requireAuth` (JWT, `JWT_ACCESS_SECRET`).

### Вміння (`/`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/` | так | — (query: `search`, `sort`, `archetype`, `scope`) | `200 { abilities: [...] }` |
| GET | `/:id` | так | — | `200 { ability }` / `404` |
| POST | `/` | так | `{ name, archetypes?, description?, is_public?, prerequisite_node_ids?, prerequisite_logic?, image_url? }` | `201 { ability }` |
| PUT | `/:id` | так | те саме, що й POST | `200 { ability }` / `404` |
| DELETE | `/:id` | так | — | `200 { message }` / `404` |

Примітки:
- `create` не валідує тіло запиту на бекенді (на відміну від `equipment`/`maneuvers`/`spellbook`) — порожній або неповний body просто піде в `INSERT`.
- `update`/`delete` повертають `404`, якщо запис не знайдено **або** належить іншому користувачу (запис не є власним).
- `scope=canonical` фільтрує вміння, створені адміном (ГМ-контент); `scope=user` — усе інше.
- `GET /` та `GET /:id` бачать власні вміння користувача плюс усі публічні (`is_public = true`) вміння інших.

### Колекції (`/collections`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/collections/public/:id` | ні | — | `200 { collection }` / `404` |
| GET | `/collections` | так | — (query: `search`, `scope`) | `200 { collections: [...] }` |
| GET | `/collections/:id` | так | — | `200 { collection }` / `404` |
| POST | `/collections` | так | `{ name, description?, is_public?, prerequisite_node_ids?, prerequisite_logic? }` | `201 { collection }` / `400` (без `name`) |
| PUT | `/collections/:id` | так | те саме, що й POST | `200 { collection }` / `404` |
| DELETE | `/collections/:id` | так | — | `200 { message }` / `404` |
| POST | `/collections/:id/items` | так | `{ ability_id }` | `201 { item }` / `400` (без `ability_id`) / `404` |
| DELETE | `/collections/:id/items/:itemId` | так | — | `200 { message }` / `404` |

Примітки:
- `GET /collections/public/:id` — неавтентифікований шлях для посилань на публічні колекції (аналог `character_sheet`'s `/public/:id`); повертає `404`, якщо колекція не існує або не публічна.
- Додавати елементи (`POST .../items`) може лише власник колекції, і лише вміння, які він бачить (власні або публічні). `404`, якщо не виконано хоч одну з цих умов.
- Кожен об'єкт колекції у відповіді містить вкладений масив `items` — snapshot полів пов'язаних вмінь (`id, name, description, archetypes, is_public, prerequisite_node_ids, prerequisite_logic, image_url`), а не просто список id.

Усі неочікувані помилки моделі (наприклад, збій БД) не перехоплюються контролерами — вони прокидаються далі у глобальний error-handler (`err.statusCode || 500`), визначений у `src/index.js`.

## Схема БД

Сервіс володіє схемою `abilities`:

- `abilities.entries` — самі вміння (`user_id`, `name`, `archetypes`, `description`, `is_public`, `prerequisite_node_ids`, `prerequisite_logic`, `image_url`, …).
- `abilities.collections` — колекції/набори вмінь (`user_id`, `name`, `description`, `is_public`, `prerequisite_node_ids`, `prerequisite_logic`, …).
- `abilities.collection_items` — зв'язка `collection_id` ↔ `ability_id`.

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
