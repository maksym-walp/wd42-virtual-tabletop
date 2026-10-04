# npcs

НІПи (неігрові персонажі) та фракції. Порт **3017**, проксується Nginx як `/api/npcs/`. Виділений із сервісу `compendium` міграцією `database/migrations/86-split-compendium.sql` (id НІПів і фракцій збережено, тож посилання з `campaigns`, `chronology`, `spellbook`/`abilities` (`lore_creator_npc_id`) лишаються дійсними).

## Ендпоінти

### НІПи (`/npcs`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/npcs` | Bearer JWT | — | `200 { npcs: [...] }` — власні + публічні (адміну — усі) |
| GET | `/npcs/:id` | Bearer JWT | — | `200 { npc }` / `404` / `403` |
| POST | `/npcs` | admin/game_master | `{ name, dexterity, body, intelligence, wisdom, charisma (1..6), species_id?, subspecies_id?, race_id?, people_id?, description?, motivation?, backstory?, image_url?, image_crop?, health_die_override?, age?, gender?, birth_calendar_id?, birth_year?, birth_month_id?, birth_day?, death_calendar_id?, death_year?, death_month_id?, death_day?, private_notes?, is_public? }` | `201 { npc }` / `400` / `403` |
| PATCH | `/npcs/:id` | власник-GM або admin | те саме | `200 { npc }` / `404` / `403` / `400` |
| PATCH | `/npcs/:id/health` | власник-GM або admin | `{ rolled_health }` — додатне ціле або `null` | `200 { npc }` / `400` |
| PATCH | `/npcs/:id/owner` | admin | `{ owner_username }` | `200 { npc }` / `404` |
| DELETE | `/npcs/:id` | власник-GM або admin | — | `204` / `404` / `403` |

- Дати народження та смерті — однакової форми: календар хронології (`*_calendar_id`, голий UUID на `chronology.calendars`), `*_year`, `*_month_id` (`chronology.calendar_months`), `*_day` (≥ 1). Дата смерті порожня — персонаж живий.
- `private_notes` бачать лише автор, будь-який `game_master` та admin — для решти поле вирізається з відповіді, навіть якщо НІП публічний.
- `rolled_health` — одноразово кинутий підсумок здоровʼя; саме його `campaigns` бере при клонуванні НІПа в бій.
- Видалення НІПа прибирає й поліморфні посилання на нього: членство у фракціях (`member_type = 'npc'`) і чужі звʼязки, де він — ціль.

Кожен запис у відповіді додатково несе обчислені поля (`src/dto/stat-block.dto.js`):

- `skills` — 20 фіксованих навичок, кожна з `dice` (d4..d20), похідним від значення керуючого атрибута: `{1: 'd4', 2: 'd6', 3: 'd8', 4: 'd10', 5: 'd12', 6: 'd20'}`.
- `health` — `{ die, count, formula, rolled }`, наприклад `{ die: 'd10', count: 15, formula: '15d10', rolled: 87 }`. `die` — власний `health_die_override`, інакше `health_die` підвиду, інакше виду (міжсхемне читання `compendium.subspecies`/`compendium.species`), інакше `d6`. `count` — за атрибутом `body`: `{1: 6, 2: 11, 3: 15, 4: 18, 5: 20, 6: 21}` (та сама таблиця, що й `PHYSIQUE_HEALTH` гравців).

### Спорядження, заклинання, вміння (`/npcs/:id/{equipment,spells,abilities}`)

Junction-таблиці з голими міжсхемними UUID, однаковий набір маршрутів через фабрики `src/controllers/loadout.controllers.js` + `src/models/relations.model.js`:

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/npcs/:id/equipment` | Bearer JWT (читання запису) | — | `200 { equipment: [...] }` — з вкладеним `equipment` (розвʼязаний по `equipment.items`/`weapons`/`armor`) |
| POST | `/npcs/:id/equipment` | власник-GM або admin | `{ equipment_id }` | `201 { item }` / `400` / `404` якщо предмет не видний користувачу / `403` |
| DELETE | `/npcs/:id/equipment/:equipmentId` | власник-GM або admin | — | `200 { message }` / `404` / `403` |
| GET / POST / DELETE | `/npcs/:id/spells[/:spellId]` | те саме | `{ spell_id }` | `{ spells }` / `{ spell }` |
| GET / POST / DELETE | `/npcs/:id/abilities[/:abilityId]` | те саме | `{ ability_id }` | `{ abilities }` / `{ ability }` |

### Фракції НІПа (`/npcs/:id/factions`)

Членство з боку НІПа — ті самі рядки `npcs.faction_members`, що й `/factions/:id/members`, тож сторінка НІПа і таблиця учасників фракції завжди синхронні. Записувати може той, хто може редагувати **фракцію** (власник-GM або admin), НІП має бути видимим.

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/npcs/:id/factions` | Bearer JWT (НІП видимий) | — | `200 { factions: [{ id, name, symbol_url, is_public, role, is_member, is_leader, can_edit }] }` — лише видимі глядачу фракції, де НІП учасник або лідер |
| POST | `/npcs/:id/factions` | редагування фракції | `{ faction_id, role? }` | `201 { member }` (upsert: повторне додавання оновлює роль) / `400` / `403` / `404` |
| PATCH | `/npcs/:id/factions/:factionId` | редагування фракції | `{ role }` | `200 { member }` / `404` якщо НІП не учасник |
| DELETE | `/npcs/:id/factions/:factionId` | редагування фракції | — | `204` |

### Звʼязки (`/npcs/:id/relationships`)

Спрямовані: "ціль — це `label` для НІПа" (наприклад, `Борис — брат` на сторінці Аліси). Ціль — інший НІП або ігровий персонаж (`character_sheet.characters`).

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/npcs/:id/relationships` | Bearer JWT (НІП видимий) | — | `200 { outgoing: [{ id, target_type, target_id, target, label, note }], incoming: [{ id, npc, label, note }] }` — цілі/джерела, невидимі глядачу, відфільтровано |
| POST | `/npcs/:id/relationships` | власник-GM або admin | `{ target_type ('npc'\|'character'), target_id, label (≤100), note? }` | `201 { relationship }` / `400` (зокрема звʼязок із самим собою) / `404` ціль невидима / `409` звʼязок із цією ціллю вже є |
| PATCH | `/npcs/:id/relationships/:relationshipId` | власник-GM або admin | `{ label, note? }` | `200 { relationship }` / `404` |
| DELETE | `/npcs/:id/relationships/:relationshipId` | власник-GM або admin | — | `204` / `404` |

### Фракції (`/factions`)

CRUD (`GET/POST /factions`, `GET/PATCH/DELETE /factions/:id`, `PATCH /factions/:id/owner`) з полями `name`, `description`, `symbol_url`, `is_public`, плюс:

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/factions/:id/leaders` | читання фракції | — | `200 { leaders }` (з вкладеним `npc`) / `403` для приватної чужої |
| POST | `/factions/:id/leaders` | редагування фракції | `{ npc_entry_id }` | `201 { leader }` / `404` НІП невидимий |
| DELETE | `/factions/:id/leaders/:npcId` | редагування фракції | — | `204` |
| GET | `/factions/:id/members` | читання фракції | — | `200 { members }` — `member_type`, `member_id`, `role`, вкладений `member` |
| POST | `/factions/:id/members` | редагування фракції | `{ member_type ('npc'\|'character'), member_id, role? }` | `201 { member }` (upsert ролі) / `400` / `404` |
| PATCH | `/factions/:id/members/:memberType/:memberId` | редагування фракції | `{ role }` | `200 { member }` / `404` |
| DELETE | `/factions/:id/members/:memberType/:memberId` | редагування фракції | — | `204` / `400` невідомий `memberType` |

Події, у яких НІП брав участь, зберігає сервіс `chronology` (`calendar_event_participants`); сторінка НІПа читає/змінює їх через `GET /api/chronology/events/by-participant/:entryId` і `POST`/`DELETE /api/chronology/:id/events/:eventId/participants`.

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
| POST | `/collections/:id/items` | власник або admin | `{ npc_id }` | `201 { item }` / `400` / `404` |
| DELETE | `/collections/:id/items/:entryId` | власник або admin | — | `200 { message }` / `404` |

### RBAC і видимість

Створення/редагування/видалення — лише `admin` або `game_master`; для `game_master` додатково потрібно бути автором запису (`created_by`), `admin` може редагувати будь-який запис (`src/controllers/access.js`). Читання (`GET`) доступне будь-якому автентифікованому користувачу, але список і поодинокий запис фільтруються: видно власні записи, публічні (`is_public = true`) записи та (для адміна) усе.

Авторизація: заголовок `Authorization: Bearer <access_token>`, перевіряється middleware `src/middleware/auth.middleware.js` (`JWT_ACCESS_SECRET`); `req.user.sub` — id користувача, `req.user.role` — роль.

Помилки, що не є валідацією (400), not-found (404) чи forbidden (403), пробрасываются в глобальний обробник помилок `src/index.js` і повертаються як `err.statusCode || 500`.

## Схема БД

Сервіс володіє схемою `npcs` (`86-split-compendium.sql`):

- `npcs.npcs` — поля НІПа (див. вище), таксономія — голі UUID на `compendium.*` (обнуляються тригерами compendium при видаленні), дати народження/смерті — голі UUID на `chronology.*`.
- `npcs.npc_equipment` / `npc_spells` / `npc_abilities` — `npc_id` (FK CASCADE) + голий зовнішній id, `UNIQUE`.
- `npcs.factions`, `npcs.faction_leaders` (`npc_entry_id` FK → `npcs.npcs` CASCADE), `npcs.faction_members` (`member_type` + голий `member_id`, `role VARCHAR(200)`, `UNIQUE (faction_id, member_type, member_id)`).
- `npcs.npc_relationships` — `npc_id` (FK CASCADE), `target_type` + голий `target_id`, `label`, `note`, `UNIQUE (npc_id, target_type, target_id)`, `CHECK` проти звʼязку із собою.
- `npcs.collections` / `collection_items` (`npc_id` FK CASCADE).

Під час міграції старе текстове поле `faction` перетворено на членство, якщо воно точно (без регістру) збігалося з однією видимою автору фракцією; інакше текст дописано в `private_notes`.

Міжсхемні читання: `compendium.species`/`subspecies`, `character_sheet.characters` (учасники/цілі звʼязків), `equipment.*`, `spellbook.spells`, `abilities.entries`, `auth.users`.

## Змінні оточення

Читаються у `src/`:

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — підключення до БД (`src/config/db.js`).
- `JWT_ACCESS_SECRET` — перевірка access-токена (`src/middleware/auth.middleware.js`).
- `FRONTEND_URL` — дозволений origin для CORS (`src/index.js`), за замовчуванням `http://localhost`.
- `PORT` — порт сервіса (`src/index.js`), за замовчуванням `3017`.

## Тести

```bash
cd services/npcs
npm install
npm test
```

Тести — Jest, лежать поряд з кодом у `src/**/__tests__`. Контролери тестуються з замоканими моделями (`jest.mock('../../models/...')`), моделі — із замоканим `pool` (`jest.mock('../../config/db')`), без підключення до реальної БД.
