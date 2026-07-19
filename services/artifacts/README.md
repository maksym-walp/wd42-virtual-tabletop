# artifacts

Каталог артефактів (легендарних/унікальних предметів) та тематичних колекцій — власний бекенд-сервіс, порт **3011**. Виділений з `equipment` (див. `database/migrations/24-artifacts-service.sql`), бо артефакти не мали механік зброї/обладунку (`damage_die`, `defense_value` тощо), а натомість — унікальні поля `creator` (автор/творець артефакту в лорі) та `rarity`.

Nginx проксує `/api/artifacts/` → цей сервіс (див. корінний `README.md`).

## Ендпоінти

Базовий шлях — `/api/artifacts`. Усі відповіді — JSON. Помилки: `400` (валідація), `401` (немає/невалідний токен), `404` (не знайдено або немає прав), `500` (внутрішня помилка) — формат `{ "message": "..." }`.

### Артефакти (`artifact.routes.js`, змонтовано у `/`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/` | Bearer JWT | — (query: `rarity`, `creator`, `search`, `sort` = `name`\|`price`\|`rarity`, `dir` = `asc`\|`desc`, `scope` = `canonical`\|`user`) | `200 { artifacts: [...] }` — власні + публічні артефакти, кожен з `is_owner`, `is_canonical` |
| GET | `/:id` | Bearer JWT | — | `200 { artifact }` або `404` |
| POST | `/` | Bearer JWT | `{ name* , description?, is_public?, price?, image_url?, creator?, rarity? }` | `201 { artifact }` або `400` якщо немає `name` |
| PUT | `/:id` | Bearer JWT | те саме тіло, що й `POST` (повна заміна — поля, яких немає в тілі, скидаються в `NULL`/`false`) | `200 { artifact }` або `404`, якщо не знайдено чи не власник |
| DELETE | `/:id` | Bearer JWT | — | `200 { message }` або `404`, якщо не знайдено чи не власник |

### Колекції (`collection.routes.js`, змонтовано у `/collections`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/collections/public/:id` | **немає** (публічне посилання) | — | `200 { collection }` (лише якщо `is_public = true`) або `404` |
| GET | `/collections` | Bearer JWT | — (query: `search`, `scope` = `canonical`\|`user`) | `200 { collections: [...] }` — власні + публічні, кожна з `items` (масив артефактів у колекції) |
| GET | `/collections/:id` | Bearer JWT | — | `200 { collection }` (з `items`) або `404` |
| POST | `/collections` | Bearer JWT | `{ name*, description?, is_public? }` | `201 { collection }` або `400` якщо немає `name` |
| PUT | `/collections/:id` | Bearer JWT | те саме тіло, що й `POST` (повна заміна) | `200 { collection }` або `404` |
| DELETE | `/collections/:id` | Bearer JWT | — | `200 { message }` або `404` |
| POST | `/collections/:id/items` | Bearer JWT | `{ artifact_id* }` | `201 { item }`; `400` якщо немає `artifact_id`; `404` якщо колекцію не знайдено (не власник) або артефакт не видимий користувачу |
| DELETE | `/collections/:id/items/:itemId` | Bearer JWT | — | `200 { message }` або `404` |

`*` — обовʼязкове поле. Авторизація — заголовок `Authorization: Bearer <access token>`, перевіряється `src/middleware/auth.middleware.js` (JWT, підписаний `JWT_ACCESS_SECRET`); з валідного токена береться `req.user.sub` як `user_id`.

## Схема БД

Власна схема `artifacts` (створена `database/migrations/24-artifacts-service.sql`, доповнена `28-catalog-image-url.sql`):

- **`artifacts.entries`** — самі артефакти: `id`, `user_id`, `name`, `description`, `is_public`, `price` (`SMALLINT`, ≥0), `image_url`, `creator`, `rarity` (`common`\|`uncommon`\|`rare`\|`legendary`), `created_at`, `updated_at`.
- **`artifacts.collections`** — тематичні добірки артефактів: `id`, `user_id`, `name`, `description`, `is_public`, `created_at`, `updated_at`.
- **`artifacts.collection_items`** — звʼязка колекція↔артефакт: `id`, `collection_id` (FK → `collections.id`, `ON DELETE CASCADE`), `artifact_id` (FK → `entries.id`, `ON DELETE CASCADE`), `created_at`, унікальність по парі `(collection_id, artifact_id)`.

«Канонічні» артефакти/колекції — це записи, автор (`user_id`) яких має роль `admin` у `auth.users` (JOIN за читання, обчислюється як `is_canonical` у відповіді); фільтр `scope=canonical|user` фільтрує саме за цим.

## Змінні оточення

Читаються напряму з `process.env` (див. `.env` / `.env.example` у корені репозиторію):

| Змінна | Призначення |
|---|---|
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | підключення до спільної PostgreSQL (`src/config/db.js`) |
| `JWT_ACCESS_SECRET` | перевірка access-токена в `requireAuth` (`src/middleware/auth.middleware.js`) |
| `FRONTEND_URL` | дозволений origin для CORS (`src/index.js`), дефолт `http://localhost` |
| `PORT` | порт, на якому слухає сервіс, дефолт `3011` |

## Запуск

Локально без Docker:
```bash
cd services/artifacts
npm install
npm run dev     # nodemon, hot-reload
# або
npm start
```

Через Docker — див. корінний `README.md` (`docker compose up --build`, окремо: `docker compose up -d postgres artifacts`).

## Тести

```bash
cd services/artifacts
npm test
```

Jest: моделі (`src/models/__tests__`) мокають `pg`-пул (`src/config/__mocks__/db.js`) і перевіряють SQL/параметри; контролери (`src/controllers/__tests__`) мокають моделі (`jest.mock('../../models/...')`) і перевіряють коди відповіді (`400`/`404`/`200`/`201`) та форму payload'у — несподівані помилки моделі не перехоплюються контролером, а прокидаються далі до глобального error-хендлера в `src/index.js` (`err.statusCode || 500`); middleware (`src/middleware/__tests__`) перевіряє `requireAuth`.
