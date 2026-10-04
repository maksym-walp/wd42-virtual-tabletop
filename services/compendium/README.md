# compendium

Вікі-довідник світу: види (`species`) з підвидами (`subspecies`) та раси (`races`) з народами (`peoples`). Порт **3014**, проксується Nginx як `/api/compendium/`.

До `database/migrations/86-split-compendium.sql` сервіс також тримав НІПів, істот, фракції й колекції — тепер це окремі сервіси [npcs](../npcs/README.md) (НІПи та фракції) і [bestiary](../bestiary/README.md) (істоти). Вони посилаються на види/раси звідси голими UUID і читають `compendium.species`/`subspecies` міжсхемно, щоб обчислити кубик здоровʼя.

## Ендпоінти

Чотири ресурси, кожен — окремий Express-роутер з однаковим набором REST-маршрутів (`src/routes/{species,subspecies,race,people}.routes.js`). Кожен також має `PATCH /:id/owner` (лише admin, `{ owner_username }`).

### Види (`/species`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/species` | Bearer JWT | — | `200 { species: [...] }` — власні + публічні (адміну видно все) |
| GET | `/species/:id` | Bearer JWT | — | `200 { species }` / `404` якщо не знайдено / `403` якщо приватний і не власний |
| POST | `/species` | Bearer JWT (admin/game_master) | `{ name (обов'язково), description?, is_public?, health_die? }` | `201 { species }` / `400` якщо відсутнє `name` або `health_die` не з дозволеного набору / `403` не для GM/admin |
| PATCH | `/species/:id` | Bearer JWT (власник-GM або admin) | те саме, що й POST | `200 { species }` / `404` якщо не знайдено / `403` якщо не власний запис |
| DELETE | `/species/:id` | Bearer JWT (власник-GM або admin) | — | `204` / `404` якщо не знайдено / `403` якщо не власний запис |

`health_die` — ранг кубика здоров'я виду: одне з `d4`, `d6`, `d8`, `d10`, `d12`, `d20` (за замовчуванням `d6`). Використовується для обчислення поля `health` НІПів (сервіс `npcs`) та істот (сервіс `bestiary`), якщо в них не задано власний `health_die_override`.

### Підвиди (`/subspecies`)

Той самий набір маршрутів і той самий `health_die`, плюс обов'язковий `species_id` при створенні та опційний фільтр `?species_id=` на списку.

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/subspecies` | Bearer JWT | — (query: `species_id?`) | `200 { subspecies: [...] }` |
| GET | `/subspecies/:id` | Bearer JWT | — | `200 { subspecies }` / `404` / `403` |
| POST | `/subspecies` | Bearer JWT (admin/game_master) | `{ name, species_id (обов'язково), description?, is_public?, health_die? }` | `201 { subspecies }` / `400` якщо відсутнє `name`/`species_id` або `health_die` не з дозволеного набору / `403` |
| PATCH | `/subspecies/:id` | Bearer JWT (власник-GM або admin) | `{ name, description?, is_public?, health_die? }` | `200 { subspecies }` / `404` / `403` |
| DELETE | `/subspecies/:id` | Bearer JWT (власник-GM або admin) | — | `204` / `404` / `403` |

### Раси (`/races`) і народи (`/peoples`)

Та сама форма, що й види/підвиди, але без `health_die`. Народ має обовʼязковий `race_id` при створенні (фільтр `?race_id=` на списку) і додаткове поле `origin` ("Походження народу").

### RBAC і видимість

Створення/редагування/видалення — лише `admin` або `game_master`; для `game_master` додатково потрібно бути автором запису (`created_by`), `admin` може редагувати будь-який запис (`src/controllers/access.js`). Читання (`GET`) доступне будь-якому автентифікованому користувачу, але список і поодинокий запис фільтруються: видно власні записи, публічні (`is_public = true`) записи та (для адміна) усе.

Авторизація: заголовок `Authorization: Bearer <access_token>`, перевіряється middleware `src/middleware/auth.middleware.js` (`JWT_ACCESS_SECRET`); `req.user.sub` — id користувача, `req.user.role` — роль.

Помилки, що не є валідацією (400), not-found (404) чи forbidden (403), пробрасываются в глобальний обробник помилок `src/index.js` і повертаються як `err.statusCode || 500`.

## Схема БД

Сервіс володіє схемою `compendium`.

- `compendium.species` — `name`, `description`, `is_public`, `created_by`, `health_die` (`VARCHAR(3) CHECK IN ('d4','d6','d8','d10','d12','d20')`, default `d6`).
- `compendium.subspecies` — те саме + `species_id` (FK на `compendium.species`, `ON DELETE CASCADE`).
- `compendium.races` — `name`, `description`, `is_public`, `created_by`.
- `compendium.peoples` — те саме + `race_id` (FK на `compendium.races`, `ON DELETE CASCADE`) і `origin`.

Тригери `AFTER DELETE` на всіх чотирьох таблицях (`compendium.clear_taxonomy_refs()`, `86-split-compendium.sql`) обнуляють відповідні `species_id`/`subspecies_id`/`race_id`/`people_id` у `npcs.npcs` і `bestiary.creatures` — це зберігає колишню семантику `ON DELETE SET NULL`, яка була FK, поки записи жили в цій же схемі. Тригер спрацьовує й для підвидів/народів, видалених каскадом разом із видом/расою.

Усі списки/деталі додатково повертають обчислене поле `is_owner` (`created_by = поточний користувач`).

Міграції: `44-compendium-service.sql`, `48-compendium-health-fields.sql`, `74-compendium-races.sql`, `78-legacy-text-to-rich-html.sql`, `86-split-compendium.sql`.

## Змінні оточення

Читаються у `src/`:

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — підключення до БД (`src/config/db.js`).
- `JWT_ACCESS_SECRET` — перевірка access-токена (`src/middleware/auth.middleware.js`).
- `FRONTEND_URL` — дозволений origin для CORS (`src/index.js`), за замовчуванням `http://localhost`.
- `PORT` — порт сервіса (`src/index.js`), за замовчуванням `3014`.

## Тести

```bash
cd services/compendium
npm install
npm test
```

Тести — Jest, лежать поряд з кодом у `src/**/__tests__`. Контролери тестуються з замоканими моделями (`jest.mock('../../models/...')`), моделі — із замоканим `pool` (`jest.mock('../../config/db')`), без підключення до реальної БД.
