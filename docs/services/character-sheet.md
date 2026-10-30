# character-sheet

Лист персонажа: створення/редагування персонажів, раса й підвид (народ), навички, відомі заклинання, прогрес дерева розвитку, спорядження, вміння (включно з маневрами), ритуальні трекери. Тут же — **єдине джерело правил** станів, таймера діяльності й відпочинку (`src/rules/`). Порт **3005** (`/api/characters/` через Nginx), схема БД `character_sheet`.

Структура — типова для сервісів цього репо: `src/{config,controllers,middleware,models,routes}` плюс чисті модулі правил `src/rules/`, точка входу `src/index.js`, тести в `src/**/__tests__`.

Каталоги заклинань, вмінь і спорядження — не власні таблиці цього сервіса: лист зберігає лише голі UUID на записи [spellbook](spellbook.md), [abilities](abilities.md) і [equipment](equipment.md) разом із прогресом персонажа. **Маневрів як окремої сутності нема**: маневр — це вміння з `is_maneuver = true` (див. [abilities](abilities.md)), тож лежить у `character_sheet.abilities`; ендпоінтів `/:id/maneuvers` більше немає, а відповідь листа не має ключа `maneuvers`.

## Ендпоінти

Базовий шлях (усередині сервіса) — `/`; через Nginx — `/api/characters/`. Усі маршрути, крім `GET /public/:id`, вимагають `Authorization: Bearer <token>` (`requireAuth`).

Колонка **Доступ**:
- **автор запису** — `authorizeCharacterWrite`: власник персонажа, `admin` або ГМ будь-якої кампанії, до якої персонажа зараз прикріплено ([campaigns](campaigns.md), `campaign-access.model.js`); інакше `403`, `404` якщо персонажа нема.
- **читання листа** — те саме, що вище, плюс глобальна роль `game_master` і публічний прапорець `characters.is_public`; інакше `403`.
- **лише логін** — контролер не перевіряє належність персонажа, достатньо валідного токена (це `GET`-списки дочірніх сутностей: вони віддають дані будь-якому автентифікованому, хто знає `id` персонажа).

| Метод | Шлях | Доступ | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/public/:id` | публічний, **без токена** (лише `is_public`) | — | `{ character, skills, spells, tree, equipment, abilities, rituals, spell_access, effects, timer, campaign_ids: [], is_owner: false, is_gm: false, is_spell_master: false }` / `404` |
| GET | `/` | лише логін | query: `include=campaigns` | `{ characters: [...] }` — свої (адмін: усі); з `include=campaigns` ще й персонажі кампаній, де користувач — ГМ, з `gm_campaigns` |
| GET | `/community` | лише логін | query: `limit` (15) | `{ characters }` — публічні персонажі інших не-адмінів (рейл «Творіння спільноти») |
| GET | `/config` | лише логін | — | довідники листа: `{ conditions, currencies, races, condition_levels }` (перші три — з `admin.site_configs`; `condition_levels` — тексти ефектів станів по рівнях з `rules/conditions.js`) |
| GET | `/effects` | лише логін; віддає лише видимих персонажів (власник, ГМ кампанії, учасник тієї ж кампанії, адмін) | query: `ids=a,b` (до 50 UUID) | `{ characters: { [id]: { effects, timer, conditions, heroic_left } } }` — невидимі id мовчки пропускаються (трекер бою) |
| POST | `/timer/advance` | **лише ГМ кампанії кожного з персонажів** або `admin` (власник — ні) | `{ character_ids: [uuid], hours (0 < h ≤ 1000), source_key? }` | `{ results: [{ character_id, name, skipped, reason?, hours_added, timer_speed, checks, fatigue_before, fatigue_after, death_scale, timer }] }` / `400` / `403` на весь запит. Повторний `source_key` для персонажа → `skipped: true, reason: 'already_applied'` |
| POST | `/` | лише логін | `{ name, archetype, race_id, people_id?, skills? }` | `201 { character }` / `400` (бракує поля, раса чи підвид недоступні) |
| GET | `/:id` | читання листа | — | `{ character, skills, spells, tree, equipment, abilities, rituals, spell_access, effects, timer, potions, campaign_ids, is_owner, is_gm, is_spell_master }` (`character.last_rest` — останній відпочинок; `potions` — звикання до зілля: `{ habit_rank, habituated, next_die, excess_portions }`) |
| PUT | `/:id` | автор запису | поля `characters` (див. модель); поля таймера (`rest_timer_hours`, `timer_checks_*`) і `last_rest` → `400` | `{ character }`; якщо є `conditions` — нормалізація (див. нижче), відповідь `{ character, effects, skills? }` (`skills` — коли Травма 5 щойно знизила Тілобудову); `400` — некоректні стани, блок Втоми 5, `death_scale` поза −3…3 |
| PUT | `/:id/people` | автор запису | `{ people_id: uuid \| null }` | зміна/зняття підвиду; бонуси до навичок застосовуються дельтою; `400` якщо підвид не відкрито для раси |
| POST | `/:id/duplicate` | автор запису | `{ name?, archetype?, race_id? }` | `201 { character }` — копія, опційно з іншою расою/архетипом |
| GET | `/:id/rest/preview` | автор запису | — | `{ preview: { short, full, long } }` — для кожної форми `{ kind, label, duration_hours, choice_options, lines }`: що дасть відпочинок зараз, без кидків і запису (підказка в меню) |
| POST | `/:id/rest` | автор запису (хто натиснув — той і обирає стан) | `{ kind: 'short' \| 'full' \| 'long', choice?: { condition: 'fatigue' \| 'illness' } }` | `{ result, character, effects, timer }`; результат зберігається в `characters.last_rest` разом з `at` і `by: { user_id, username }`. Без потрібного вибору — `400 { message, code: 'choice_required', options }` |
| PATCH | `/:id/owner` | лише `admin` | `{ owner_username }` | `{ character }` / `400` / `404` |
| DELETE | `/:id` | автор запису | — | `{ message }` |
| GET | `/:id/skills` | читання листа | — | `{ skills }` |
| PUT | `/:id/skills` | автор запису | `{ updates: [{ skill_key, value?, progress_marks?, base_value? }] }` | `{ skills }` |
| PATCH | `/:id/skills/:key` | автор запису | `{ value?, progress_marks?, base_value? }` — клампуються (`value`/`base_value` 0–12, `progress_marks` 0–4) | `{ skill }` |
| GET | `/:id/spells` | лише логін | — | `{ spells }` |
| POST | `/:id/spells` | автор запису | `{ spell_id, form_tier?, primary_form?, mastered_forms? }` | `201 { spell }` / `400` (некоректні форми) / `403` (дерево не відкрило традицію чи складність; `missing`) / `404` (заклинання невидиме) |
| PATCH | `/:id/spells/:spellId` | автор запису | `{ mastered?, cast_count?, form_tier?, primary_form?, mastered_forms? }` | `{ spell }` / `400` / `404` |
| DELETE | `/:id/spells/:spellId` | автор запису | — | `{ message }` |
| GET | `/:id/tree` | лише логін | — | `{ progress }` |
| POST | `/:id/tree/:nodeId` | автор запису | `{ via?: 'points' \| 'narrative' }` | `201 { progress, granted: { abilities, spells } }` / `200` якщо вже відкрито / `403` (передумови ребер чи пункти досвіду) / `404` |
| DELETE | `/:id/tree/:nodeId` | автор запису | — | `{ message }` / `404` |
| GET | `/:id/equipment` | лише логін | — | `{ equipment }` |
| POST | `/:id/equipment` | автор запису | `{ equipment_id }` | `201 { item }` / `404` (невидиме) |
| PATCH | `/:id/equipment/:equipmentId` | автор запису | `{ mastery_count?, mastered?, is_equipped?, containers?, open_portions? }` (запас зілля — цілі 0–99, інакше `400`) | `{ item }` |
| DELETE | `/:id/equipment/:equipmentId` | автор запису | — | `{ message }` |
| POST | `/:id/equipment/:equipmentId/drink` | автор запису | `{ portions }` (1–50) | `{ result, character, item, effects, timer, potions }` — випити порції зілля з запасу (див. «Зілля»); `item: null` — зілля скінчилось і зникло з листа; `400` — більше порцій, ніж є, або зілля без ефекту зцілення; `404` — зілля нема в листі |
| GET | `/:id/abilities` | лише логін | — | `{ abilities }` |
| POST | `/:id/abilities` | автор запису | `{ ability_id, form_tier?, primary_form?, mastered_forms? }` | `201 { ability }` / `400` / `403` (вимоги дерева; `missing_node_ids`) / `404` |
| PATCH | `/:id/abilities/:abilityId` | автор запису | `{ form_tier?, primary_form?, mastered_forms? }` | `{ ability }` / `400` / `404` |
| DELETE | `/:id/abilities/:abilityId` | автор запису | — | `{ message }` |
| GET | `/:id/rituals` | лише логін | — | `{ trackers }` |
| POST | `/:id/rituals` | автор запису | `{ name, rounds?, participants? }` | `201 { tracker }` |
| PUT | `/:id/rituals/:trackerId` | автор запису | `{ name?, rounds?, participants? }` | `{ tracker }` |
| DELETE | `/:id/rituals/:trackerId` | автор запису | — | `{ message }` |

Прапорці у відповіді листа: `is_owner` — справжній власник **або** ГМ кампанії/адмін (вони мають ті самі права запису); `is_gm` — запис дозволено через владу ГМ/адміна, а не власність (фронтенд показує пряме редагування навичок); `is_spell_master` — може видавати заклинання поза правилами доступності (глобальна `game_master`/`admin` або ГМ кампанії персонажа).

Помилки, не оброблені явним `if`, летять до глобального error-handler у `src/index.js` (`err.statusCode || 500`).

### Стани, таймер діяльності й відпочинок (`src/rules/`)

Єдине джерело цих правил — чисті модулі без БД; генератор випадкових чисел (`rng`) інжектується, тож тести детерміновані. campaigns і frontend власних таблиць не мають: отримують обчислений блок `effects` і тексти `condition_levels`.

- **`conditions.js`** — три стани (`fatigue`, `illness`, `trauma`), рівні 1–5, у даних — до 9. `conditions` листа — `[{ type, level }]`, у Травми ще `skill_keys: []` (навички пошкодженої частини тіла). `computeEffects(conditions, skills, archetype, character)` → `{ roll_mode ('normal'|'dis'|'wdis'), roll_mode_source, heroic_disabled, reactions ('normal'|'dis'|'none'), actions_per_turn, initiative_modifier, timer_speed, rest_time_multiplier, max_magic_base, max_magic_effective, magic_restore_blocked, healing_disadvantage, movement_penalty, passive_defense_factor, skill_rank_penalty, disabled_skill_keys, skill_dice, block_other_removal, unconscious, dead }`. `skill_dice` — ефективний кубик-модифікатор кожної навички (знижений/вимкнений Травмою).
- **Нормалізація** (`normalizeConditions`) — будь-який запис `conditions` (PUT, таймер, відпочинок): лише три ключі, цілі 0–9 (0 прибирає стан), `skill_keys` лише в Травми (з 20 навичок; без поля — лишаються попередні); **блок Втоми 5** — якщо результуюча Втома ≥ 5, знизити Хворобу чи Травму не можна (`400`, для всіх ролей); **падіння на 6-му рівні** будь-якого стану — `death_scale = 0` (якщо був `null` чи > 0), кожен рівень понад 6-й, набраний після падіння, — ще −1 (до −3); **Травма 5** при переході `<5 → ≥5` — навички Тілобудови падають до мінімуму свого рівня (`LEVEL_MIN_VALUE`), `progress_marks = 0`; назавжди, зняття Травми цього не повертає.
- **Непритомність** окремим прапорцем не зберігається: `effects.unconscious` = `death_scale` у −2…+2, `effects.dead` = `death_scale = −3` (`+3` — отямився, `null` — не на шкалі).
- **`timer.js`** — `rest_timer_hours` від останнього повноцінного відпочинку; перевірки Витривалості на 12-й, 18-й, 24-й… годині (`timer_checks_done` — скільки порогів минуло), кілька порогів за одне додавання — по черзі. Кидок — лише кубик-модифікатор Витривалості (Витривалість 1–3 → 0, завжди провал), складність `D = max(1, h) × (F + 1)`, `h = timer_checks_passed`; провал — +1 Втома. Хвороба ≥ 2 подвоює додані години; непритомний не перевіряється (поріг минає).
- **`rest.js`** — `short` (+4 год таймера, 8 при Хворобі ≥ 4, далі множник Хвороби; +1 кубик зцілення архетипу, з перешкодою при Хворобі ≥ 1; +K енергії), `full` (−1 рівень Втоми або Хвороби на вибір, при Втомі 5 — лише Втома; здоровʼя +½ бракуючого до поточного максимуму після зняття стану; +K·d4 енергії; скидає таймер; −1 використана героїчна дія), `long` (знімає всю Втому й Хворобу та 1 рівень Травми; здоровʼя й енергія — до максимуму; усі героїчні дії; скидає таймер). Енергія — не вище `max_magic_effective` і не відновлюється при Хворобі 5. K — 2/4/6 (fighter/rogue/spellcaster), кубик зцілення d8/d6/d4.
- **`stats.js`** — базові таблиці листа (кубики здоровʼя, мінімуми рівнів, героїчні дії, K), дзеркало frontend-констант ([conventions](../conventions.md#дзеркало-базових-характеристик)). Поточний максимум ХП — сума незакреслених кубиків: кожен рівень стану закреслює найбільший.
- Зміни стану — у транзакції з `SELECT … FOR UPDATE` (`character-state.model.js`). Ідемпотентність нарахування годин — `timer_events (character_id, source_key)` (`combat:<sceneId>` від [campaigns](campaigns.md)).

### Зілля (`src/rules/potions.js`)

Зілля — пʼятий вид каталогу [equipment](equipment.md) (`equipment.potions`, згенеровані `heal_die`/`portions`). У листі рядок зілля зберігає запас: `containers` (повні ємності) і `open_portions` (залишок у відкритій); випиті порції беруться спершу з відкритої ємності, потім відкриваються нові; порожнє зілля видаляється з листа.

- Кожна порція — кидок `1d<heal_die>` (з перешкодою при Хворобі ≥ 1); здоровʼя — не вище поточного максимуму.
- **Звикання:** поки персонаж не звик, з кожною порцією кидається кубик на ранг вищий, ніж попереднього разу (`potion_habit_rank`: d4 → d6 → d8 → d10 → d12 → d20 → d100); 4+ — звикання (`potion_habituated`). Після звикання ефект наступних порцій удвічі менший (сума їхніх кидків, угору).
- **Хвороба від зілля:** кожен ковток із порціями після звикання — перевірка Імунітету: лише кубик-модифікатор Імунітету (без d20; 1–3 → 0) проти складності = **усім** порціям, випитим після звикання (`potion_excess_portions`, накопичується). Провал — +1 рівень Хвороби за кожні 2 зайві порції цього ковтка (угору), успіх — половина цих рівнів (униз). Зцілення від зайвих порцій усе одно відбувається.
- **Відпочинок:** перепочинок знижує ранг кубика звикання на 1 (саме звикання лишається), повноцінний відпочинок і довготривале відновлення скидають звикання повністю.

### Раса, підвид і `GET /config`

Персонаж посилається на расу компендіуму голим UUID `race_id` (колонка `race` — застарілий текстовий рядок, додатково підтягується `race_name` з `compendium.races`). Які раси можна обрати, задає адмін: `admin.site_configs`, ключ `character_races` ([admin](admin.md)) — кожна запис: раса, `is_main` (основна чи ні; фронтенд ховає неосновні за «Інші народи»), `bonus_characteristic` + `bonus_value` (±N до 4 навичок, типово 1) + `bonus_budget` (додаткові очки пулу) і список підвидів-народів (`compendium.peoples`) з бонусами до навичок (значення зі знаком — можуть бути від'ємними). `isCharacterRace` / `findCharacterPeople` відсіюють раси й народи, що вже не публічні в [compendium](compendium.md). Бонус підвиду зберігається в `characters.people_bonus` (`{ skill: delta }`), стартове значення навички — `1 + bonus`. `GET /config` повертає `conditions`, `currencies` і відфільтровані `races` (з описами, зображеннями та підвидами) — порожній масив означає «ще не засіяно», фронтенд тоді бере власні константи.

### Дерево розвитку та пункти досвіду

`characters.experience_points` — **простий баланс**, який витрачає лише дерево. Вузол відкривається, якщо виконано вхідні ребра (усі не-`optional` відкриті, і якщо є `optional` — хоч одне) і вистачає досвіду: вартість `node.cost` списується, якщо у вузла нема нарративної умови, або `require_both`, або гравець обрав шлях `via: 'points'`; шлях `via: 'narrative'` досвіду не коштує. Навички досвіду **не** коштують (піднімаються через натхнення/нарратив). Раніше (міграція 70) витрати рахувалися на читання як `experienceSummary`; міграція 89 перетворила поле на баланс і прибрала `experience` із відповіді листа.

Відкриття вузла в одній транзакції застосовує його `node_grants` режиму `grant` (`applyGrants`): вміння видаються, колекції вмінь розгортаються у складові, `form_key` обмежує, які форми отримує персонаж (повторна видача лише додає нові форми й піднімає рівень). Заклинання вузли не видають — вони відкривають традиції та складність.

### Доступ до заклинань (`spell-access.model.js`, міграція 91)

Вузли дерева мають `unlocks_traditions` (UUID традицій [spellbook](spellbook.md)) і `unlocks_complexity` (драбина: відкриває й усі нижчі). Заклинання доступне, коли відкрито хоч одну з його традицій (без традицій — завжди) **і** складність хоч однієї форми не вища за найвищу відкриту (форма без складності — завжди). Кожна форма перевіряється за власною складністю, тож відкритою може бути лише частина форм (`allowedForms`). Майстер (`isSpellMaster`) обходить правила; заклинання, додане майстром, отримує `known_spells.gm_granted = true` і лишається поза правилами й надалі. `spell_access: { traditions, max_complexity }` у відповіді листа — те, що відкрило дерево.

### Вимоги вмінь (`prerequisite.model.js`)

Для вмінь `checkPrerequisites` вважає вимоги виконаними, якщо задоволена **АБО** власна `prerequisite_node_ids`/`prerequisite_logic` вміння (`and` — усі вузли відкриті, інакше — хоч один), **АБО** відкрито будь-який вузол `skill_tree.node_grants`, що вказує на вміння чи на колекцію, яка його містить. Без вимог і без привʼязок вміння вільне. Результат містить `allowedForms` (`null` — усі форми; інакше ключі доступних форм з `form_key` відкритих привʼязок). `isVisibleToUser(table, id, userId)` перевіряє видимість запису каталогу (власник або `is_public`), інакше `404` — приватний чужий запис навмисно не відрізняється від відсутнього.

### Освоєння форм (`form-progress.js`)

`form_tier` (`primitive`/`full`/`perfected`, `NULL` без рівневих форм), `primary_form` (`main` або UUID альтернативної) і `mastered_forms` — однакові колонки в `known_spells` і `abilities`. Ключ форми: `main` (↔ `full`), `primitive`, `perfected` або UUID альтернативної. Межі перевіряє `resolveFormProgress` проти форм запису й дозволених дерев (`allowed`).

## Схема БД (`character_sheet`)

Створюється в `database/init/04-character-sheet.sql`, далі міграції (зокрема 5, 7, 10, 12, 16, 27, 69–70, 81, 85, 88–91, 95–96, 107, 109 — три стани й міграція даних старих ключів, 111 — зілля). Усі дочірні таблиці мають `character_id UUID REFERENCES character_sheet.characters(id) ON DELETE CASCADE`. Каталожні id (`spell_id`, `equipment_id`, `ability_id`, `node_id`, `race_id`, `people_id`) — голі UUID без FK; моделі з'єднують чужі схеми `LEFT JOIN` під час читання.

| Таблиця | Призначення |
|---|---|
| `characters` | `user_id`, `name`, `archetype` (fighter/spellcaster/rogue), `race` (застаріле) + `race_id`, `people_id`, `people_bonus JSONB`, `is_public`, `backstory`, `notes`, вітали (`current_hp`, `current_magic`, `temp_hp`, `death_scale` −3…3 або `NULL`, `heroic_actions_used`, `health_dice_values[]`), `conditions JSONB` (`[{ type, level, skill_keys? }]`), таймер діяльності (`rest_timer_hours`, `timer_checks_done`, `timer_checks_passed`), `last_rest JSONB`, звикання до зілля (`potion_habit_rank`, `potion_habituated`, `potion_excess_portions`, міграція 111), `experience_points` (баланс), `money JSONB`, `spell_bonus`, `defense_bonus`, натхнення (`inspiration_used`, `narrative_inspiration_die`, `rogue_inspiration_die`, `rogue_inspiration_given_to`), `luck_current`/`luck_max`, `image_url`, `image_crop` |
| `skills` | 20 фіксованих навичок на персонажа: `value` 0–12, `base_value` 0–12 (знімок після створення), `progress_marks` 0–4; унікальні за `(character_id, skill_key)` |
| `known_spells` | прогрес по заклинанню: `mastered`, `cast_count`, `form_tier`, `primary_form`, `mastered_forms`, `gm_granted` |
| `abilities` | вміння (і маневри) листа: `ability_id`, `form_tier`, `primary_form`, `mastered_forms` |
| `tree_progress` | відкриті вузли (`node_id` → `skill_tree.nodes`), `unlocked_at`; унікальні за `(character_id, node_id)` |
| `equipment` | прив'язане спорядження (`equipment_id` → одна з пʼяти таблиць [equipment](equipment.md)): `mastery_count`, `mastered`, `is_equipped` (захист = **одна** екіпірована броня + `defense_bonus`); для зіль — `containers`, `open_portions` (міграція 111) |
| `ritual_trackers` | трекери ритуалів: `name`, `rounds`, `participants` (JSONB `[{name, successes: [bool,...]}]`) |
| `timer_events` | ідемпотентні нарахування годин таймера: `character_id`, `source_key`, `hours`, `created_at`; `UNIQUE (character_id, source_key)` (міграція 107) |

Міжсхемні читання: `auth.users` (`owner_username`), `compendium.races`/`peoples`, `admin.site_configs`, `skill_tree.*` (вузли, ребра, `node_grants`), `abilities.*`, `spellbook.*`, `equipment.*`, `campaigns.campaign_characters` (чи користувач — ГМ кампанії персонажа). Видалення персонажа пише знімок у `trash.deleted_records`.

## Змінні оточення

Див. кореневий `.env.example`. Сервіс читає:
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — спільна БД (`src/config/db.js`)
- `JWT_ACCESS_SECRET` — перевірка токена (`src/middleware/auth.middleware.js`)
- `FRONTEND_URL` — origin для CORS
- `PORT` — порт HTTP-сервера (за замовчуванням 3005)

## Тести

```bash
cd services/character-sheet
npm test
```

Jest, без реальної БД — моделі мокають `pool` (`jest.mock('../../config/db')` + `src/config/__mocks__/db.js`), контролери мокають моделі та `authorize-character-write.js`. `src/rules/__tests__` — правила з детермінованим генератором (`src/rules/__helpers__/rules.js`): пороги таймера, складність, Витривалість 1–3, Хвороба, непритомність, кожна форма відпочинку, вибір стану, блок Втоми 5, Травма 5, падіння й шкала смерті; зілля — запас, драбина звикання, половинне зцілення, перевірка Імунітету, вплив відпочинку, попередній перегляд відпочинку.
