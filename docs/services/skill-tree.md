# skill-tree

Сервіс дерева розвитку: вузли (`nodes`), звʼязки між ними (`edges`), прив'язки вузлів до вмінь і колекцій вмінь (`node_grants` — з режимом «видавати автоматично» чи «робити доступним» та необовʼязковою формою), налаштування вкладок архетипів (`archetype_settings`: фон і розкладка), а також експорт/імпорт цілого дерева **або окремих вузлів/гілок** JSON-документом. Вузли також відкривають **традиції та складність заклинань** (`unlocks_traditions`, `unlocks_complexity`) — самі заклинання вузли не видають. Порт **3004**, проксується Nginx як `/api/skill-tree/`, схема БД `skill_tree`.

Прогрес персонажів по вузлах живе не тут, а в `character_sheet.tree_progress` ([character-sheet](character-sheet.md)): саме він відкриває вузли, списує досвід і застосовує `node_grants`.

## Ендпоінти

Усі маршрути змонтовані в корені сервіса (`src/routes/skill-tree.routes.js`), тобто зовні: `/api/skill-tree/...`.

### Вузли (`src/controllers/node.controller.js`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/nodes` | Bearer JWT | — (query: `archetype?`) | `200 { nodes: [...] }` — кожен вузол містить `grants: [{ item_kind, item_id, mode, form_key }]` |
| POST | `/nodes` | Bearer JWT, роль `game_master` або `admin` | `{ title, description?, icon?, cost?, pos_x?, pos_y?, narrative_condition?, effect?, archetype?, require_both?, is_root?, grants?, unlocks_traditions?, unlocks_complexity? }` — без валідації більшості полів; `grants` замінює список прив'язок вузла; `unlocks_traditions` — масив UUID традицій [spellbook](spellbook.md), `unlocks_complexity` — `primitive`/`simple`/`medium`/`complex`/`extreme` або `null` (некоректні значення відкидаються) | `201 { node }` |
| PUT | `/nodes/:id` | Bearer JWT, роль `game_master` | те саме, що й POST; `grants` перезаписується лише якщо ключ переданий (drag-reorder PATCH його не чіпає) | `200 { node }` / `404` якщо вузол не знайдено |
| DELETE | `/nodes/:id` | Bearer JWT, роль `game_master` | — | `200 { message: 'Видалено' }` / `404` якщо вузол не знайдено |

### Звʼязки (`src/controllers/edge.controller.js`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/edges` | Bearer JWT | — (query: `archetype?`, фільтрує за архетипом вузла-джерела) | `200 { edges: [...] }` |
| POST | `/edges` | Bearer JWT, роль `game_master` | `{ source_id, target_id (обидва обовʼязкові), edge_type? }` | `201 { edge }` / `400` якщо відсутні `source_id`/`target_id`, `409` при дублікаті звʼязку (унікальний індекс), `400` при неіснуючому вузлі (FK) |
| PATCH | `/edges/:id` | Bearer JWT, роль `game_master` | `{ edge_type }` — має бути `'required'` або `'optional'` | `200 { edge }` / `400` при невірному `edge_type` / `404` якщо звʼязок не знайдено |
| DELETE | `/edges/:id` | Bearer JWT, роль `game_master` | — | `200 { message: 'Видалено' }` / `404` якщо звʼязок не знайдено |

### Налаштування вкладок (`src/controllers/settings.controller.js`)

Кожна вкладка архетипу (`fighter`, `spellcaster`, `rogue`) має фонове зображення та розкладку.

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/settings` | Bearer JWT | — | `200 { settings: [{ archetype, background_url, layout }] }` |
| PUT | `/settings/:archetype` | `game_master` / `admin` | `{ layout?: 'tree' \| 'star', background_url?: string \| null }` (URL — `/…` або `https://…`, до 500 символів; `null` чи `''` прибирає фон) | `200 { settings }` / `400` (невідомий архетип, некоректні значення чи порожнє тіло) |

### Експорт / імпорт дерева (`src/controllers/tree.controller.js`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/export` | Bearer JWT | — (query: `archetype?`) | `200 { nodes: [...], edges: [...] }` — усі вузли (з `grants`) та звʼязки, за потреби відфільтровані за архетипом |
| POST | `/import` | Bearer JWT, роль `game_master` | `{ nodes: [...], edges: [...], archetype }` | `200 { message, nodeCount, edgeCount }` / `400` при невірному форматі або якщо якийсь вузол належить іншому архетипу |
| POST | `/import-nodes` | Bearer JWT, роль `game_master` | `{ nodes: [...], edges: [...], archetype, attach_to_node_id? }` | `200 { message, nodeCount, edgeCount }` / `400` при невірному форматі, порожньому наборі, або якщо `attach_to_node_id` належить іншому архетипу |

Формат JSON для `/export` і `/import` — однаковий: `nodes` — масив об'єктів вузлів (поля як у схемі `skill_tree.nodes`, `id` включно, плюс `grants`), `edges` — масив `{ source_id, target_id, edge_type? }`, що посилаються на `id` вузлів з того ж документа. `POST /import` повністю перезаписує вузли/звʼязки/grants **лише вказаного архетипу** (`DELETE ... WHERE archetype = $1` з каскадом, в одній транзакції) — інші архетипи не зачіпаються.

`POST /import-nodes` — **не деструктивний**: додає підмножину вузлів (один вузол чи вузол + гілки), кожен з **новим** `id`, у вказаний архетип (`is_root` завжди `false`); внутрішні ребра/grants ремапляться на нові `id`. Кожен імпортований вузол без вхідного ребра в межах набору приєднується ребром `required` до `attach_to_node_id` (якщо переданий); інакше лишається орфаном для ручного з'єднання. Частковий документ позначається `partial: true` у файлі експорту вузла.

### Невикористаний код прогресу

`src/controllers/progress.controller.js` і `src/models/progress.model.js` (`myProgress`, `unlock`, `lock`, `allProgress`) — спадщина часів, коли прогрес належав користувачу, а не персонажу. Жоден маршрут їх не монтує, а таблицю `skill_tree.player_progress` прибрала міграція 05 (`05-character-sheet.sql`). Код лишився лише з тестами; реальний прогрес — `character_sheet.tree_progress`.

Авторизація: заголовок `Authorization: Bearer <access_token>`, перевіряється `src/middleware/auth.middleware.js` (`JWT_ACCESS_SECRET`); `requireGameMaster` додатково вимагає роль `game_master` **або** `admin`. Тому в таблицях вище «роль `game_master`» означає «майстер чи адмін».

Помилки, що не є валідацією (400/409) чи not-found (404), пробрасываются в глобальний обробник помилок `src/index.js` і повертаються як `err.statusCode || 500`.

## Схема БД

Сервіс володіє схемою `skill_tree`:

- `skill_tree.nodes` — вузол: `title`, `description` (rich-text HTML), `icon`, `cost` (пункти досвіду; 0 = безкоштовний), `pos_x`/`pos_y`, `narrative_condition` (`TEXT[]` — нарративні умови відкриття), `effect` (`TEXT[]`), `archetype` (вкладка), `archetypes` (`TEXT[]`), `require_both` (потрібні і пункти, і нарративна умова), `is_root`, `unlocks_traditions` (`UUID[]`, голі UUID без FK), `unlocks_complexity` (`TEXT`, CHECK на 5 значень).
- `skill_tree.edges` — звʼязок між двома вузлами: `source_id`, `target_id` (обидва `ON DELETE CASCADE`, унікальна пара, `source_id <> target_id`), `edge_type` (`required` | `optional`).
- `skill_tree.node_grants` — прив'язка вузла до запису каталогу: `node_id` (`ON DELETE CASCADE`), `item_kind` (`ability` | `ability_collection`; з міграції 91 прив'язок до заклинань, їхніх колекцій і окремих маневрів нема — маневр це `ability` з `is_maneuver`), `item_id` (голий UUID у `abilities.*`/`spellbook.*`, без FK), `mode` (`grant` — відкриття вузла додає запис у лист персонажа; `unlock` — лише робить доступним для ручного додавання), `form_key` (лише для `ability`: `NULL` — усі форми; інакше ключ форми `main`/`primitive`/`perfected`/UUID альтернативної), унікальна трійка `(node_id, item_kind, item_id)`. Читається character-sheet сервісом при відкритті вузла (`tree-progress.model.js`) та при перевірці передумов (`prerequisite.model.js`).
- `skill_tree.archetype_settings` — `archetype` (PK), `background_url`, `layout` (`tree`/`star`), `updated_at` (міграція 94).

DDL — `database/init/03-skill-tree.sql`, `database/init/05-skill-tree-racial.sql`, `database/init/06-default-archetype-nodes.sql` та подальші міграції `database/migrations/{01–04,09,11,71,90,91,94}-*.sql` (71 — `node_grants`, 90 — `form_key`, 91 — `unlocks_*` і звуження `item_kind`, 94 — налаштування вкладок).

## Змінні оточення

Читаються у `src/`:

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — підключення до БД (`src/config/db.js`).
- `JWT_ACCESS_SECRET` — перевірка access-токена (`src/middleware/auth.middleware.js`).
- `FRONTEND_URL` — дозволений origin для CORS (`src/index.js`), за замовчуванням `http://localhost`.
- `PORT` — порт сервіса (`src/index.js`), за замовчуванням `3004`.

## Тести

```bash
cd services/skill-tree
npm install
npm test
```

Тести — Jest, лежать поряд з кодом у `src/**/__tests__`. Контролери тестуються з замоканими моделями (`jest.mock('../../models/...')`), моделі — з замоканим `pool` (`jest.mock('../../config/db')`), без підключення до реальної БД.
