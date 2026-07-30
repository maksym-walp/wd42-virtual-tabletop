# compendium

Сервіс НІП (неігрових персонажів) та бестіарію: види (`species`), підвиди (`subspecies`) і записи (`compendium_entries`) — останні зберігають NPC та Creature в одній таблиці за патерном Single Table Inheritance (дискримінатор `entity_type`). Порт **3014**, проксується Nginx як `/api/compendium/`.

## Ендпоінти

Три ресурси, кожен — окремий Express-роутер з однаковим набором REST-маршрутів (`src/routes/{species,subspecies,entry}.routes.js`).

### Види (`/species`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/species` | Bearer JWT | — | `200 { species: [...] }` — власні + публічні (адміну видно все) |
| GET | `/species/:id` | Bearer JWT | — | `200 { species }` / `404` якщо не знайдено / `403` якщо приватний і не власний |
| POST | `/species` | Bearer JWT (admin/game_master) | `{ name (обов'язково), description?, is_public?, health_die? }` | `201 { species }` / `400` якщо відсутнє `name` або `health_die` не з дозволеного набору / `403` не для GM/admin |
| PATCH | `/species/:id` | Bearer JWT (власник-GM або admin) | те саме, що й POST | `200 { species }` / `404` якщо не знайдено / `403` якщо не власний запис |
| DELETE | `/species/:id` | Bearer JWT (власник-GM або admin) | — | `204` / `404` якщо не знайдено / `403` якщо не власний запис |

`health_die` — ранг кубика здоров'я виду: одне з `d4`, `d6`, `d8`, `d10`, `d12`, `d20` (за замовчуванням `d6`). Використовується для обчислення поля `health` записів компендіуму (див. нижче).

### Підвиди (`/subspecies`)

Той самий набір маршрутів і той самий `health_die`, плюс обов'язковий `species_id` при створенні та опційний фільтр `?species_id=` на списку.

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/subspecies` | Bearer JWT | — (query: `species_id?`) | `200 { subspecies: [...] }` |
| GET | `/subspecies/:id` | Bearer JWT | — | `200 { subspecies }` / `404` / `403` |
| POST | `/subspecies` | Bearer JWT (admin/game_master) | `{ name, species_id (обов'язково), description?, is_public?, health_die? }` | `201 { subspecies }` / `400` якщо відсутнє `name`/`species_id` або `health_die` не з дозволеного набору / `403` |
| PATCH | `/subspecies/:id` | Bearer JWT (власник-GM або admin) | `{ name, description?, is_public?, health_die? }` | `200 { subspecies }` / `404` / `403` |
| DELETE | `/subspecies/:id` | Bearer JWT (власник-GM або admin) | — | `204` / `404` / `403` |

### Записи компендіуму (`/entries`) — НІП і бестіарій

STI: `entity_type` (`npc` / `creature`) фіксується при створенні й не змінюється через `PATCH`. Поля `motivation`/`backstory`/`faction` стосуються лише `npc`; поле `history` ("Походження" в інтерфейсі) — лише `creature`. Сервіс обнуляє поля не свого типу незалежно від того, що прислав клієнт.

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/entries` | Bearer JWT | — (query: `entity_type?` — `npc` або `creature`) | `200 { entries: [...] }` — власні + публічні / `400` якщо `entity_type` невалідний |
| GET | `/entries/:id` | Bearer JWT | — | `200 { entry }` / `404` / `403` |
| POST | `/entries` | Bearer JWT (admin/game_master) | `{ name, entity_type ('npc'\|'creature', обов'язково), species_id?, subspecies_id?, description?, history? (лише creature), image_url?, motivation?, backstory?, faction? (лише npc), dexterity, body, intelligence, wisdom, charisma (усі 1..6, обов'язково), is_public? }` | `201 { entry }` / `400` якщо відсутнє `name`, `entity_type` невалідний або атрибут поза межами 1..6 / `403` |
| PATCH | `/entries/:id` | Bearer JWT (власник-GM або admin) | те саме, крім `entity_type` (ігнорується) | `200 { entry }` / `404` / `403` / `400` |
| PATCH | `/entries/:id/health` | Bearer JWT (власник-GM або admin) | `{ rolled_health }` — додатне ціле число або `null` | `200 { entry }` / `400` якщо запис не `npc`, або `rolled_health` не додатне ціле / `404` / `403` |
| DELETE | `/entries/:id` | Bearer JWT (власник-GM або admin) | — | `204` / `404` / `403` |

`/entries/:id/health` — вузький, окремий ендпоінт для збереження одноразово кинутого здоров'я НІПа (`compendium_entries.rolled_health`); торкається лише цієї колонки, не чіпаючи решту запису (на відміну від звичайного `PATCH`, який переписує весь рядок з повної форми). Лише для `entity_type = 'npc'` — істоти не мають постійного здоров'я, воно завжди рахується наново від `health.formula`.

Кожен запис у відповіді (`GET`/`POST`/`PATCH`) додатково несе обчислені поля (`src/dto/entry.dto.js`):

- `skills` — 20 фіксованих навичок, кожна з `dice` (кубик d4..d20), похідним від значення керуючого атрибута цього запису. Немає рівнів навичок, як у гравця, — лише прямий рахунок від атрибута. Таблиця атрибут → кубик: `{1: 'd4', 2: 'd6', 3: 'd8', 4: 'd10', 5: 'd12', 6: 'd20'}` (та сама шкала, що й `AGILITY_INITIATIVE` у фронтенді для ініціативи). 20 навичок (по 4 на кожен з 5 атрибутів) — той самий список ключів, що й `character_sheet.skills.skill_key`, згрупований так само, як `CHARACTERISTICS` у фронтенді (`agility`→`dexterity`, `physique`→`body`, `intellect`→`intelligence`, `wisdom`/`charisma` без змін).
- `health` — `{ die, count, formula, rolled }`, наприклад `{ die: 'd10', count: 15, formula: '15d10', rolled: 87 }`. `die` — `health_die` підвиду запису (якщо вказано підвид), інакше виду (якщо вказано вид), інакше `d6`. `count` — кількість кубиків здоров'я за рівнем атрибута `body`: `{1: 6, 2: 11, 3: 15, 4: 18, 5: 20, 6: 21}` (та сама таблиця, що й `PHYSIQUE_HEALTH` для гравських персонажів у фронтенді — свідомо не окрема шкала для НІПів/істот). `rolled` — збережений підсумок кидка з `rolled_health` (лише `npc`; `null`, доки не кинуто, і завжди `null` для `creature`). Кампанії (`campaigns`-сервіс) при клонуванні НІПа в бойову сцену використовують саме `rolled`, а не наново порахований `formula`; для істот `campaigns` завжди рахує середнє від `formula`.

### Асоціації з іншими сервісами (`/entries/:id/{equipment,spells,maneuvers}`)

Три junction-таблиці зв'язують запис зі спорядженням, заклинаннями й маневрами з інших сервісів (лише id, без FK — міжсхемно). Однаковий набір маршрутів для всіх трьох, побудований через фабрику `src/controllers/relation.controller.js` (як `createCatalogController` в equipment-сервісі):

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/entries/:id/equipment` | Bearer JWT (читання запису) | — | `200 { equipment: [...] }` — кожен рядок із вкладеним `equipment` (назва/тип/опис, розв'язані по трьох таблицях каталогу) |
| POST | `/entries/:id/equipment` | Bearer JWT (власник-GM або admin) | `{ equipment_id }` | `201 { item }` / `400` без `equipment_id` / `404` якщо предмет не видний користувачу / `403` |
| DELETE | `/entries/:id/equipment/:equipmentId` | Bearer JWT (власник-GM або admin) | — | `200 { message: 'Видалено' }` / `404` / `403` |
| GET / POST / DELETE | `/entries/:id/spells[/:spellId]` | те саме | `{ spell_id }` на POST | `200 { spells: [...] }` / `201 { spell }` / `200 { message }` |
| GET / POST / DELETE | `/entries/:id/maneuvers[/:maneuverId]` | те саме | `{ maneuver_id }` на POST | `200 { maneuvers: [...] }` / `201 { maneuver }` / `200 { message }` |

`equipment_id` розв'язується по `equipment.items`/`weapons`/`armor` (спорядження розділене на три таблиці, `39-equipment-split-tables.sql` — власного дискримінатора тут немає, так само як у `character_sheet.equipment`); `spell_id`/`maneuver_id` — прості посилання на односхемні `spellbook.spells`/`maneuvers.entries`. Перед додаванням звʼязку сервіс перевіряє, що елемент видний користувачу (власний або публічний) — `src/models/catalog.model.js`.

### Колекції (`/collections`)

Іменовані GM-набірки записів компендіуму (наприклад, "Табір розбійників" — кілька НІПів і істот разом), за тим самим шаблоном, що й `equipment.collections`/`spellbook.collections`/`maneuvers.collections`/`abilities.collections` (`20-collections.sql`), але без `is_canonical` (у компендіумі немає поняття "канонічний") і без `prerequisite_node_ids` (це вимога дерева розвитку для гравського контенту, тут не застосовна). Створювати колекцію може будь-який автентифікований користувач (не лише GM/admin) — так само, як і в інших сервісах; редагувати/видаляти може лише власник або admin.

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/collections/public/:id` | немає (публічний лінк) | — | `200 { collection }` / `404` якщо не знайдено або не публічна |
| GET | `/collections` | Bearer JWT | — (query: `search?`) | `200 { collections: [...] }` — власні + публічні |
| GET | `/collections/:id` | Bearer JWT | — | `200 { collection }` / `404` |
| POST | `/collections` | Bearer JWT | `{ name (обов'язково), description?, is_public? }` | `201 { collection }` / `400` якщо відсутнє `name` |
| PUT | `/collections/:id` | Bearer JWT (власник або admin) | те саме, що й POST | `200 { collection }` / `404` |
| DELETE | `/collections/:id` | Bearer JWT (власник або admin) | — | `200 { message: 'Видалено' }` / `404` |
| POST | `/collections/:id/items` | Bearer JWT (власник або admin) | `{ entry_id (обов'язково) }` | `201 { item }` / `400` без `entry_id` / `404` якщо колекцію (не власну) або запис (не видний) не знайдено |
| DELETE | `/collections/:id/items/:entryId` | Bearer JWT (власник або admin) | — | `200 { message: 'Видалено' }` / `404` |

Кожна колекція у відповіді містить вкладений масив `items` (записи колекції, кожен — скорочений `{id, name, entity_type, description, is_public, image_url}`, без обчислених `skills`).

### RBAC і видимість

Створення/редагування/видалення — лише `admin` або `game_master`; для `game_master` додатково потрібно бути автором запису (`created_by`), `admin` може редагувати будь-який запис (`src/controllers/access.js`). Читання (`GET`) доступне будь-якому автентифікованому користувачу, але список і поодинокий запис фільтруються: видно власні записи, публічні (`is_public = true`) записи та (для адміна) усе.

Авторизація: заголовок `Authorization: Bearer <access_token>`, перевіряється middleware `src/middleware/auth.middleware.js` (`JWT_ACCESS_SECRET`); `req.user.sub` — id користувача, `req.user.role` — роль.

Помилки, що не є валідацією (400), not-found (404) чи forbidden (403), пробрасываются в глобальний обробник помилок `src/index.js` і повертаються як `err.statusCode || 500`.

## Схема БД

Сервіс володіє схемою `compendium`.

- `compendium.species` — `name`, `description`, `is_public`, `created_by`, `health_die` (`VARCHAR(3) CHECK IN ('d4','d6','d8','d10','d12','d20')`, default `d6`).
- `compendium.subspecies` — те саме + `species_id` (FK на `compendium.species`, `ON DELETE CASCADE`).
- `compendium.compendium_entries` — STI-таблиця НІП і бестіарію: `entity_type` (`npc`/`creature`), `name`, `species_id`/`subspecies_id` (FK, `ON DELETE SET NULL` — видалення виду не стирає записи, які на нього посилались), `description`, `history` (лише `creature`), `image_url`, `motivation`/`backstory`/`faction` (лише для `npc`), атрибути `dexterity`/`body`/`intelligence`/`wisdom`/`charisma` (`SMALLINT CHECK BETWEEN 1 AND 6`), `rolled_health` (`SMALLINT CHECK (rolled_health IS NULL OR rolled_health >= 1)`, лише `npc` — див. `PATCH /entries/:id/health` вище), `is_public`, `created_by`. Немає власного `health_die` — воно завжди резолвиться від виду/підвиду (`entry.model.js` `HEALTH_DIE_JOIN`, `LEFT JOIN` на `species`/`subspecies` з `COALESCE(sub.health_die, sp.health_die, 'd6')`).
- `compendium.compendium_equipment` / `compendium.compendium_spells` / `compendium.compendium_maneuvers` — junction-таблиці `entry_id` (FK на `compendium.compendium_entries`, `ON DELETE CASCADE`) + `equipment_id`/`spell_id`/`maneuver_id` (голий UUID, міжсхемно, без FK) з `UNIQUE (entry_id, X_id)`. Той самий патерн, що й `character_sheet.equipment`/`.known_spells`/`.maneuvers`.
- `compendium.collections` / `compendium.collection_items` — GM-набірки записів: `collections` (`name`, `description`, `is_public`, `created_by`), `collection_items` (`collection_id` FK CASCADE, `entry_id` FK CASCADE на `compendium_entries`, `UNIQUE (collection_id, entry_id)`).

Усі списки/деталі (`species`, `subspecies`, `compendium_entries`, `collections`) додатково повертають обчислене поле `is_owner` (`created_by = поточний користувач`), яке фронтенд використовує для позначок "чуже"/кнопок редагування — той самий патерн, що й в equipment/maps.

`created_by` (і `equipment_id`/`spell_id`/`maneuver_id`) — голий UUID без FK, що посилається на записи в інших схемах (`auth.users.id`, `equipment.*`, `spellbook.spells`, `maneuvers.entries`) — міжсхемний, за конвенцією репозиторію (див. `database/migrations/35-maps-service.sql`).

Міграції: `database/migrations/44-compendium-service.sql` (species/subspecies/entries), `database/migrations/45-compendium-relationships.sql` (junction-таблиці), `database/migrations/46-compendium-collections.sql` (колекції), `database/migrations/48-compendium-health-fields.sql` (`health_die` на species/subspecies, `faction` на entries), `database/migrations/49-compendium-rolled-health.sql` (`rolled_health` на entries).

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
