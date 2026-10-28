# spellbook

Книга заклинань: каталог заклинань (із формами), традиції магії та іменовані колекції заклинань. Порт **3003** (`/api/spellbook/` через Nginx), схема БД `spellbook`.

Доступність заклинань персонажу визначає не цей сервіс, а [character-sheet](character-sheet.md) за правилами дерева розвитку: заклинання доступне, коли відкрито хоч одну з його **традицій** і складність форми не вища за найвищу відкриту вузлами (міграція 91; дерево зберігає `unlocks_traditions` і `unlocks_complexity`, див. [skill-tree](skill-tree.md)). У самих заклинань вимог-вузлів (`prerequisite_node_ids`) більше нема.

## Ендпоінти

Усі відповіді — JSON. Роутери монтуються так: `/collections` → колекції, `/traditions` → традиції, решта (корінь) → заклинання. Авторизація — `Authorization: Bearer <access-token>` (`requireAuth`, `JWT_ACCESS_SECRET`, payload у `req.user`, `req.user.sub` — id), крім одного публічного шляху. Ролі `admin` і `game_master` — «канонічні менеджери» (`requireCanonicalManager`), лише `admin` — `requireAdminOwner`.

### Заклинання (`/`)

| Метод | Шлях | Авторизація | Тіло / query | Відповідь |
|---|---|---|---|---|
| GET | `/` | так | query: `nature`, `spell_kind`, `ritual`, `complexity`, `tradition`, `search`, `sort`, `scope`, `limit` | `200 { spells: [...] }` — власні + публічні (адмін бачить усе) |
| GET | `/export` | так | ті самі фільтри, або `?id=` для одного запису | `200 [ ...заклинання ]` — масив у форматі імпорту |
| POST | `/import` | `admin` / `game_master` | масив заклинань | `201 { imported }` / `400` (не масив) |
| GET | `/kinds` | так | — | `200 { spell_kinds: [{ key, label }] }` — з `admin.site_configs` |
| GET | `/magic-forms` | так | — | `200 { magic_forms: [{ key, label, description }] }` — з `admin.site_configs` |
| GET | `/:id` | так | — | `200 { spell }` / `404` |
| POST | `/` | так | поля заклинання (нижче) | `201 { spell }` / `400` (без `name` або змішані форми) |
| PUT | `/:id` | так | ті самі поля | `200 { spell }` / `400` / `404` (нема або чуже; адмін може все) |
| DELETE | `/:id` | так | — | `200 { message }` / `404` |
| PATCH | `/:id/canonical` | `admin` / `game_master` | `{ is_canonical? }` (за замовчуванням `true`) | `200 { spell }` / `404` |
| PATCH | `/:id/owner` | лише `admin` | `{ owner_username }` | `200 { spell }` / `400` / `404` |

Поля заклинання: `name` (обовʼязкове), `nature` (масив **форм магії**, див. нижче), `spell_kind` (за замовчуванням `utility`; перелік — `/kinds`), `mechanical_desc`, `narrative_desc` (rich-text HTML), `energy_cost` (0), `action_time` (1–3, за замовчуванням 1), `ritual` (`impossible`/`possible`/`required`), `duration_value` + `duration_unit` (`instant`/`action`/`round`/`seconds`/`minutes`/`hours`/`days`/`permanent`), `range_desc`, `components` (JSONB-масив `{ item_id, name, quantity, unit }`), `is_public`, `image_url`, `image_crop`, `lore_creator`, `lore_creator_npc_id`, `complexity`, `forms[]`, `main_form_name`. `PUT` перезаписує всі поля.

Query-параметри `GET /` (повторюваний параметр дає масив, значення зʼєднуються через OR):
- `nature` — перетин з масивом форм магії заклинання (`s.nature && …`);
- `spell_kind`, `ritual` — точний збіг;
- `complexity` — `primitive`/`simple`/`medium`/`complex`/`extreme`; підходить, якщо **будь-яка** форма має обрану складність;
- `tradition` — один чи кілька id традицій;
- `search` — `ILIKE` за назвою;
- `sort` — `name` (типово), `action_time` або `energy_cost`; невідоме значення → `name`;
- `scope` — `canonical` (`is_canonical`), `user` (решта), `community` (публічні записи **інших**, не канонічні — рейл «Творіння спільноти» на Dashboard);
- `limit`.

Відповіді додають `traditions: [{ id, name }]`, `is_owner`, `is_canonical`, `owner_username`.

### Форми магії (`nature`)

`nature` — `TEXT[]` із фіксованого набору `arcana`, `elemental`, `integral`, `pact`, `nature`, `blight` (CHECK `spells_nature_check`, міграція 93; раніше колонка мала інші значення, `infernal` перейменовано на `pact` — старі експорти з `infernal` перетворюються автоматично). Назви й описи форм редагує адмін ([admin](admin.md), ключ `magic_forms`). Старий параметр `magic_type` більше не існує.

### Форми заклинання (`forms`)

Колонки самого рядка — **основна форма** (при рівневих — «Повноцінна»), `forms` (JSONB) — додаткові, `main_form_name` — назва основної. Кожна додаткова форма — `{ kind, id, name }` плюс знімок полів, що можуть відрізнятися: `complexity`, `spell_kind`, `energy_cost`, `action_time`, `ritual`, `duration_value`, `duration_unit`, `range_desc`, `components`, `mechanical_desc`, `narrative_desc`, `lore_creator`, `lore_creator_npc_id` (нормалізує `normalizeForms`, білий список полів).

- `primitive` / `perfected` — рівневі, не більше однієї кожного виду, `id = kind`;
- `alternative` — альтернативна, власна `name`, `id` — UUID, стабільний між збереженнями (на нього посилається лист персонажа: `known_spells.form_tier / primary_form / mastered_forms`).

Не можна змішувати рівневі й альтернативні: `POST`/`PUT` → `400`; імпорт мовчки відкидає альтернативні. Назва, форми магії, зображення, видимість, традиції й колекції спільні для всіх форм. Фільтри й сортування (крім `complexity`) працюють з основною формою. Заміна старих «рівнів» (`levels`, `parent_spell_id`) на форми — міграція 81.

### Імпорт / експорт

Експорт прибирає `image_url`, `image_crop`, `created_at`, `updated_at`, `is_owner`, `owner_username`, `is_canonical`, `traditions`. Імпорт: власник — імпортер, `is_canonical = true` (дозволено лише `admin`/`game_master`), записи без `name` пропускаються, один багаторядковий `INSERT`.

### Традиції (`/traditions`)

Традиція — іменована школа/напрям магії, до якого належать заклинання (звʼязок багато-до-багатьох). Власника в традицій нема.

| Метод | Шлях | Авторизація | Тіло / query | Відповідь |
|---|---|---|---|---|
| GET | `/traditions` | так | query: `search` | `200 { traditions: [{ …, spells: [{ id, name }] }] }` |
| GET | `/traditions/:id` | так | — | `200 { tradition }` / `404` |
| POST | `/traditions` | `admin` / `game_master` | `{ name, description?, founders? }` | `201 { tradition }` / `400` |
| PUT | `/traditions/:id` | `admin` / `game_master` | ті самі поля | `200 { tradition }` / `404` |
| DELETE | `/traditions/:id` | `admin` / `game_master` | — | `200 { message }` / `404` (знімок у `trash.deleted_records`) |
| POST | `/traditions/:id/spells` | так | `{ spell_id }` | `201 { item }` / `400` / `404` |
| DELETE | `/traditions/:id/spells/:spellId` | так | — | `200 { message }` / `404` |

Привʼязувати заклинання до традиції може власник заклинання (або адмін) — це частина редагування заклинання; повторне додавання ігнорується (`ON CONFLICT DO NOTHING`).

### Колекції (`/collections`)

| Метод | Шлях | Авторизація | Тіло / query | Відповідь |
|---|---|---|---|---|
| GET | `/collections/public/:id` | **ні** | — | `200 { collection }` / `404` (нема або не публічна) |
| GET | `/collections` | так | query: `search`, `scope` | `200 { collections: [...] }` |
| POST | `/collections` | так | `{ name, description?, is_public?, image_url?, image_crop? }` | `201 { collection }` / `400` |
| POST | `/collections/import` | так | обʼєкт колекції або масив | `201 { collections, imported_items, items_skipped }` / `400` |
| GET | `/collections/:id` | так | — | `200 { collection }` / `404` |
| GET | `/collections/:id/export` | так | — | `200` колекція з повними заклинаннями в `items` |
| PUT | `/collections/:id` | так | ті самі поля | `200 { collection }` / `404` |
| DELETE | `/collections/:id` | так | — | `200 { message }` / `404` |
| PATCH | `/collections/:id/canonical` | `admin` / `game_master` | `{ is_canonical? }` | `200 { collection }` / `404` |
| PATCH | `/collections/:id/owner` | лише `admin` | `{ owner_username }` | `200 { collection }` / `400` / `404` |
| POST | `/collections/:id/items` | так | `{ spell_id }` | `201 { item }` / `400` / `404` (колекція не ваша чи заклинання недоступне) |
| DELETE | `/collections/:id/items/:itemId` | так | — | `200 { message }` / `404` |

- `collection.items` — вкладений масив **зрізів** заклинань (`id, name, nature, spell_kind, mechanical_desc, narrative_desc, energy_cost, action_time, ritual, duration_*, range_desc, components, is_public, image_url, image_crop`), агрегований у БД; без `forms`/`complexity`.
- Колонки `prerequisite_node_ids` / `prerequisite_logic` в колекцій лишились (спільна модель колекцій), але для колекцій заклинань вони не задаються й не діють (міграція 91).
- Імпорт колекції доступний будь-кому; вкладені `items` приймаються лише від `admin`/`game_master` (стають канонічними), решта лічиться в `items_skipped`; при збої вставки нову колекцію прибирають.

Несподівані помилки йдуть у глобальний error-handler (`err.statusCode || 500`).

## Схема БД

Сервіс володіє схемою `spellbook`:

- **`spellbook.spells`** — `id`, `user_id`, `name`, `nature TEXT[]`, `spell_kind`, `mechanical_desc`, `narrative_desc`, `energy_cost`, `action_time` (1–3), `ritual`, `duration_value`, `duration_unit`, `range_desc`, `components JSONB`, `is_public`, `image_url`, `image_crop`, `lore_creator`, `lore_creator_npc_id` (голий UUID НІПа, без FK), `complexity`, `forms JSONB`, `main_form_name`, `is_canonical`, `created_at`, `updated_at`.
- **`spellbook.traditions`** — `id`, `name`, `description`, `founders`, `creator_id`, `created_at`, `updated_at`.
- **`spellbook.tradition_spells`** — `tradition_id` ↔ `spell_id` (обидві FK `ON DELETE CASCADE`, `UNIQUE`).
- **`spellbook.collections`** — `id`, `user_id`, `name`, `description`, `is_public`, `prerequisite_node_ids`/`prerequisite_logic` (не використовуються), `image_url`, `image_crop`, `is_canonical`, часові мітки.
- **`spellbook.collection_items`** — `collection_id` ↔ `spell_id` (`ON DELETE CASCADE`, `UNIQUE (collection_id, spell_id)`).

Міжсхемні читання: `auth.users` (`owner_username`) та `admin.site_configs` (`spell_kinds`, `magic_forms`). Видалення заклинання/колекції/традиції пише знімок у `trash.deleted_records` (`src/utils/trash.js`, міграція 33).

Міграції: 2 (init), 20 (колекції), 30 (природа, лор, компоненти), 31 (традиції), 79–82 (складність → рівні → форми), 83 (канонічність, `spell_kinds`), 85 (`image_crop`), 91 (доступ через дерево), 92 (одиниці `round`/`action`), 93 (форми магії).

## Змінні оточення

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — спільна БД (`src/config/db.js`).
- `JWT_ACCESS_SECRET` — перевірка access-токена (`src/middleware/auth.middleware.js`).
- `FRONTEND_URL` — дозволений origin для CORS (типово `http://localhost`).
- `PORT` — порт сервіса (типово `3003`).

## Тести

```bash
cd services/spellbook
npm install
npm test
```

Jest; контролери й моделі мокають залежності (`jest.mock`), реальна БД не потрібна. Тести лежать поряд із кодом у `src/**/__tests__`.
