# campaigns

Сервіс кампаній: Майстер (ГМ) створює кампанію, гравці приєднують до неї власних персонажів (за invite-кодом або напряму, руками ГМ), кампанія має Стіл (спільна дошка записів, які ГМ відкриває чи ховає від гравців), Ширму (записи й нотатки лише для ГМ), сесії та бойову сцену. Зміни розсилаються відкритим вкладкам у реальному часі через Server-Sent Events. Порт **3010**.

Nginx проксує `/api/campaigns/` → цей сервіс (див. корінний `README.md`).

## Ендпоінти

Базовий шлях — `/api/campaigns` (`src/routes/campaign.routes.js`). Усі запити потребують `Authorization: Bearer <access_token>` (`requireAuth`, `src/middleware/auth.middleware.js`, перевіряється `JWT_ACCESS_SECRET`) — публічних ендпоінтів немає. Усі відповіді — JSON.

Авторизаційні рівні:
- **JWT** — будь-який автентифікований користувач;
- **GM-only** — `req.user.sub === campaign.gm_id` **або адмін** (`req.user.role === 'admin'`, права майстра в будь-якій кампанії), інакше `403` (`canManage`, `src/controllers/load-campaign.js`);
- **учасник (GM або member)** — ГМ/адмін або власник персонажа, приєднаного до кампанії (`CampaignCharacterModel.isMember`), інакше `403` (`canView`).

Помилки: `400` — валідація тіла запиту; `401` — немає/недійсний токен; `403` — авторизований, але без прав; `404` — кампанію/персонажа/зображення не знайдено; `500` — внутрішня помилка. Формат помилки — `{ "message": "..." }` (глобальний error-хендлер у `src/index.js`, `err.statusCode || 500`).

### Кампанії

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| POST | `/` | JWT | `{ name* }` | `201 { campaign }` (з новим `invite_code`) або `400`, якщо немає `name` |
| GET | `/` | JWT | `?scope=all` (лише адмін — усі кампанії) | `200 { campaigns: [...] }` — кампанії, де користувач ГМ або власник приєднаного персонажа; в кожній є `is_gm` (майстерські права) і `access` (`gm`/`admin`/`player`); `gm_notes` присутнє лише там, де `is_gm === true` |
| GET | `/:id` | учасник | — | `200 { campaign: { ..., is_gm, access } }` (з `gm_notes`, якщо ГМ/адмін; без — якщо звичайний учасник) або `404`/`403` |
| PATCH | `/:id` | GM-only | `{ name* }` (обрізається `.trim()`) | `200 { campaign }` або `400` (порожнє імʼя), `404`, `403` |
| DELETE | `/:id` | GM-only | — | `204` (каскадно видаляє `campaign_characters`, `campaign_board_items` тощо) або `404`, `403` |
| POST | `/:id/invite-code/regenerate` | GM-only | — | `200 { campaign }` з новим `invite_code` (старий перестає працювати) |
| GET | `/:id/events` | учасник | — | `text/event-stream` (див. «Real-time» нижче) |
| PATCH | `/:id/gm-notes` | GM-only | `{ gm_notes? }` (дефолт `''`) | `200 { campaign }` або `404`, `403` |
| PATCH | `/:id/description` | GM-only | `{ description? }` (дефолт `''`) | `200 { campaign }` або `404`, `403` |
| PATCH | `/:id/date` | GM-only | `{ calendar_id?, current_year?, current_month_id?, current_day? }` — усі чотири поля замінюються разом (відсутні → `null`) | `200 { campaign }` або `404`, `403` |

### Персонажі в кампанії

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| POST | `/join` | JWT | `{ invite_code*, character_id* }` | `201 { campaign, character_id }` — новий звʼязок; `200 { message, campaign }` — персонаж уже приєднаний (ідемпотентно); `400` — без полів; `404` — невірний код або персонажа не знайдено; `403` — персонаж належить іншому користувачу |
| POST | `/:id/characters` | GM-only | `{ character_id* }` | `201 { character_id }` — новий звʼязок; `200 { message }` — вже приєднаний; `400`/`404`/`403` |
| GET | `/:id/characters` | учасник | — | `200 { characters: [...] }` — з `owner_id`, `owner_username`, `owner_email`, `is_mine` (порівняння `owner_id` з `req.user.sub`) або `404`/`403` |
| DELETE | `/:id/characters/:characterId` | GM-only | — | `204` — відвʼязує персонажа від кампанії (сам лист персонажа не видаляється) або `404`, `403` |

### Стіл і Ширма

Одна впорядкована дошка записів із двома зонами: `table` (Стіл — гравці бачать лише записи з `is_visible`) і `screen` (Ширма — лише ГМ/адмін). Типи (`kind`): `npc`, `creature`, `spell`, `equipment` (+ `ref_subtype` = `item`/`weapon`/`armor`/`artifact`), `ability`, `faction`, `location`, `map` — записи каталогів; `image`, `note`, `custom` — власні записи ГМ.

Запис каталогу зберігається **знімком картки** (`title`, `subtitle`, `image_url`, `image_crop`, `content`), прочитаним із чужої схеми в момент додавання (`src/models/board-source.model.js`, видимість — публічне/власне/адмін; статів і приватних нотаток знімок не містить). Тож гравець бачить картку навіть приватного НІПа ГМ, а `refresh` перечитує її з джерела. Запис `map` додатково лінкується в `campaign_maps` — звідти maps-сервіс бере контекст кампанії для пінів.

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/:id/board?zone=table\|screen` | учасник (`screen` — GM-only) | — | `200 { items: [...] }` за `position`; гравцеві — лише видимі записи Столу й лише мапи, які він може відкрити |
| POST | `/:id/board` | GM-only | `{ zone?, kind*, ref_id?, ref_subtype?, title?, content?, image_url?, is_visible? }` | `201 { item }` — новий запис стає першим у зоні (на Столі за замовчуванням захований); `400`, `404` (джерело недоступне), `409` (мапа вже на дошці) |
| PATCH | `/:id/board/:itemId` | GM-only | `{ zone?, is_visible?, is_featured?, title?, subtitle?, content?, image_url? }` | `200 { item }`. Зміна `zone` ставить запис першим у новій зоні захованим і не основним; `is_featured: true` знімає позначку з попереднього (один основний на кампанію) |
| POST | `/:id/board/:itemId/refresh` | GM-only | — | `200 { item }` — знімок перечитано з джерела; `400` для власних записів |
| PUT | `/:id/board/order` | GM-only | `{ zone*, ids*: [uuid] }` | `204` — `position` = порядок у масиві |
| DELETE | `/:id/board/:itemId` | GM-only | — | `204` (для `map` — також прибирає `campaign_maps`; файл зображення на диску лишається) |

**Білий список `image_url`** (`isAllowedImageUrl`, `src/controllers/board.controller.js`): рядок, довжиною від 1 до 500 символів (= `VARCHAR(500)` у схемі), що починається з `/uploads/` (свій upload, `entity_type=campaign-gallery`) або `https://`. Це навмисно відсікає `javascript:`/`data:` та інші схеми, які інакше могли б потрапити в `<img src>`.

### Real-time

`GET /:id/events` — Server-Sent Events (`src/controllers/events.controller.js`, шина `src/realtime/bus.js`). Подія несе лише тему — `data: {"topic":"board"}`; клієнт перезапитує відповідний ресурс звичайним REST-запитом, тож урізання даних для гравців не змінюється. Теми: `board`, `screen` (лише ГМ/адмін), `campaign`, `sessions`, `characters`, `combat`. Heartbeat `: ping` — кожні 25 с (менше за `proxy_read_timeout` nginx), `X-Accel-Buffering: no` вимикає буферизацію nginx. Шина живе в памʼяті процесу — сервіс має працювати однією реплікою (інакше — перевести `bus.js` на `pg LISTEN/NOTIFY`). Фронтенд читає стрім через `fetch` (`hooks/useCampaignEvents.js`), щоб токен ішов у заголовку, а не в URL.

`*` — обовʼязкове поле.

## Схема БД

Власна схема `campaigns` (`database/migrations/23-campaigns-service.sql`, `87-campaign-board.sql` та ін.):

- **`campaigns.campaigns`** (`src/models/campaign.model.js`) — `id`, `gm_id`, `name` (`VARCHAR(200)`), `invite_code` (`VARCHAR(12)`, унікальний, генерується сервісом при створенні — `crypto.randomBytes` → base64url → 8 символів A-Z0-9, з ретраєм при колізії `23505`), `shared_notes` (`TEXT`, з міграції 87 не використовується — перенесено на Стіл), `gm_notes` (`TEXT`), `description` (`TEXT`), `calendar_id`/`current_year`/`current_month_id`/`current_day` (`database/migrations/60-campaign-time-tracking.sql` — трекінг поточної дати кампанії, усі nullable; `calendar_id`/`current_month_id` — крос-сервісні посилання на `calendar.calendars`/`calendar.calendar_months` у сервісі `calendar`, без FK, як і `character_id` нижче), `created_at`, `updated_at`.
- **`campaigns.campaign_characters`** (`src/models/campaign-character.model.js`) — звʼязка кампанія↔персонаж: `id`, `campaign_id` (FK → `campaigns.id`, `ON DELETE CASCADE`), `character_id` (без FK — крос-схемний UUID, як і в `character_sheet`, персонажі належать сервісу `character-sheet`), `added_at`, унікальність по парі `(campaign_id, character_id)`.
- **`campaigns.campaign_board_items`** (`src/models/board-item.model.js`) — записи Столу/Ширми: `id`, `campaign_id` (FK, `ON DELETE CASCADE`), `zone`, `kind`, `ref_id`/`ref_subtype` (крос-схемне джерело, без FK), знімок `title`/`subtitle`/`image_url`/`image_crop`/`content`, `is_visible`, `is_featured` (частковий UNIQUE — один на кампанію), `position`, `created_at`, `updated_at`.
- **`campaigns.campaign_maps`** — звʼязок кампанія↔мапа для maps-сервісу; пишеться разом із записом `map` на дошці.
- **`campaigns.campaign_gallery`** — застаріла, з міграції 87 не використовується (вміст перенесено на Стіл як записи `image`).

Крос-схемні запити (без FK, лише JOIN за читання): `findAllForUser`/`findCharacterOwner` в `campaign.model.js` і `listWithOwners`/`isMember` в `campaign-character.model.js` звертаються до `character_sheet.characters` (і далі до `auth.users` за `username`/`email` власника) — модель авторизації в контролерах спирається саме на це: «учасник» кампанії означає «власник хоча б одного персонажа, приєднаного до неї».

Авторизація (хто ГМ, хто учасник) повністю вирішується в контролерах (`loadCampaignOr404`/`canManage`/`canView`, `src/controllers/load-campaign.js`) — самі моделі жодного гейта за `user_id` не роблять.

## Змінні оточення

Читаються напряму з `process.env` (див. `.env`/`.env.example` у корені репозиторію):

| Змінна | Де використовується | За замовчуванням | Призначення |
|---|---|---|---|
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | `src/config/db.js` | — | підключення до спільної PostgreSQL |
| `JWT_ACCESS_SECRET` | `src/middleware/auth.middleware.js` | — | перевірка access-токена в `requireAuth` |
| `FRONTEND_URL` | `src/index.js` | `http://localhost` | дозволений origin для CORS |
| `PORT` | `src/index.js` | `3010` | порт, на якому слухає сервіс |

## Запуск

Локально без Docker:
```bash
cd services/campaigns
npm install
npm run dev     # nodemon, hot-reload
# або
npm start
```

Через Docker — див. корінний `README.md` (`docker compose up --build`, окремо: `docker compose up -d postgres campaigns`).

## Тести

```bash
cd services/campaigns
npm test
```

Покриття:
- моделі (`src/models/__tests__`) мокають `pg`-пул (`src/config/__mocks__/db.js`) і перевіряють SQL/параметри;
- контролери (`src/controllers/__tests__`) мокають моделі (`jest.mock('../../models/...')`) і перевіряють коди відповіді (`400`/`403`/`404`/`200`/`201`/`204`) та форму payload'у, зокрема: приховування `gm_notes` для не-ГМ у `listMine`/`getOne`, ідемпотентність приєднання персонажа (`200` замість `201`, якщо вже доданий), обчислення `is_mine` в списку персонажів, доступ адміна, видимість записів Столу/Ширми і білий список `image_url` на дошці, real-time події після мутацій; несподівані помилки моделі не перехоплюються контролером, а прокидаються (`rejects.toBe`) до глобального error-хендлера в `src/index.js`;
- middleware (`src/middleware/__tests__`) перевіряє `requireAuth`;
- `src/realtime/__tests__` — шину подій.
