# skill-tree

Сервіс дерева навичок: вузли (`nodes`), звʼязки між ними (`edges`), прогрес гравців по вузлах (`player_progress`), а також експорт/імпорт цілого дерева одним JSON-документом (для перенесення дерева архетипу між середовищами). Порт **3004**, проксується Nginx як `/api/skill-tree/`.

## Ендпоінти

Усі маршрути змонтовані в корені сервіса (`src/routes/skill-tree.routes.js`), тобто зовні: `/api/skill-tree/...`.

### Вузли (`src/controllers/node.controller.js`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/nodes` | Bearer JWT | — (query: `race?`, `archetype?`) | `200 { nodes: [...] }` |
| POST | `/nodes` | Bearer JWT, роль `game_master` | `{ title, description?, icon?, cost?, pos_x?, pos_y?, narrative_condition?, effect?, races?, archetype?, require_both?, is_root?, replaces_node_id? }` — без валідації полів | `201 { node }` |
| PUT | `/nodes/:id` | Bearer JWT, роль `game_master` | те саме, що й POST | `200 { node }` / `404` якщо вузол не знайдено |
| DELETE | `/nodes/:id` | Bearer JWT, роль `game_master` | — | `200 { message: 'Видалено' }` / `404` якщо вузол не знайдено |

### Звʼязки (`src/controllers/edge.controller.js`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/edges` | Bearer JWT | — (query: `archetype?`, фільтрує за архетипом вузла-джерела) | `200 { edges: [...] }` |
| POST | `/edges` | Bearer JWT, роль `game_master` | `{ source_id, target_id (обидва обовʼязкові), edge_type? }` | `201 { edge }` / `400` якщо відсутні `source_id`/`target_id`, `409` при дублікаті звʼязку (унікальний індекс), `400` при неіснуючому вузлі (FK) |
| PATCH | `/edges/:id` | Bearer JWT, роль `game_master` | `{ edge_type }` — має бути `'required'` або `'optional'` | `200 { edge }` / `400` при невірному `edge_type` / `404` якщо звʼязок не знайдено |
| DELETE | `/edges/:id` | Bearer JWT, роль `game_master` | — | `200 { message: 'Видалено' }` / `404` якщо звʼязок не знайдено |

### Експорт / імпорт дерева (`src/controllers/tree.controller.js`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/export` | Bearer JWT | — (query: `archetype?`) | `200 { nodes: [...], edges: [...] }` — усі вузли/звʼязки, за потреби відфільтровані за архетипом |
| POST | `/import` | Bearer JWT, роль `game_master` | `{ nodes: [...], edges: [...], archetype }` | `200 { message, nodeCount, edgeCount }` / `400` при невірному форматі або якщо якийсь вузол належить іншому архетипу |

Формат JSON для `/export` і `/import` — однаковий: `nodes` — масив об'єктів вузлів (поля як у схемі `skill_tree.nodes`, `id` включно — щоб зберегти звʼязки `replaces_node_id`), `edges` — масив `{ source_id, target_id, edge_type? }` з `id`, що посилаються на `id` вузлів з того ж документа. `POST /import` повністю перезаписує вузли й звʼязки **лише вказаного архетипу** (`DELETE ... WHERE archetype = $1` з каскадом на `edges`/`player_progress` цього архетипу, в одній транзакції) — інші архетипи не зачіпаються.

### Прогрес (`src/controllers/progress.controller.js`) — контролер існує, але наразі **не змонтований** у `skill-tree.routes.js`

`ProgressController` (`myProgress`, `unlock`, `lock`, `allProgress`) реалізований і покритий тестами, але жоден ендпоінт для нього не зареєстрований у `src/routes/skill-tree.routes.js` — тобто зараз ці функції не викликаються через HTTP взагалі. Задокументовано як спостережений факт для майбутніх читачів; виправлення — поза межами цієї задачі. Якщо/коли маршрути буде додано, звернути увагу: судячи з реалізації, `allProgress` (перегляд прогресу всіх гравців) не передбачає рольової перевірки — сам контролер не обмежує доступ до `game_master`, тож маршрут для нього варто явно захистити `requireGameMaster`, інакше будь-який автентифікований користувач зможе побачити прогрес усіх.

Заплановані форми відповіді (на основі поточної реалізації контролера, коли/якщо буде змонтовано):
- `myProgress` — `200 { progress: [{ node_id, unlocked_at }, ...] }` для поточного користувача (`req.user.sub`).
- `unlock` — `POST` за `nodeId`: `201 { progress }` при новому розблокуванні, `200 { message: 'Вузол вже відкрито' }` якщо вже було розблоковано (ідемпотентно, `ON CONFLICT DO NOTHING`).
- `lock` — `DELETE`/скасування розблокування: `200 { message: 'Скасовано' }` / `404 { message: 'Вузол не був відкритий' }`.
- `allProgress` — `200 { progress: [{ user_id, node_id, unlocked_at }, ...] }` для всіх користувачів.

Авторизація: заголовок `Authorization: Bearer <access_token>`, перевіряється `src/middleware/auth.middleware.js` (`JWT_ACCESS_SECRET`); `requireGameMaster` додатково вимагає `req.user.role === 'game_master'`.

Помилки, що не є валідацією (400/409) чи not-found (404), пробрасываются в глобальний обробник помилок `src/index.js` і повертаються як `err.statusCode || 500`.

## Схема БД

Сервіс володіє схемою `skill_tree`:

- `skill_tree.nodes` — вузол дерева навичок: `title`, `description`, `icon`, `cost` (ціна в очках, 0 = недоступний за очки), `pos_x`/`pos_y` (координати на канві), `narrative_condition` (`TEXT[]`, умови розблокування через наратив), `effect` (`TEXT[]`, опис ефекту), `races` (`TEXT[]`, порожній = доступно всім расам), `archetype` (власник-архетип), `archetypes` (`TEXT[]`, використовується при імпорті/стартових вузлах), `require_both` (для вузлів із двома вхідними звʼязками), `is_root` (стартовий вузол архетипу/раси, автоматично розблоковується при створенні персонажа), `replaces_node_id` (расова заміна вузла).
- `skill_tree.edges` — звʼязок між двома вузлами: `source_id`, `target_id` (обидва `ON DELETE CASCADE`, унікальна пара, `source_id <> target_id`), `edge_type` (`required` | `optional` | `bridge`).
- `skill_tree.player_progress` — які вузли розблокував який користувач: `user_id`, `node_id` (`ON DELETE CASCADE`), `unlocked_at`, унікальна пара `(user_id, node_id)`.

DDL — `database/init/03-skill-tree.sql`, `database/init/05-skill-tree-racial.sql`, `database/init/06-default-archetype-nodes.sql` та подальші міграції `database/migrations/{01,02,03,04,09,11}-*.sql`.

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
