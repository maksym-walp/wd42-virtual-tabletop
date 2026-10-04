# bestiary

Бестіарій — істоти. Порт **3016**, проксується Nginx як `/api/bestiary/`. Виділений із сервісу `compendium` міграцією `database/migrations/86-split-compendium.sql` (id істот збережено, тож `campaigns.combatants.compendium_entry_id` і `chronology.calendar_event_participants.entry_id` продовжують на них вказувати).

## Ендпоінти

### Істоти (`/creatures`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/creatures` | Bearer JWT | — | `200 { creatures: [...] }` — власні + публічні (адміну — усі) |
| GET | `/creatures/:id` | Bearer JWT | — | `200 { creature }` / `404` / `403` |
| POST | `/creatures` | admin/game_master | `{ name, dexterity, body, intelligence, wisdom, charisma (1..6), species_id?, subspecies_id?, race_id?, people_id?, description?, history?, image_url?, image_crop?, health_die_override?, is_public? }` | `201 { creature }` / `400` / `403` |
| PATCH | `/creatures/:id` | власник-GM або admin | те саме | `200 { creature }` / `404` / `403` / `400` |
| PATCH | `/creatures/:id/owner` | admin | `{ owner_username }` | `200 { creature }` / `404` |
| DELETE | `/creatures/:id` | власник-GM або admin | — | `204` / `404` / `403` |

`history` — "Походження" в інтерфейсі. `health_die_override` — один із `d4`..`d20` або `null` (успадкувати від підвиду/виду).

Кожен запис у відповіді додатково несе обчислені поля (`src/dto/stat-block.dto.js`):

- `skills` — 20 фіксованих навичок, кожна з `dice` (d4..d20), похідним від значення керуючого атрибута: `{1: 'd4', 2: 'd6', 3: 'd8', 4: 'd10', 5: 'd12', 6: 'd20'}`.
- `health` — `{ die, count, formula, rolled }`, наприклад `{ die: 'd10', count: 15, formula: '15d10', rolled: 87 }`. `die` — власний `health_die_override`, інакше `health_die` підвиду, інакше виду (міжсхемне читання `compendium.subspecies`/`compendium.species`), інакше `d6`. `count` — за атрибутом `body`: `{1: 6, 2: 11, 3: 15, 4: 18, 5: 20, 6: 21}` (та сама таблиця, що й `PHYSIQUE_HEALTH` гравців). `rolled` для істот завжди `null` — у них немає постійного здоровʼя; `campaigns` при клонуванні в бій рахує середнє від `formula`.

### Спорядження, заклинання, вміння (`/creatures/:id/{equipment,spells,abilities}`)

Junction-таблиці з голими міжсхемними UUID, однаковий набір маршрутів через фабрики `src/controllers/loadout.controllers.js` + `src/models/relations.model.js`:

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/creatures/:id/equipment` | Bearer JWT (читання запису) | — | `200 { equipment: [...] }` — з вкладеним `equipment` (розвʼязаний по `equipment.items`/`weapons`/`armor`) |
| POST | `/creatures/:id/equipment` | власник-GM або admin | `{ equipment_id }` | `201 { item }` / `400` / `404` якщо предмет не видний користувачу / `403` |
| DELETE | `/creatures/:id/equipment/:equipmentId` | власник-GM або admin | — | `200 { message }` / `404` / `403` |
| GET / POST / DELETE | `/creatures/:id/spells[/:spellId]` | те саме | `{ spell_id }` | `{ spells }` / `{ spell }` |
| GET / POST / DELETE | `/creatures/:id/abilities[/:abilityId]` | те саме | `{ ability_id }` | `{ abilities }` / `{ ability }` |

### Колекції (`/collections`)

Іменовані GM-набірки записів (як в equipment/spellbook/abilities, без `is_canonical` і без `prerequisite_node_ids`). Створювати може будь-який автентифікований користувач, редагувати/видаляти — власник або admin.

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/collections/public/:id` | немає | — | `200 { collection }` / `404` |
| GET | `/collections` | Bearer JWT | — (`?search=`) | `200 { collections }` — власні + публічні |
| GET | `/collections/:id` | Bearer JWT | — | `200 { collection }` / `404` |
| POST | `/collections` | Bearer JWT | `{ name, description?, is_public?, image_url?, image_crop? }` | `201 { collection }` / `400` |
| PUT | `/collections/:id` | власник або admin | те саме | `200 { collection }` / `404` |
| PATCH | `/collections/:id/owner` | admin | `{ owner_username }` | `200 { collection }` / `404` |
| DELETE | `/collections/:id` | власник або admin | — | `200 { message }` / `404` |
| POST | `/collections/:id/items` | власник або admin | `{ creature_id }` | `201 { item }` / `400` / `404` |
| DELETE | `/collections/:id/items/:entryId` | власник або admin | — | `200 { message }` / `404` |

### RBAC і видимість

Створення/редагування/видалення — лише `admin` або `game_master`; для `game_master` додатково потрібно бути автором запису (`created_by`), `admin` може редагувати будь-який запис (`src/controllers/access.js`). Читання (`GET`) доступне будь-якому автентифікованому користувачу, але список і поодинокий запис фільтруються: видно власні записи, публічні (`is_public = true`) записи та (для адміна) усе.

Авторизація: заголовок `Authorization: Bearer <access_token>`, перевіряється middleware `src/middleware/auth.middleware.js` (`JWT_ACCESS_SECRET`); `req.user.sub` — id користувача, `req.user.role` — роль.

Помилки, що не є валідацією (400), not-found (404) чи forbidden (403), пробрасываются в глобальний обробник помилок `src/index.js` і повертаються як `err.statusCode || 500`.

## Схема БД

Сервіс володіє схемою `bestiary` (`86-split-compendium.sql`):

- `bestiary.creatures` — `name`, `species_id`/`subspecies_id`/`race_id`/`people_id` (голі UUID на `compendium.*`; обнуляються тригерами compendium при видаленні), `description`, `history`, `image_url`, `image_crop`, атрибути (`SMALLINT CHECK 1..6`), `health_die_override`, `is_public`, `created_by`.
- `bestiary.creature_equipment` / `creature_spells` / `creature_abilities` — `creature_id` (FK CASCADE) + голий `equipment_id`/`spell_id`/`ability_id`, `UNIQUE`.
- `bestiary.collections` / `collection_items` (`creature_id` FK CASCADE).

Міжсхемні читання: `compendium.species`/`subspecies` (кубик здоровʼя), `equipment.*`, `spellbook.spells`, `abilities.entries`, `auth.users` (зміна власника, `owner_username` колекцій).

## Змінні оточення

Читаються у `src/`:

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — підключення до БД (`src/config/db.js`).
- `JWT_ACCESS_SECRET` — перевірка access-токена (`src/middleware/auth.middleware.js`).
- `FRONTEND_URL` — дозволений origin для CORS (`src/index.js`), за замовчуванням `http://localhost`.
- `PORT` — порт сервіса (`src/index.js`), за замовчуванням `3016`.

## Тести

```bash
cd services/bestiary
npm install
npm test
```

Тести — Jest, лежать поряд з кодом у `src/**/__tests__`. Контролери тестуються з замоканими моделями (`jest.mock('../../models/...')`), моделі — із замоканим `pool` (`jest.mock('../../config/db')`), без підключення до реальної БД.
