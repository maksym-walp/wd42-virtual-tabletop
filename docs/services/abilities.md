# abilities

Сервіс «Вміння та маневри» — власні та канонічні (ГМ) записи вмінь (за архетипами), плюс колекції (набори), якими можна ділитись через публічне посилання. Порт **3009** (`/api/abilities/` через Nginx), схема БД `abilities`.

**Маневр — це вміння з `is_maneuver = true`**, а не окрема сутність. Спершу маневри були окремим сервісом, міграція `52-merge-maneuvers-into-abilities.sql` влила їх сюди як таблицю `abilities.maneuvers`, а `72-merge-maneuvers-into-ability-entries.sql` перенесла їхні рядки в `abilities.entries` (з тими самими `id`, `archetypes = {fighter}`, `duration_unit = 'action'`) і прибрала `abilities.maneuvers`. Ендпоінтів `/maneuvers` більше нема — маневри фільтруються параметром `is_maneuver` у звичайному каталозі вмінь. Посилання на їхні `id` з інших схем (`character_sheet.maneuvers.maneuver_id`, `skill_tree.node_grants` з `item_kind='maneuver'`, `compendium.compendium_maneuvers`) збережені.

## Ендпоінти

Усі шляхи — відносно кореня сервіса (Nginx проксує `/api/abilities/*` сюди). Авторизація — `Authorization: Bearer <access-token>` (`requireAuth`, `JWT_ACCESS_SECRET`), крім одного публічного шляху. Ролі, що керують «канонічним» контентом (`CANONICAL_ROLES`): `admin` і `game_master`.

### Вміння (`/`)

| Метод | Шлях | Авторизація | Тіло / query | Відповідь |
|---|---|---|---|---|
| GET | `/` | так | query: `search`, `sort` (лише `name`), `archetype`, `scope`, `is_maneuver` (`true`/`false`), `limit` | `200 { abilities: [...] }` |
| GET | `/export` | так | ті самі фільтри, що й `GET /`, або `?id=` для рівно одного запису | `200 [ ...записи ]` — масив у форматі імпорту |
| POST | `/import` | `admin` / `game_master` | масив записів у форматі експорту | `201 { imported }` / `400` (не масив) / `403` |
| GET | `/:id` | так | — | `200 { ability }` / `404` |
| POST | `/` | так | поля запису (див. нижче) | `201 { ability }` / `400` (без `name` або змішані форми) |
| PUT | `/:id` | так | ті самі поля | `200 { ability }` / `400` / `404` (не існує або чужий — адмін може все) |
| DELETE | `/:id` | так | — | `200 { message }` / `404` |
| PATCH | `/:id/canonical` | `admin` / `game_master` | `{ is_canonical? }` (за замовчуванням `true`) | `200 { ability }` / `404` |
| PATCH | `/:id/owner` | лише `admin` | `{ owner_username }` | `200 { ability }` / `400` / `404` (запису чи користувача нема) |

Поля запису (`POST`/`PUT`): `name` (обовʼязкове), `archetypes[]`, `mechanical_desc`, `narrative_desc` (rich-text HTML), `is_public`, `prerequisite_node_ids[]`, `prerequisite_logic` (`or`/`and`), `image_url`, `image_crop`, `is_maneuver`, `duration_value` + `duration_unit` (`instant`/`action`/`round`/`seconds`/`minutes`/`hours`/`days`/`permanent`), `lore_creator` (вільний текст) і `lore_creator_npc_id` (НІП з [npcs](npcs.md), голий UUID), `components[]` (`{ item_id, name, quantity, unit }` — як у заклинань; вміст не перевіряється, лише що це масив), `forms[]` та `main_form_name` (див. нижче). `PUT` перезаписує всі поля — відсутні скидаються до значень за замовчуванням.

Примітки:
- Видимість: `GET /` повертає власні записи плюс усі публічні (`is_public`); адмін бачить усе.
- `scope`: `canonical` — лише з `is_canonical = true`; `user` — решта; `community` — публічні записи **інших** авторів, не канонічні (рейл «Творіння спільноти» на Dashboard; замінює типову умову власності).
- **Канонічність** — лише явний прапорець `is_canonical`. Створюючи запис, `admin`/`game_master` отримує його автоматично (якщо не передати `is_canonical: false`); раніше «канонічний» виводилось з ролі автора, і таке не можна було зняти (міграція 83). `PATCH /:id/canonical` перемикає прапорець на чужому записі.
- `archetype` фільтрує за `$n = ANY(archetypes)`.
- Видалення зберігає знімок рядка й каскадно видалених `collection_items` у `trash.deleted_records` (`src/utils/trash.js`, міграція 33) — відновлюється вручну через adminer.
- `image_crop` — `{ x, y, zoom, ratio }` (кадрування під картку, міграція 85); некоректне значення тихо стає `null` (`src/utils/image-crop.js`).

### Форми вмінь

Та сама модель, що й у заклинань ([spellbook](spellbook.md)): колонки самого запису — **основна форма** (при рівневих формах — «Повноцінна»), `forms` (JSONB) — додаткові, `main_form_name` — назва основної форми. Види форм (`kind`):

- **рівневі** `primitive` / `perfected` — не більше однієї кожного виду, `id = kind`;
- **альтернативні** `alternative` — власна назва, `id` — UUID (наявний зберігається, бо на нього посилаються лист персонажа та вузли дерева).

Одне вміння має або рівневі, або альтернативні форми — не обидва типи. `POST`/`PUT` з обома відповідають `400` («Вміння не може мати одночасно рівневі й альтернативні форми»); імпорт натомість мовчки відкидає альтернативні. Кожна форма має власні `duration_*`, `mechanical_desc`, `narrative_desc`, `lore_creator*`, `components`. Освоєння форм персонажем — `character_sheet.abilities.form_tier / primary_form / mastered_forms`, вибір форми у вузлі дерева — `skill_tree.node_grants.form_key` (міграція 90).

### Імпорт / експорт

Експорт прибирає все, що прив'язане до конкретного деплою чи користувача: `image_url`, `image_crop`, `created_at`, `updated_at`, `is_owner`, `owner_username`, `is_canonical`, `prerequisite_node_ids`, `prerequisite_logic`, `prerequisite_nodes` (вузли дерева в іншому місці не мають сенсу). Імпорт ігнорує `user_id`: власник — той, хто імпортує; `is_canonical = true` (імпортувати можуть лише `admin`/`game_master`); записи без `name` пропускаються; усі записи вставляються одним `INSERT`.

### Колекції (`/collections`)

| Метод | Шлях | Авторизація | Тіло / query | Відповідь |
|---|---|---|---|---|
| GET | `/collections/public/:id` | **ні** | — | `200 { collection }` / `404` (нема або не публічна) |
| GET | `/collections` | так | query: `search`, `scope` (`canonical`/`user`) | `200 { collections: [...] }` |
| POST | `/collections` | так | `{ name, description?, is_public?, prerequisite_node_ids?, prerequisite_logic?, image_url?, image_crop? }` | `201 { collection }` / `400` (без `name`) |
| POST | `/collections/import` | так | обʼєкт колекції або масив | `201 { collections, imported_items, items_skipped }` / `400` |
| GET | `/collections/:id` | так | — | `200 { collection }` / `404` |
| GET | `/collections/:id/export` | так | — | `200` обʼєкт колекції з повними записами в `items` |
| PUT | `/collections/:id` | так | ті самі поля, що й POST | `200 { collection }` / `404` |
| DELETE | `/collections/:id` | так | — | `200 { message }` / `404` |
| PATCH | `/collections/:id/canonical` | `admin` / `game_master` | `{ is_canonical? }` | `200 { collection }` / `404` |
| PATCH | `/collections/:id/owner` | лише `admin` | `{ owner_username }` | `200 { collection }` / `400` / `404` |
| POST | `/collections/:id/items` | так | `{ item_id }` (id вміння) | `201 { item }` / `400` / `404` |
| DELETE | `/collections/:id/items/:itemId` | так | — | `200 { message }` / `404` |

- Колекція — набір вмінь (маневри теж, бо це ті самі записи); зв'язка `abilities.collection_items (collection_id, ability_id)` — звичайна FK на `abilities.entries`.
- Кожна колекція у відповіді містить `items` — зріз полів вмінь (`id, name, mechanical_desc, narrative_desc, type: 'ability', archetypes, is_maneuver, duration_value, duration_unit, is_public, prerequisite_node_ids, prerequisite_logic, image_url, image_crop`).
- Додавати елементи може лише власник колекції (або адмін) і лише ті записи, які він бачить (власні чи публічні); інакше `404`.
- `GET /collections/public/:id` — неавтентифікований шлях для посилань на публічні колекції.
- Імпорт колекції доступний будь-кому, але вкладені `items` імпортуються лише для `admin`/`game_master` (стають канонічними); решта лічиться в `items_skipped`. Якщо вставка вкладених записів падає, щойно створену колекцію прибирають (`discard`).
- Експорт збирає повні записи тим самим `findById`, що й каталог; невидимі користувачу (чужі приватні) пропускаються.

Неочікувані помилки (збій БД) не перехоплюються контролерами — вони йдуть у глобальний error-handler у `src/index.js` (`err.statusCode || 500`).

## Схема БД

Сервіс володіє схемою `abilities`:

- `abilities.entries` — вміння/маневри: `user_id`, `name`, `archetypes TEXT[]`, `mechanical_desc`, `narrative_desc` (міграція 77 розділила колишній `description`), `is_public`, `prerequisite_node_ids`, `prerequisite_logic`, `image_url`, `image_crop`, `is_maneuver`, `duration_value`, `duration_unit`, `lore_creator`, `lore_creator_npc_id`, `is_canonical`, `forms JSONB`, `main_form_name`, `components JSONB`, `created_at`, `updated_at`.
- `abilities.collections` — колекції: `user_id`, `name`, `description`, `is_public`, `prerequisite_node_ids`, `prerequisite_logic`, `image_url`, `image_crop`, `is_canonical`.
- `abilities.collection_items` — `collection_id` ↔ `ability_id` (FK на `abilities.entries`).

На `id` вмінь ззовні посилаються голими UUID `character_sheet.abilities.ability_id`, `character_sheet.maneuvers.maneuver_id`, `skill_tree.node_grants` та `compendium`.

Читає (без запису), міжсхемно:
- `skill_tree.nodes` — назви вузлів-передумов (`prerequisite_nodes`);
- `auth.users` — `owner_username`, перепризначення власника.

Міграції: 18 (створення), 52/72 (злиття маневрів), 73 (автор-НІП), 77 (розділення опису), 83 (канонічність), 85 (`image_crop`), 90 (форми), 92 (компоненти, одиниці `round`/`action`).

## Змінні оточення

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — підключення до спільної БД.
- `JWT_ACCESS_SECRET` — перевірка access-токена.
- `FRONTEND_URL` — дозволений origin для CORS.
- `PORT` — порт сервіса (за замовчуванням `3009`; у docker-compose задається окремо).

## Тести

```bash
cd services/abilities
npm install
npm test
```

Або в запущеному dev-контейнері: `docker exec walp-abilities npx jest`.

Покриття: моделі (`src/models/__tests__`), контролери (`src/controllers/__tests__`), auth-middleware (`src/middleware/__tests__`). Контролери тестуються з замоканими моделями — перевіряються коди статусів, форма відповіді та те, що неочікувані помилки прокидаються до error-handler'а.
