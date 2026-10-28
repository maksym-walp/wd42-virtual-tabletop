# equipment

Сервіс каталогу спорядження: зброя, обладунки, звичайні предмети, артефакти та зілля (кожен вид — окрема таблиця й окремий ендпоінт) плюс колекції (набори спорядження будь-яких видів, з опційним публічним доступом за посиланням). Порт **3007**, проксується Nginx як `/api/equipment/`, схема БД `equipment`. Артефакти приєднались як четвертий вид у `51-merge-artifacts-into-equipment.sql`, повернувшись з окремого сервісу `artifacts`.

## Ендпоінти

Кожен вид спорядження змонтовано під власним префіксом (`/items`, `/weapons`, `/armor`, `/artifacts`, `/potions`), колекції — під `/collections`, а корінь сервіса лишається спільним **читальним** зрізом по всіх пʼяти таблицях. Зовні це `/api/equipment/weapons/...`, `/api/equipment/artifacts/...`, `/api/equipment/collections/...` тощо.

### Спорядження за видами (`src/routes/catalog.routes.js`, `src/controllers/catalog.controller.js`)

Однаковий набір маршрутів для пʼяти префіксів; відрізняються лише поля, які має конкретний вид.

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/{items\|weapons\|armor\|artifacts\|potions}` | Bearer JWT | — (query: `search`, `sort`, `dir`, `scope`, `limit`; для зброї ще `weapon_type`, `weapon_grip`, `modifier`, `damage_die`, для обладунків `armor_weight`, для артефактів `rarity`/`creator`, для зіль `potion_tier`/`potion_size`/`effect`; сортування зіль — ще `heal_die`, `portions`) | `200 { items: [...] }` — власне спорядження користувача + публічне (адмін бачить усе) |
| GET | `/{вид}/:id` | Bearer JWT | — | `200 { item }` (на деталі ще `used_in_spells: [{id, name}]` — заклинання, що мають цей запис серед компонентів, включно з компонентами додаткових форм; приватні чужі не показуються) / `404` якщо не знайдено або не видно |
| POST | `/{вид}` | Bearer JWT | `{ name (обов'язково), description?, is_public?, price?, image_url?, thumbnail_url?, image_crop? }` + поля виду: зброя — `damage_die?`, `weapon_type?`, `weapon_grip?` (масив ключів), `modifier?`; обладунки — `defense_value?`, `armor_weight?`; артефакти — `creator?`, `rarity?` (`common`/`uncommon`/`rare`/`legendary`); зілля — `effect?` (`healing`), `potion_tier?`, `potion_size?` (за замовчуванням `healing`/`tincture`/`ampoule`) | `201 { item }` / `400` якщо відсутнє `name` або невідоме значення поля зілля |
| PUT | `/{вид}/:id` | Bearer JWT | те саме, що й POST | `200 { item }` / `404` якщо не знайдено або не належить користувачу |
| DELETE | `/{вид}/:id` | Bearer JWT | — | `200 { message: 'Видалено' }` / `404` якщо не знайдено або не належить користувачу |
| PATCH | `/{вид}/:id/canonical` | Bearer JWT (admin/game_master) | `{ is_canonical? }` (за замовчуванням `true`) | `200 { item }` / `404` якщо не знайдено |
| PATCH | `/{вид}/:id/owner` | Bearer JWT (лише admin) | `{ owner_username }` | `200 { item }` / `400` / `404` (запису чи користувача нема) |

Довідник зброї: `GET /weapons/options` (будь-який авторизований; змонтований **перед** `/weapons`, інакше `GET /:id` прийняв би `options` за id) → `200 { weapon_types: [{key,label}], weapon_grips: [{key,label}] }`. Значення читаються з `admin.site_configs` (ключі `weapon_types`, `weapon_grips`, редагуються в [admin](admin.md)); `weapon_grip` у запису — масив ключів (міграція 55, зброя може мати кілька особливостей), `weapon_type` — один ключ.

Довідник зіль: `GET /potions/options` (будь-який авторизований; змонтований **перед** `/potions`) → `200 { tiers: [{ key, label, die }], sizes: [{ key, label, portions }], effects: [{ key, label }] }`. Рівні: `tincture` Настоянка d4, `decoction` Відвар d6, `balm` Бальзам d8, `elixir` Еліксир d10, `extract` Екстракт d12; розміри: `ampoule` Ампула 1 порція, `tube` Пробірка 3, `flask` Флакон 6, `carafe` Карафа 10. Єдине джерело відповідності — згенеровані колонки `heal_die`/`portions` у БД (міграція 110); `die`/`portions` у довіднику — підписи для UI (`src/constants/potions.js`). Випивання, звикання й хворобу від зілля рахує [character-sheet](character-sheet.md).

Поля, яких у виду немає, просто ігноруються — таблиця не має для них колонок. `scope=community` (публічні записи інших користувачів, не канонічні — для рейлу "Творіння спільноти") замінює умову власності, а не доповнює її.

Додатково: `price` — `NUMERIC(10,2)` (міграція 54); `modifier` зброї — яка навичка кидається разом зі зброєю (`universal` або ключ однієї з 20 навичок персонажа, міграція 53); `thumbnail_url` — стиснута 400px webp-копія, яку повертає [media](media.md) разом з `image_url` (міграція 57); `image_crop` — `{x, y, zoom, ratio}` кадрування (міграція 85, зберігається лише якщо є `image_url`). Видалення пише знімок у `trash.deleted_records` (міграція 33).

**Зміна виду.** Вид не зберігається колонкою, тож перемикання його в формі редагування — це переїзд рядка між таблицями. Клієнт завжди шле `PUT` на ендпоінт **обраного** виду: якщо запис досі лежить у таблиці попереднього, сервіс переносить його зі збереженням `id`, власника, `created_at` і місця в колекціях (див. `moveKind` у `src/models/catalog.model.js`).

### Спільний зріз (`src/routes/catalog.routes.js` → `unionRouter`)

Для випадків, коли вид наперед невідомий (перехід за голим `id` з листа персонажа чи заклинання) або неважливий (пікери, що показують усе спорядження разом).

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/` | Bearer JWT | — (query: `search`, `sort`, `dir`, `scope`, `limit`) | `200 { items: [...] }` — усі пʼять видів разом |
| GET | `/export` | Bearer JWT | ті самі фільтри, або `?id=` для одного запису | `200 [ ...записи з type ]` — масив у форматі імпорту |
| POST | `/import` | admin / game_master | масив записів; `type` (`item`/`weapon`/`armor`/`artifact`/`potion`) визначає таблицю, записи з невідомим `type` пропускаються | `201 { imported }` / `400` (не масив) |
| GET | `/:id` | Bearer JWT | — | `200 { item }` / `404` якщо `id` немає в жодній із чотирьох таблиць або він не видний |

Експорт прибирає `image_url`, `thumbnail_url`, `image_crop`, `created_at`, `updated_at`, `is_owner`, `owner_username`, `used_in_spells`. Імпорт: власник — той, хто імпортує, `is_canonical = true`, зображення скидаються в `NULL`, невідома `rarity` — теж у `NULL`, невідомі рівень/розмір/ефект зілля — у значення за замовчуванням (інакше CHECK завалив би весь багаторядковий `INSERT`).

Кожен запис у відповіді (і в спільному зрізі, і в списках за видом) додатково містить `type` (`weapon` / `armor` / `item` / `artifact` / `potion` — виводиться з таблиці, окремої колонки для нього немає), `is_owner` (чи належить поточному користувачу) та `is_canonical` (явний прапорець: виставляється автоматично, коли запис створює `admin`/`game_master`, або вручну через `PATCH …/canonical`), `owner_username`.

### Колекції (`src/routes/collection.routes.js`, `src/controllers/collection.controller.js`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/collections/public/:id` | немає (публічний лінк) | — | `200 { collection }` / `404` якщо не знайдено або не публічна |
| GET | `/collections` | Bearer JWT | — (query: `search`, `scope`) | `200 { collections: [...] }` — власні + публічні |
| GET | `/collections/:id` | Bearer JWT | — | `200 { collection }` / `404` якщо не знайдено або не видно |
| POST | `/collections` | Bearer JWT | `{ name (обов'язково), description?, is_public?, image_url?, image_crop? }` | `201 { collection }` / `400` якщо відсутнє `name` |
| POST | `/collections/import` | Bearer JWT | обʼєкт колекції або масив; вкладені `items` — у форматі експорту каталогу (з `type`) | `201 { collections, imported_items, items_skipped }` / `400` |
| GET | `/collections/:id/export` | Bearer JWT | — | `200` колекція з повними записами в `items` |
| PUT | `/collections/:id` | Bearer JWT | те саме, що й POST | `200 { collection }` / `404` якщо не знайдено або не належить користувачу |
| DELETE | `/collections/:id` | Bearer JWT | — | `200 { message: 'Видалено' }` / `404` якщо не знайдено або не належить користувачу |
| POST | `/collections/:id/items` | Bearer JWT | `{ item_id (обов'язково) }` | `201 { item }` / `400` якщо відсутнє `item_id` / `404` якщо колекцію (не власну) або спорядження (не видне) не знайдено |
| DELETE | `/collections/:id/items/:itemId` | Bearer JWT | — | `200 { message: 'Видалено' }` / `404` якщо звʼязок не знайдено |
| PATCH | `/collections/:id/canonical` | admin / game_master | `{ is_canonical? }` | `200 { collection }` / `404` |
| PATCH | `/collections/:id/owner` | лише admin | `{ owner_username }` | `200 { collection }` / `400` / `404` |

Колекція збирає спорядження будь-яких видів разом. Вид передавати не треба: сервіс сам визначає, у якій із чотирьох таблиць лежить `item_id`, і записує це в `item_kind`.

Кожна колекція у відповіді містить вкладений масив `items` (агреговане спорядження колекції, кожен запис із `type`), а також `is_owner` і `is_canonical`.

Імпорт колекції доступний будь-кому, але вкладені `items` приймаються лише від `admin`/`game_master` (стають канонічними); решта лічиться в `items_skipped`.

Параметр запиту `scope` для списків спорядження і колекцій: `canonical` — лише з `is_canonical`, `user` — решта, `community` (лише спорядження) — публічні записи інших користувачів, не канонічні (рейл «Творіння спільноти» на Dashboard; замінює умову власності, а не доповнює її).

Авторизація: заголовок `Authorization: Bearer <access_token>`, перевіряється middleware `src/middleware/auth.middleware.js` (`JWT_ACCESS_SECRET`); `req.user.sub` — id користувача.

Помилки, що не є валідацією (400) чи not-found (404), пробрасываются в глобальний обробник помилок `src/index.js` і повертаються як `err.statusCode || 500`.

## Схема БД

Сервіс володіє схемою `equipment`. Спорядження розкладене по чотирьох таблицях — по одній на вид (`39-equipment-split-tables.sql`, артефакти додались у `51-merge-artifacts-into-equipment.sql`); колонки `type` немає, бо вид визначає сама таблиця. Спільні для всіх колонки: `name`, `description`, `is_public`, `is_canonical`, `price`, `image_url`, `thumbnail_url`, `image_crop`, `user_id`, `created_at`, `updated_at`.

- `equipment.items` — звичайні предмети: лише спільні колонки.
- `equipment.weapons` — зброя: спільні + `damage_die`, `weapon_type`, `weapon_grip VARCHAR[]`, `modifier`.
- `equipment.armor` — обладунки: спільні + `defense_value`, `armor_weight`.
- `equipment.artifacts` — артефакти: спільні + `creator`, `rarity`.
- `equipment.potions` — зілля (міграція 110): спільні + `effect` (поки лише `healing`), `potion_tier`, `potion_size` і згенеровані `heal_die` (4–12) та `portions` (1/3/6/10). Міграція засіває 20 канонічних зіль зцілення (5 рівнів × 4 розміри) від імені першого адміна чи ГМ.
- `equipment.collections` — колекції: `name`, `description`, `is_public`, `is_canonical`, `image_url`, `image_crop`, `user_id`.
- `equipment.collection_items` — звʼязка many-to-many між колекціями та спорядженням: `collection_id`, `item_id` + `item_kind` (`item` / `weapon` / `armor` / `artifact` / `potion` — у якій із чотирьох таблиць шукати рядок). FK на каталог тут немає (одна колонка не може посилатися на чотири таблиці), тож звʼязки прибирає сама модель при видаленні запису — див. `deleteQuery` у `src/models/catalog.model.js`.

На id спорядження ззовні посилаються `character_sheet.equipment.equipment_id` та `spellbook.spells.components[].item_id` — голими UUID, без FK. Тому переїзди рядків між таблицями (і сама міграція розділення) зберігають `id`.

Міжсхемні читання (без запису): `auth.users` (`owner_username`, перепризначення власника), `admin.site_configs` (`weapon_types`, `weapon_grips`) і `spellbook.spells` (`used_in_spells`).

## Змінні оточення

Читаються у `src/`:

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — підключення до БД (`src/config/db.js`).
- `JWT_ACCESS_SECRET` — перевірка access-токена (`src/middleware/auth.middleware.js`); ролі `admin` і `game_master` керують канонічним контентом (`requireCanonicalManager`), лише `admin` — власниками (`requireAdminOwner`).
- `FRONTEND_URL` — дозволений origin для CORS (`src/index.js`), за замовчуванням `http://localhost`.
- `PORT` — порт сервіса (`src/index.js`), за замовчуванням `3007`.

## Тести

```bash
cd services/equipment
npm install
npm test
```

Тести — Jest, лежать поряд з кодом у `src/**/__tests__`. Контролери тестуються з замоканими моделями (`jest.mock('../../models/...')`), без підключення до реальної БД.
