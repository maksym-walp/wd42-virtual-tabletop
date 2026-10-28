# Спільні домовленості

Патерни, що повторюються в багатьох сервісах. Документація окремого сервіса ([services/](services/)) посилається сюди, замість того щоб повторювати їх.

## Структура бекенд-сервісу

Усі бекенди — окремі Node.js 20 / Express застосунки з однаковим каркасом:

```
services/<name>/
  Dockerfile              # стадії development (nodemon) і production
  package.json            # scripts: dev (nodemon), start, test (jest)
  src/index.js            # cors(FRONTEND_URL, credentials) → express.json → роутери → глобальний error-handler
  src/config/db.js        # pg.Pool з POSTGRES_*
  src/middleware/         # auth.middleware.js — власна копія requireAuth (jwt.verify за JWT_ACCESS_SECRET)
  src/{routes,controllers,models}/
  src/**/__tests__/       # Jest, БД мокається
```

- Роутери обгортають обробники в `wrap(fn)` (`Promise.resolve(fn()).catch(next)`); глобальний обробник віддає `err.statusCode || 500` і `{ message }`.
- Контролер перевіряє права й формат, модель виконує SQL. Моделі ходять у БД напряму (`pg`), ORM нема.
- Порти та префікси Nginx — у [кореневому README](../README.md).

## Автентифікація та ролі

- Access-токен (JWT, 15 хв) іде в заголовку `Authorization: Bearer …`; payload `{ sub, email, username, role }`, `req.user.sub` — id користувача. Refresh-токен — httpOnly-cookie `refresh_token` ([auth](services/auth.md)). **Сервіси токен не валідують через auth** — кожен має власну копію `requireAuth` і спільний `JWT_ACCESS_SECRET`.
- Ролі: `user`, `game_master`, `admin`. `admin` призначається через `ADMIN_USERNAMES` або адмін-панелю, решта ролей — лише адміном ([admin](services/admin.md)). Нова роль потрапляє в токен після наступного `/refresh`.
- Типові рівні: **автор** (власник запису), **`admin`** (обходить власність), **`game_master`/`admin`** — «канонічні менеджери» (`requireCanonicalManager`), **лише `admin`** — перепризначення власника (`requireAdminOwner`). У кампаніях ГМ — це `campaigns.gm_id`, а також `admin`.

## Міжсхемні посилання

Кожен сервіс володіє **своєю Postgres-схемою** (`auth`, `character_sheet`, `spellbook`, …). Спільна лише БД:

- Посилання на записи чужих схем — **голі UUID без FK** (`spell_id`, `equipment_id`, `node_id`, `race_id`, `campaign_id`, `location_id`, `lore_creator_npc_id` тощо). Цілісність на видаленні забезпечують тригери (`compendium.clear_taxonomy_refs()`) або модель (ручне прибирання повʼязаних рядків).
- Читати чужі схеми можна `JOIN`/підзапитом (`auth.users` для `owner_username`, `admin.site_configs` для довідників, `skill_tree.nodes` для передумов). **Писати** в чужу схему — лише у виняткових випадках, задокументованих у сервісі (наприклад, нарахування досвіду з `campaigns`).
- Таблиця міграцій — `public.schema_migrations`; кошик видалених записів — `trash.deleted_records` (міграція 33).

## Міжсервісні HTTP-виклики

Загальне правило — сервіси **не викликають один одного**: кожен перевіряє токен сам і читає чужі схеми SQL-запитом. Єдиний задокументований виняток — **campaigns → character-sheet** (`services/campaigns/src/clients/character-sheet.client.js`): правила станів, таймера діяльності й відпочинку живуть лише в character-sheet (`src/rules/`), тож campaigns не дублює їх, а викликає `POST /timer/advance` (кнопки годин на Ширмі, завершення бою).

- Адреса — `CHARACTER_SHEET_URL` (`http://character-sheet:3005`), таймаут 5 с, глобальний `fetch` Node 20 (без нових залежностей).
- Заголовок `Authorization` користувача пересилається як є — права (ГМ кампанії персонажа чи адмін) перевіряє character-sheet.
- Недоступність, таймаут або `5xx` → `502 { message }`; `4xx` character-sheet прокидаються з тим самим статусом і повідомленням.

### Дзеркало базових характеристик

Базові таблиці листа (кубики здоровʼя за Тілобудовою, мінімуми рівнів, героїчні дії за Мудрістю, множник архетипу) є і на frontend (`constants/characterSheet.js`), і в character-sheet (`src/rules/stats.js`) — серверу вони потрібні для відпочинку. Таблиці **станів** — лише в `character-sheet/src/rules/conditions.js`; клієнти отримують обчислений блок `effects` і тексти `condition_levels`.

## Каталоги з власниками (вміння, заклинання, спорядження, колекції…)

Повторюваний набір можливостей у [abilities](services/abilities.md), [spellbook](services/spellbook.md), [equipment](services/equipment.md) та їхніх колекціях:

- **Видимість**: власні записи + `is_public = true` (адмін бачить усе). Приватний чужий запис повертає `404`, а не `403`.
- **Канонічність**: окремий прапорець `is_canonical`, а не «автор — адмін». Його виставляє `admin`/`game_master` при створенні, а `PATCH /:id/canonical` перемикає на будь-якому записі.
- **`scope`** у списках: `canonical`, `user`, `community` (публічні записи інших не-канонічних авторів — рейл «Творіння спільноти» на Dashboard).
- **Власник**: `PATCH /:id/owner { owner_username }` — лише `admin`.
- **Імпорт / експорт**: `GET /export` (ті самі фільтри, що й у списку; `?id=` для одного запису) → JSON-масив без прив'язаного до деплою (зображення, часові мітки, `is_owner`, `is_canonical`, вимоги вузлів); `POST /import` — лише `admin`/`game_master`, записи стають канонічними, власник — імпортер, записи без `name` пропускаються. Імпорт колекцій доступний усім, але вкладені записи приймаються лише від `admin`/`game_master`.
- **Колекції**: публічний неавторизований `GET /collections/public/:id`; елемент можна додати лише у власну колекцію і лише видимий запис.
- **Видалення** пише знімок рядка (і каскадно видалених дочірніх) у `trash.deleted_records` — відновлення вручну через Adminer (`src/utils/trash.js`, `deleteWithTrash`).

## Зображення

Файли завантажує лише [media](services/media.md) (`image_url` + `thumbnail_url`, 25 МБ), у БД лежать тільки URL. Дозволені `/uploads/…` та `https://…` (відсікає `javascript:`/`data:`). `image_crop` — `{ x, y, zoom, ratio }` кадрування під картку, валідується `utils/image-crop.js` (однаковий файл у кожному сервісі із зображеннями); некоректне значення тихо стає `null`.

## Rich-text

Усі багаторядкові описи й нотатки — HTML-рядки (TipTap) у звичайних `TEXT`-колонках; бекенд їх не інтерпретує. У HTML можуть бути вузли кубиків та внутрішні посилання на записи ([frontend](services/frontend.md)).

## Форми (вміння та заклинання)

Колонки запису — основна форма; додаткові — у `forms JSONB`: рівневі `primitive`/`perfected` (по одній, `id = kind`) або `alternative` (власна назва, `id` — UUID). Змішувати рівневі й альтернативні не можна. Освоєння персонажем — `form_tier` / `primary_form` / `mastered_forms`; вузол дерева обмежує форму через `node_grants.form_key`. Деталі — [abilities](services/abilities.md), [spellbook](services/spellbook.md), [character-sheet](services/character-sheet.md).

## Міграції

`database/migrations/NN-назва.sql` застосовує `database/migrate.sh` у порядку `sort -V`, фіксуючи кожен файл у `public.schema_migrations`. Файли **не ідемпотентні за замовчуванням** — деякі міграції навмисно одноразові (напр. 89). Номер `67` використано двічі (`67-location-multi-type-version-range`, `67-rename-calendar-schema-to-chronology`) — порядок задає сортування імен. На проді `migrate.sh` викликається останнім кроком деплою.

## Real-time

Єдиний real-time-канал — SSE кампанії (`GET /api/campaigns/:id/events`, тема без даних; клієнт перезапитує REST). Шина подій — у памʼяті процесу `campaigns`, тому сервіс має працювати **однією репплікою**. Публікує лише `campaigns`; зміни, зроблені напряму в character-sheet (відпочинок, стани), лист сповіщає через `POST /api/campaigns/characters/:characterId/notify` (або синхронізацію ХП), а сам лист слухає SSE кампаній, до яких прикріплено персонажа (`campaign_ids` у відповіді листа).
