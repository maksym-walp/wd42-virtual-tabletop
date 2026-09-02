# character-sheet

Лист персонажа: створення/редагування персонажів, навички, відомі заклинання, прогрес дерева навичок, спорядження, маневри бійця, вміння, ритуальні трекери заклинача. Порт **3005** (`/api/characters/` через Nginx).

Структура — типова для сервісів цього репо: `src/{config,controllers,middleware,models,routes}`, точка входу `src/index.js`, тести в `src/**/__tests__`.

## Ендпоінти

Базовий шлях (усередині сервіса) — `/`; через Nginx — `/api/characters/`. Усі маршрути, крім `GET /public/:id`, вимагають `Authorization: Bearer <token>` (`requireAuth`).

Колонка **Доступ** описує, хто саме, окрім самого факту автентифікації, може викликати ендпоінт:
- **власник/campaign-GM** — `authorizeCharacterWrite`: власник персонажа (`user_id === req.user.sub`) АБО ГМ будь-якої кампанії, до якої персонаж зараз прикріплений (`campaign-access.model.js`); інакше 403, 404 якщо персонажа не існує.
- **власник/GM-роль/campaign-GM/публічний** — розширена перевірка (`getSheet`, `getAll` навичок): те саме, що вище, плюс глобальна роль `game_master` і публічний прапорець `characters.is_public`; якщо жодна з умов не виконана — 403.
- **лише логін** — контролер не перевіряє належність персонажа взагалі, достатньо валідного токена (це стосується `GET`-списків дочірніх сутностей: заклинань, дерева, спорядження, маневрів, вмінь, ритуалів — вони віддають дані будь-якому автентифікованому користувачеві, який знає `id` персонажа).

| Метод | Шлях | Доступ | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/public/:id` | публічний, без токена (лише якщо `is_public = true`) | — | `{ character, skills, spells, tree, equipment, maneuvers, abilities, rituals, experience, is_owner: false }` |
| GET | `/` | лише логін (свої персонажі) | — | `{ characters: [...] }` |
| POST | `/` | лише логін | `{ name, archetype, race, skills? }` | `201 { character }` |
| GET | `/:id` | власник/GM-роль/campaign-GM/публічний | — | `{ character, skills, spells, tree, equipment, maneuvers, abilities, rituals, experience, is_owner }` |
| PUT | `/:id` | власник/campaign-GM | довільні поля `characters` (див. модель, зокрема `experience_points`) | `{ character }` |
| DELETE | `/:id` | власник/campaign-GM | — | `{ message }` |
| GET | `/:id/skills` | власник/GM-роль/campaign-GM/публічний | — | `{ skills }` |
| PUT | `/:id/skills` | власник/campaign-GM | `{ updates: [{ skill_key, value?, progress_marks?, base_value? }] }` (`base_value` — лише майстер створення) | `{ skills }` |
| PATCH | `/:id/skills/:key` | власник/campaign-GM | `{ value?, progress_marks?, base_value? }` — значення клампуються (`value` 0–12, `progress_marks` 0–4) | `{ skill }` |
| GET | `/:id/spells` | лише логін | — | `{ spells }` |
| POST | `/:id/spells` | власник/campaign-GM | `{ spell_id }` | `201 { spell }` |
| PATCH | `/:id/spells/:spellId` | власник/campaign-GM | `{ mastered?, cast_count? }` | `{ spell }` |
| DELETE | `/:id/spells/:spellId` | власник/campaign-GM | — | `{ message }` |
| GET | `/:id/tree` | лише логін | — | `{ progress }` |
| POST | `/:id/tree/:nodeId` | власник/campaign-GM | — | `201 { progress, granted: { abilities, maneuvers, spells } }` (перевіряє передумови ребер і, коли пункти обов'язкові, `cost <= remaining` — інакше `403`; `granted` — записи, додані «видавати автоматично»-прив'язками вузла, з розгортанням колекцій) / `200` якщо вже відкрито |
| DELETE | `/:id/tree/:nodeId` | власник/campaign-GM | — | `{ message }` |
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

Заклинання, маневри, вміння та спорядження — це не власні таблиці цього сервіса, а посилання (`spell_id`/`maneuver_id`/`ability_id`/`equipment_id`) на каталоги інших сервісів (`spellbook.spells`, `maneuvers.entries`, `abilities.entries`, `equipment.items`/`equipment.weapons`/`equipment.armor`/`equipment.artifacts`). Перш ніж додати запис до листа персонажа, `add`-контролери (`ability`, `maneuver`, `spell`, `equipment`) проганяють дві перевірки з `prerequisite.model.js`:

1. **`isVisibleToUser(sourceTable, itemId, userId)`** — запис каталогу видимий, якщо користувач є його власником (`user_id = $2`) АБО він публічний (`is_public = true`); інакше `404` (той самий код, що й "не існує" — приватний чужий запис навмисно не відрізняється від відсутнього).
2. **`checkPrerequisites(characterId, sourceTable, itemId)`** — запис вважається доступним, якщо задоволена **АБО** його власна `prerequisite_node_ids`/`prerequisite_logic` (`'and'` — усі вузли відкриті, інакше — хоча б один), **АБО** відкрито будь-який вузол `skill_tree.node_grants`, що вказує на цей запис чи на колекцію, яка його містить. Якщо в запису немає ні `prerequisite_node_ids`, ні grant-прив'язок — він вільно додається. Невиконана вимога — `403` з `missing_node_ids`. Спорядження (`equipment.controller.js`) цю перевірку не проходить — лише видимість.

### Пункти досвіду (`experienceSummary`)

`characters.experience_points` — єдиний «гаманець»: одна валюта і для прокачки навичок, і для відкривання вузлів дерева. Витрати **обчислюються** на читання (`character.model.js` `experienceSummary`), не декрементуються:
`spent = Σ skills[max(value − base_value, 0) * 5 + progress_marks] + Σ (cost відкритих не-кореневих вузлів)`.
`GET /:id` та `/public/:id` повертають `experience: { total, spent, remaining, tree_spent, skill_spent }`. `base_value` фіксується майстром створення (пул розподілу навичок — окремий від досвіду).

## Схема БД (`character_sheet`)

Створюється в `database/init/04-character-sheet.sql` і `database/init/05-skill-tree-racial.sql`, доповнюється міграціями (`05`, `06`, `07`, `10`, `12`, `13`, `16`, `18`, `27`, `69`, `70` у `database/migrations/`).

| Таблиця | Призначення |
|---|---|
| `characters` | Основний запис персонажа: `user_id`, `name`, `archetype` (fighter/spellcaster/rogue), `race`, вітали (`current_hp`, `current_magic`, `death_scale`...), `experience_points` (єдиний гаманець досвіду, раніше `dev_points`), `is_public`, гроші, натхнення, портрет тощо |
| `skills` | 20 фіксованих навичок на персонажа (`value` 0–12, `base_value` 0–12 — знімок після створення, `progress_marks` 0–4), унікальні за `(character_id, skill_key)` |
| `known_spells` | Прогрес по заклинанню (`spell_id` → `spellbook.spells`): `mastered`, `cast_count` |
| `tree_progress` | Відкриті вузли дерева навичок (`node_id` → `skill_tree.nodes`), унікальні за `(character_id, node_id)` |
| `equipment` | Прив'язане спорядження (`equipment_id` → `equipment.items`/`equipment.weapons`/`equipment.armor`/`equipment.artifacts`), `mastery_count`/`mastered` |
| `maneuvers` | Прив'язані маневри бійця (`maneuver_id` → `maneuvers.entries`) |
| `abilities` | Прив'язані вміння (`ability_id` → `abilities.entries`) |
| `ritual_trackers` | Трекери ритуалів заклинача: `name`, `rounds`, `participants` (JSONB `[{name, successes: [bool,...]}]`) |

Усі дочірні таблиці мають `character_id UUID REFERENCES character_sheet.characters(id) ON DELETE CASCADE`. Каталожні id (`spell_id`, `equipment_id`, `maneuver_id`, `ability_id`, `node_id`) — це "голі" UUID без FK-обмеження: цільові записи живуть у схемах інших сервісів (`spellbook`, `equipment`, `maneuvers`, `abilities`, `skill_tree`, `campaigns`), моделі з'єднують їх `LEFT JOIN` під час читання.

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
