# maneuvers

Сервіс маневрів бійців — власні та канонічні (ГМ) записи бойових маневрів, плюс колекції (набори) маневрів, якими можна ділитись через публічне посилання. Порт **3008** (`/api/maneuvers/` через Nginx).

## Ендпоінти

Усі шляхи — відносно кореня сервіса (Nginx проксує `/api/maneuvers/*` сюди). Авторизація — `Authorization: Bearer <access-token>`, перевіряється `requireAuth` (JWT, `JWT_ACCESS_SECRET`).

### Маневри (`/`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/` | так | — (query: `search`, `sort`, `scope`) | `200 { maneuvers: [...] }` |
| GET | `/:id` | так | — | `200 { maneuver }` / `404` |
| POST | `/` | так | `{ name, duration_actions?, description?, is_public?, prerequisite_node_ids?, prerequisite_logic?, image_url? }` | `201 { maneuver }` / `400` (без `name`) |
| PUT | `/:id` | так | те саме, що й POST | `200 { maneuver }` / `404` |
| DELETE | `/:id` | так | — | `200 { message }` / `404` |

Примітки:
- `create` валідує наявність `name` у тілі запиту (`400 { message: 'name є обовʼязковим' }`, якщо відсутнє) — узгоджено з `collection.controller.js` цього ж сервіса та з `ability`/`artifact`-контролерами інших сервісів.
- `update`/`delete` повертають `404`, якщо запис не знайдено **або** належить іншому користувачу (запис не є власним).
- `scope=canonical` фільтрує маневри, створені адміном (ГМ-контент); `scope=user` — усе інше.
- `sort` приймає `name` (за замовчуванням) або `duration_actions`; будь-яке інше значення тихо повертається до сортування за `name`.
- `GET /` та `GET /:id` бачать власні маневри користувача плюс усі публічні (`is_public = true`) маневри інших.

### Колекції (`/collections`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/collections/public/:id` | ні | — | `200 { collection }` / `404` |
| GET | `/collections` | так | — (query: `search`, `scope`) | `200 { collections: [...] }` |
| GET | `/collections/:id` | так | — | `200 { collection }` / `404` |
| POST | `/collections` | так | `{ name, description?, is_public?, prerequisite_node_ids?, prerequisite_logic? }` | `201 { collection }` / `400` (без `name`) |
| PUT | `/collections/:id` | так | те саме, що й POST | `200 { collection }` / `404` |
| DELETE | `/collections/:id` | так | — | `200 { message }` / `404` |
| POST | `/collections/:id/items` | так | `{ maneuver_id }` | `201 { item }` / `400` (без `maneuver_id`) / `404` |
| DELETE | `/collections/:id/items/:itemId` | так | — | `200 { message }` / `404` |

Примітки:
- `GET /collections/public/:id` — неавтентифікований шлях для посилань на публічні колекції (аналог `character_sheet`'s `/public/:id`); повертає `404`, якщо колекція не існує або не публічна.
- Додавати елементи (`POST .../items`) може лише власник колекції, і лише маневри, які він бачить (власні або публічні). `404`, якщо не виконано хоч одну з цих умов.
- Кожен об'єкт колекції у відповіді містить вкладений масив `items` — snapshot полів пов'язаних маневрів (`id, name, duration_actions, description, is_public, prerequisite_node_ids, prerequisite_logic, image_url`), а не просто список id.

Усі неочікувані помилки моделі (наприклад, збій БД) не перехоплюються контролерами — вони прокидаються далі у глобальний error-handler (`err.statusCode || 500`), визначений у `src/index.js`.

## Схема БД

Сервіс володіє схемою `maneuvers`:

- `maneuvers.entries` — самі маневри (`user_id`, `name`, `duration_actions` (1–3), `description`, `is_public`, `prerequisite_node_ids`, `prerequisite_logic`, `image_url`, `created_at`, `updated_at`). Колонка `category` (`skill`/`maneuver`) також існує в таблиці, але наразі не читається й не пишеться жодним контролером/моделлю цього сервіса.
- `maneuvers.collections` — колекції/набори маневрів (`user_id`, `name`, `description`, `is_public`, `prerequisite_node_ids`, `prerequisite_logic`, `created_at`, `updated_at`).
- `maneuvers.collection_items` — зв'язка `collection_id` ↔ `maneuver_id` (унікальна пара, `ON DELETE CASCADE` в обидва боки).

Крім того, читає (без запису):
- `skill_tree.nodes` — щоб підставити назви вузлів-передумов (`prerequisite_node_ids`) у відповідь.
- `auth.users` — щоб визначити, чи запис/колекція створені адміном (`is_canonical`).

## Змінні оточення

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — підключення до спільної БД.
- `JWT_ACCESS_SECRET` — перевірка access-токена в `requireAuth`.
- `FRONTEND_URL` — дозволений origin для CORS.
- `PORT` — порт, на якому слухає сервіс (за замовчуванням `3008`; у docker-compose задається окремо).

## Тести

```bash
cd services/maneuvers
npm install
npm test
```

Або через Docker (з кореня репозиторію), без локального Node.js:
```bash
docker compose run --rm maneuvers npm test
```

Покриття: моделі (`src/models/__tests__`), контролери (`src/controllers/__tests__`), auth-middleware (`src/middleware/__tests__`). Контролери тестуються з замоканими моделями (`jest.mock`) — перевіряються коди статусів (`400`/`404`/`200`/`201`), форма відповіді та те, що неочікувані помилки моделі не перехоплюються, а прокидаються далі (обробляє глобальний error-handler у `src/index.js`).
