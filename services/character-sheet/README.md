# character-sheet

Лист персонажа: створення/редагування персонажів, навички, відомі заклинання, прогрес дерева навичок, прориви Nephilim, спорядження, маневри бійця, вміння, ритуальні трекери заклинача. Порт **3005** (`/api/characters/` через Nginx).

Структура — типова для сервісів цього репо: `src/{config,controllers,middleware,models,routes}`, точка входу `src/index.js`, тести в `src/**/__tests__`.

## Ендпоінти

Базовий шлях (усередині сервіса) — `/`; через Nginx — `/api/characters/`. Усі маршрути, крім `GET /public/:id`, вимагають `Authorization: Bearer <token>` (`requireAuth`).

Колонка **Доступ** описує, хто саме, окрім самого факту автентифікації, може викликати ендпоінт:
- **власник/campaign-GM** — `authorizeCharacterWrite`: власник персонажа (`user_id === req.user.sub`) АБО ГМ будь-якої кампанії, до якої персонаж зараз прикріплений (`campaign-access.model.js`); інакше 403, 404 якщо персонажа не існує.
- **власник/GM-роль/campaign-GM/публічний** — розширена перевірка (`getSheet`, `getAll` навичок, `breakthroughs.list`): те саме, що вище, плюс глобальна роль `game_master` і публічний прапорець `characters.is_public`; якщо жодна з умов не виконана — 403.
- **лише логін** — контролер не перевіряє належність персонажа взагалі, достатньо валідного токена (це стосується `GET`-списків дочірніх сутностей: заклинань, дерева, спорядження, маневрів, вмінь, ритуалів — вони віддають дані будь-якому автентифікованому користувачеві, який знає `id` персонажа).

| Метод | Шлях | Доступ | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/public/:id` | публічний, без токена (лише якщо `is_public = true`) | — | `{ character, skills, spells, equipment, maneuvers, abilities, rituals, is_owner: false }` |
| GET | `/` | лише логін (свої персонажі) | — | `{ characters: [...] }` |
| POST | `/` | лише логін | `{ name, archetype, race, race_ancestry?, skills? }` | `201 { character }` |
| GET | `/:id` | власник/GM-роль/campaign-GM/публічний | — | `{ character, skills, spells, tree, equipment, nephilim_breakthroughs, maneuvers, abilities, rituals, is_owner }` |
| PUT | `/:id` | власник/campaign-GM | довільні поля `characters` (див. модель) | `{ character }` |
| DELETE | `/:id` | власник/campaign-GM | — | `{ message }` |
| GET | `/:id/skills` | власник/GM-роль/campaign-GM/публічний | — | `{ skills }` |
| PUT | `/:id/skills` | власник/campaign-GM | `{ updates: [{ skill_key, value?, progress_marks? }] }` | `{ skills }` |
| PATCH | `/:id/skills/:key` | власник/campaign-GM | `{ value?, progress_marks? }` | `{ skill }` |
| GET | `/:id/spells` | лише логін | — | `{ spells }` |
| POST | `/:id/spells` | власник/campaign-GM | `{ spell_id }` | `201 { spell }` |
| PATCH | `/:id/spells/:spellId` | власник/campaign-GM | `{ mastered?, cast_count? }` | `{ spell }` |
| DELETE | `/:id/spells/:spellId` | власник/campaign-GM | — | `{ message }` |
| GET | `/:id/tree` | лише логін | — | `{ progress }` |
| POST | `/:id/tree/:nodeId` | власник/campaign-GM | — | `201 { progress }` або `200` якщо вже відкрито |
| DELETE | `/:id/tree/:nodeId` | власник/campaign-GM | — | `{ message }` |
| GET | `/:id/tree/breakthroughs` | власник/GM-роль/campaign-GM/публічний | — | `{ breakthroughs }` |
| POST | `/:id/tree/breakthroughs/:nodeId` | власник/campaign-GM | — | `201 { node_id }`, `200` якщо вже використано, `400` якщо ліміт вичерпано |
| DELETE | `/:id/tree/breakthroughs/:nodeId` | власник/campaign-GM | — | `{ message }` |
| GET | `/:id/equipment` | лише логін | — | `{ equipment }` |
| POST | `/:id/equipment` | власник/campaign-GM | `{ equipment_id }` | `201 { item }` |
| PATCH | `/:id/equipment/:equipmentId` | власник/campaign-GM | `{ mastery_count?, mastered? }` | `{ item }` |
| DELETE | `/:id/equipment/:equipmentId` | власник/campaign-GM | — | `{ message }` |
| GET | `/:id/maneuvers` | лише логін | — | `{ maneuvers }` |
| POST | `/:id/maneuvers` | власник/campaign-GM | `{ maneuver_id }` | `201 { maneuver }` |
| DELETE | `/:id/maneuvers/:maneuverId` | власник/campaign-GM | — | `{ message }` |
| GET | `/:id/abilities` | лише логін | — | `{ abilities }` |
| POST | `/:id/abilities` | власник/campaign-GM | `{ ability_id }` | `201 { ability }` |
| DELETE | `/:id/abilities/:abilityId` | власник/campaign-GM | — | `{ message }` |
| GET | `/:id/rituals` | лише логін | — | `{ trackers }` |
| POST | `/:id/rituals` | власник/campaign-GM | `{ name, rounds?, participants? }` | `201 { tracker }` |
| PUT | `/:id/rituals/:trackerId` | власник/campaign-GM | `{ name?, rounds?, participants? }` | `{ tracker }` |
| DELETE | `/:id/rituals/:trackerId` | власник/campaign-GM | — | `{ message }` |

Помилки: контролери самі не ловлять коди Postgres — усе, що вони не обробили явним `if`, вилітає до глобального error-handler у `src/index.js` (`err.statusCode || 500`).

## Видимість каталогів і передумови дерева (`prerequisite.model.js`)

Заклинання, маневри, вміння та спорядження — це не власні таблиці цього сервіса, а посилання (`spell_id`/`maneuver_id`/`ability_id`/`equipment_id`) на каталоги інших сервісів (`spellbook.spells`, `maneuvers.entries`, `abilities.entries`, `equipment.items`/`artifacts.entries`). Перш ніж додати запис до листа персонажа, `add`-контролери (`ability`, `maneuver`, `spell`, `equipment`) проганяють дві перевірки з `prerequisite.model.js`:

1. **`isVisibleToUser(sourceTable, itemId, userId)`** — запис каталогу видимий, якщо користувач є його власником (`user_id = $2`) АБО він публічний (`is_public = true`); інакше `404` (той самий код, що й "не існує" — приватний чужий запис навмисно не відрізняється від відсутнього).
2. **`checkPrerequisites(characterId, sourceTable, itemId)`** — якщо в запису каталогу заповнено `prerequisite_node_ids`, перевіряється, які з цих вузлів дерева навичок уже відкриті персонажем (`character_sheet.tree_progress`). При `prerequisite_logic = 'and'` потрібні всі вузли; за будь-якого іншого значення (типово `'or'`) достатньо хоча б одного. Якщо вимога не виконана — `403` з `missing_node_ids` (переліком ще не відкритих вузлів, навіть за OR-логіки). Спорядження (`equipment.controller.js`) цю перевірку не проходить — лише видимість.

## Прориви Nephilim (`nephilim.controller.js`, `rules/nephilim.rules.js`)

Раса `nephilim` отримує обмежену кількість "проривів" (breakthrough) — можливість ігнорувати передумови дерева для окремих вузлів. Дозволена кількість вираховується з кількості вже відкритих вузлів дерева (`character_sheet.tree_progress`, а не з кількості вже використаних проривів) функцією `calcAllowedBreakthroughs(unlockedCount)` — обернена до формули трикутних чисел, тобто поріг зростає нелінійно (детальні кейси й округлення — у `src/rules/__tests__/nephilim.rules.test.js`). `POST /:id/tree/breakthroughs/:nodeId` порівнює кількість уже використаних проривів із цим лімітом: `400`, якщо ліміт вичерпано; операція ідемпотентна — повторне використання того самого вузла повертає `200`, а не `201` (`INSERT ... ON CONFLICT DO NOTHING`).

## Схема БД (`character_sheet`)

Створюється в `database/init/04-character-sheet.sql` і `database/init/05-skill-tree-racial.sql`, доповнюється міграціями (`05`, `06`, `07`, `10`, `12`, `13`, `16`, `18`, `27` у `database/migrations/`).

| Таблиця | Призначення |
|---|---|
| `characters` | Основний запис персонажа: `user_id`, `name`, `archetype` (fighter/spellcaster/rogue), `race`, вітали (`current_hp`, `current_magic`, `death_scale`...), `is_public`, гроші, натхнення, портрет тощо |
| `skills` | 20 фіксованих навичок на персонажа (`value` 0–12, `progress_marks` 0–5), унікальні за `(character_id, skill_key)` |
| `known_spells` | Прогрес по заклинанню (`spell_id` → `spellbook.spells`): `mastered`, `cast_count` |
| `tree_progress` | Відкриті вузли дерева навичок (`node_id` → `skill_tree.nodes`), унікальні за `(character_id, node_id)` |
| `nephilim_breakthroughs` | Використані проривы Nephilim (`node_id`), унікальні за `(character_id, node_id)` |
| `equipment` | Прив'язане спорядження (`equipment_id` → `equipment.items`/`artifacts.entries`), `mastery_count`/`mastered` |
| `maneuvers` | Прив'язані маневри бійця (`maneuver_id` → `maneuvers.entries`) |
| `abilities` | Прив'язані вміння (`ability_id` → `abilities.entries`) |
| `ritual_trackers` | Трекери ритуалів заклинача: `name`, `rounds`, `participants` (JSONB `[{name, successes: [bool,...]}]`) |

Усі дочірні таблиці мають `character_id UUID REFERENCES character_sheet.characters(id) ON DELETE CASCADE`. Каталожні id (`spell_id`, `equipment_id`, `maneuver_id`, `ability_id`, `node_id`) — це "голі" UUID без FK-обмеження: цільові записи живуть у схемах інших сервісів (`spellbook`, `equipment`/`artifacts`, `maneuvers`, `abilities`, `skill_tree`, `campaigns`), моделі з'єднують їх `LEFT JOIN` під час читання.

## Змінні оточення

Див. кореневий `.env.example`. Сервіс читає:
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — підключення до спільної БД (`src/config/db.js`)
- `JWT_ACCESS_SECRET` — перевірка токена в `requireAuth` (`src/middleware/auth.middleware.js`)
- `FRONTEND_URL` — origin для CORS
- `PORT` — порт HTTP-сервера (у Docker задається в `docker-compose.yml`, за замовчуванням 3005)

## Тести

```bash
cd services/character-sheet
npm test
```

Jest, без реальної БД — моделі мокають `pool` (`jest.mock('../../config/db')` + `src/config/__mocks__/db.js`), контролери мокають моделі та `authorize-character-write.js`.
