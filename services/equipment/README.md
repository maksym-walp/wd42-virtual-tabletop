# equipment

Сервіс каталогу спорядження: предмети (зброя/обладунки/інше) та колекції (набори предметів, з опційним публічним доступом за посиланням). Порт **3007**, проксується Nginx як `/api/equipment/`.

## Ендпоінти

Маршрути предметів змонтовані в корені сервіса, маршрути колекцій — під `/collections` (тобто зовні: `/api/equipment/...` і `/api/equipment/collections/...`).

### Предмети (`src/routes/item.routes.js`, `src/controllers/item.controller.js`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/` | Bearer JWT | — (query: `type`, `weapon_type`, `armor_weight`, `search`, `sort`, `dir`, `scope`) | `200 { items: [...] }` — власні предмети користувача + публічні, без `type='artifact'` |
| GET | `/:id` | Bearer JWT | — | `200 { item }` / `404` якщо не знайдено або не видно (не власний і не публічний) |
| POST | `/` | Bearer JWT | `{ name (обов'язково), type?, damage_die?, defense_value?, description?, is_public?, price?, image_url?, weapon_type?, weapon_grip?, armor_weight? }` | `201 { item }` / `400` якщо відсутнє `name` |
| PUT | `/:id` | Bearer JWT | те саме, що й POST | `200 { item }` / `404` якщо не знайдено або не належить користувачу |
| DELETE | `/:id` | Bearer JWT | — | `200 { message: 'Видалено' }` / `404` якщо не знайдено або не належить користувачу |

Кожен предмет у відповіді додатково містить обчислені поля `is_owner` (чи належить поточному користувачу) та `is_canonical` (чи автор — адмін).

### Колекції (`src/routes/collection.routes.js`, `src/controllers/collection.controller.js`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/collections/public/:id` | немає (публічний лінк) | — | `200 { collection }` / `404` якщо не знайдено або не публічна |
| GET | `/collections` | Bearer JWT | — (query: `search`, `scope`) | `200 { collections: [...] }` — власні + публічні |
| GET | `/collections/:id` | Bearer JWT | — | `200 { collection }` / `404` якщо не знайдено або не видно |
| POST | `/collections` | Bearer JWT | `{ name (обов'язково), description?, is_public? }` | `201 { collection }` / `400` якщо відсутнє `name` |
| PUT | `/collections/:id` | Bearer JWT | те саме, що й POST | `200 { collection }` / `404` якщо не знайдено або не належить користувачу |
| DELETE | `/collections/:id` | Bearer JWT | — | `200 { message: 'Видалено' }` / `404` якщо не знайдено або не належить користувачу |
| POST | `/collections/:id/items` | Bearer JWT | `{ item_id (обов'язково) }` | `201 { item }` / `400` якщо відсутнє `item_id` / `404` якщо колекцію (не власну) або предмет (не видний) не знайдено |
| DELETE | `/collections/:id/items/:itemId` | Bearer JWT | — | `200 { message: 'Видалено' }` / `404` якщо звʼязок не знайдено |

Кожна колекція у відповіді містить вкладений масив `items` (агреговані предмети колекції), а також `is_owner` і `is_canonical`.

Параметр запиту `scope` (`canonical` | `user`) для списків предметів і колекцій фільтрує за тим, чи автор — адмін.

Авторизація: заголовок `Authorization: Bearer <access_token>`, перевіряється middleware `src/middleware/auth.middleware.js` (`JWT_ACCESS_SECRET`); `req.user.sub` — id користувача.

Помилки, що не є валідацією (400) чи not-found (404), пробрасываются в глобальний обробник помилок `src/index.js` і повертаються як `err.statusCode || 500`.

## Схема БД

Сервіс володіє схемою `equipment`:

- `equipment.items` — предмети (зброя/обладунки/інше): `name`, `type`, `damage_die`, `defense_value`, `description`, `is_public`, `price`, `image_url`, `weapon_type`, `weapon_grip`, `armor_weight`, `user_id`.
- `equipment.collections` — колекції предметів: `name`, `description`, `is_public`, `user_id`.
- `equipment.collection_items` — звʼязка many-to-many між колекціями та предметами (`collection_id`, `item_id`).

Моделі також читають `auth.users` (join, щоб визначити `is_canonical` — чи автор запису має роль `admin`).

## Змінні оточення

Читаються у `src/`:

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — підключення до БД (`src/config/db.js`).
- `JWT_ACCESS_SECRET` — перевірка access-токена (`src/middleware/auth.middleware.js`).
- `FRONTEND_URL` — дозволений origin для CORS (`src/index.js`), за замовчуванням `http://localhost`.
- `PORT` — порт сервіса (`src/index.js`), за замовчуванням `3007`.

## Тести

```bash
cd services/equipment
npm install
npm test
```

Тести — Jest, лежать поряд з кодом у `src/**/__tests__`. Контролери тестуються з замоканими моделями (`jest.mock('../../models/...')`), без підключення до реальної БД.
