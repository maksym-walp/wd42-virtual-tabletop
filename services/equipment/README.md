# equipment

Сервіс каталогу спорядження: зброя, обладунки, звичайні предмети та артефакти (кожен вид — окрема таблиця й окремий ендпоінт) плюс колекції (набори спорядження будь-яких видів, з опційним публічним доступом за посиланням). Порт **3007**, проксується Nginx як `/api/equipment/`. Артефакти приєднались як четвертий вид у `51-merge-artifacts-into-equipment.sql`, повернувшись з окремого сервісу `artifacts`.

## Ендпоінти

Кожен вид спорядження змонтовано під власним префіксом (`/items`, `/weapons`, `/armor`, `/artifacts`), колекції — під `/collections`, а корінь сервіса лишається спільним **читальним** зрізом по всіх чотирьох таблицях. Зовні це `/api/equipment/weapons/...`, `/api/equipment/artifacts/...`, `/api/equipment/collections/...` тощо.

### Спорядження за видами (`src/routes/catalog.routes.js`, `src/controllers/catalog.controller.js`)

Однаковий набір маршрутів для чотирьох префіксів; відрізняються лише поля, які має конкретний вид.

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/{items\|weapons\|armor\|artifacts}` | Bearer JWT | — (query: `search`, `sort`, `dir`, `scope`, `limit`; для зброї ще `weapon_type`, для обладунків `armor_weight`, для артефактів `rarity`/`creator`) | `200 { items: [...] }` — власне спорядження користувача + публічне |
| GET | `/{вид}/:id` | Bearer JWT | — | `200 { item }` / `404` якщо не знайдено або не видно (не власне і не публічне) |
| POST | `/{вид}` | Bearer JWT | `{ name (обов'язково), description?, is_public?, price?, image_url? }` + поля виду: зброя — `damage_die?`, `weapon_type?`, `weapon_grip?`; обладунки — `defense_value?`, `armor_weight?`; артефакти — `creator?`, `rarity?` | `201 { item }` / `400` якщо відсутнє `name` |
| PUT | `/{вид}/:id` | Bearer JWT | те саме, що й POST | `200 { item }` / `404` якщо не знайдено або не належить користувачу |
| DELETE | `/{вид}/:id` | Bearer JWT | — | `200 { message: 'Видалено' }` / `404` якщо не знайдено або не належить користувачу |
| PATCH | `/{вид}/:id/canonical` | Bearer JWT (admin/game_master) | `{ is_canonical? }` (за замовчуванням `true`) | `200 { item }` / `404` якщо не знайдено |

Поля, яких у виду немає, просто ігноруються — таблиця не має для них колонок. `scope=community` (публічні записи інших користувачів, не канонічні — для рейлу "Творіння спільноти") замінює умову власності, а не доповнює її.

**Зміна виду.** Вид не зберігається колонкою, тож перемикання його в формі редагування — це переїзд рядка між таблицями. Клієнт завжди шле `PUT` на ендпоінт **обраного** виду: якщо запис досі лежить у таблиці попереднього, сервіс переносить його зі збереженням `id`, власника, `created_at` і місця в колекціях (див. `moveKind` у `src/models/catalog.model.js`).

### Спільний зріз (`src/routes/catalog.routes.js` → `unionRouter`)

Для випадків, коли вид наперед невідомий (перехід за голим `id` з листа персонажа чи заклинання) або неважливий (пікери, що показують усе спорядження разом).

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/` | Bearer JWT | — (query: `search`, `sort`, `dir`, `scope`, `limit`) | `200 { items: [...] }` — усі чотири види разом |
| GET | `/:id` | Bearer JWT | — | `200 { item }` / `404` якщо `id` немає в жодній із чотирьох таблиць або він не видний |

Кожен запис у відповіді (і в спільному зрізі, і в списках за видом) додатково містить `type` (`weapon` / `armor` / `item` / `artifact` — виводиться з таблиці, окремої колонки для нього немає), `is_owner` (чи належить поточному користувачу) та `is_canonical` (чи автор — адмін/GM, або чи запис явно позначено канонічним).

### Колекції (`src/routes/collection.routes.js`, `src/controllers/collection.controller.js`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/collections/public/:id` | немає (публічний лінк) | — | `200 { collection }` / `404` якщо не знайдено або не публічна |
| GET | `/collections` | Bearer JWT | — (query: `search`, `scope`) | `200 { collections: [...] }` — власні + публічні |
| GET | `/collections/:id` | Bearer JWT | — | `200 { collection }` / `404` якщо не знайдено або не видно |
| POST | `/collections` | Bearer JWT | `{ name (обов'язково), description?, is_public? }` | `201 { collection }` / `400` якщо відсутнє `name` |
| PUT | `/collections/:id` | Bearer JWT | те саме, що й POST | `200 { collection }` / `404` якщо не знайдено або не належить користувачу |
| DELETE | `/collections/:id` | Bearer JWT | — | `200 { message: 'Видалено' }` / `404` якщо не знайдено або не належить користувачу |
| POST | `/collections/:id/items` | Bearer JWT | `{ item_id (обов'язково) }` | `201 { item }` / `400` якщо відсутнє `item_id` / `404` якщо колекцію (не власну) або спорядження (не видне) не знайдено |
| DELETE | `/collections/:id/items/:itemId` | Bearer JWT | — | `200 { message: 'Видалено' }` / `404` якщо звʼязок не знайдено |

Колекція збирає спорядження будь-яких видів разом. Вид передавати не треба: сервіс сам визначає, у якій із чотирьох таблиць лежить `item_id`, і записує це в `item_kind`.

Кожна колекція у відповіді містить вкладений масив `items` (агреговане спорядження колекції, кожен запис із `type`), а також `is_owner` і `is_canonical`.

Параметр запиту `scope` (`canonical` | `user`) для списків спорядження і колекцій фільтрує за тим, чи автор — адмін.

Авторизація: заголовок `Authorization: Bearer <access_token>`, перевіряється middleware `src/middleware/auth.middleware.js` (`JWT_ACCESS_SECRET`); `req.user.sub` — id користувача.

Помилки, що не є валідацією (400) чи not-found (404), пробрасываются в глобальний обробник помилок `src/index.js` і повертаються як `err.statusCode || 500`.

## Схема БД

Сервіс володіє схемою `equipment`. Спорядження розкладене по чотирьох таблицях — по одній на вид (`39-equipment-split-tables.sql`, артефакти додались у `51-merge-artifacts-into-equipment.sql`); колонки `type` немає, бо вид визначає сама таблиця. Спільні для всіх колонки: `name`, `description`, `is_public`, `is_canonical`, `price`, `image_url`, `user_id`.

- `equipment.items` — звичайні предмети: лише спільні колонки.
- `equipment.weapons` — зброя: спільні + `damage_die`, `weapon_type`, `weapon_grip`.
- `equipment.armor` — обладунки: спільні + `defense_value`, `armor_weight`.
- `equipment.artifacts` — артефакти: спільні + `creator`, `rarity`.
- `equipment.collections` — колекції: `name`, `description`, `is_public`, `user_id`.
- `equipment.collection_items` — звʼязка many-to-many між колекціями та спорядженням: `collection_id`, `item_id` + `item_kind` (`item` / `weapon` / `armor` / `artifact` — у якій із чотирьох таблиць шукати рядок). FK на каталог тут немає (одна колонка не може посилатися на чотири таблиці), тож звʼязки прибирає сама модель при видаленні запису — див. `deleteQuery` у `src/models/catalog.model.js`.

На id спорядження ззовні посилаються `character_sheet.equipment.equipment_id` та `spellbook.spells.components[].item_id` — голими UUID, без FK. Тому переїзди рядків між таблицями (і сама міграція розділення) зберігають `id`.

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
