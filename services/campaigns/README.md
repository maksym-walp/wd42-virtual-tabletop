# campaigns

Сервіс кампаній: Майстер (ГМ) створює кампанію, гравці приєднують до неї власних персонажів (за invite-кодом або напряму, руками ГМ), кампанія має спільні нотатки (бачать усі учасники) і нотатки ГМ (бачить лише він), а також галерею зображень. Порт **3010**.

Nginx проксує `/api/campaigns/` → цей сервіс (див. корінний `README.md`).

## Ендпоінти

Базовий шлях — `/api/campaigns` (`src/routes/campaign.routes.js`). Усі запити потребують `Authorization: Bearer <access_token>` (`requireAuth`, `src/middleware/auth.middleware.js`, перевіряється `JWT_ACCESS_SECRET`) — публічних ендпоінтів немає. Усі відповіді — JSON.

Авторизаційні рівні:
- **JWT** — будь-який автентифікований користувач;
- **GM-only** — лише `req.user.sub === campaign.gm_id`, інакше `403`;
- **учасник (GM або member)** — ГМ або власник персонажа, приєднаного до кампанії (`CampaignCharacterModel.isMember`), інакше `403`.

Помилки: `400` — валідація тіла запиту; `401` — немає/недійсний токен; `403` — авторизований, але без прав; `404` — кампанію/персонажа/зображення не знайдено; `500` — внутрішня помилка. Формат помилки — `{ "message": "..." }` (глобальний error-хендлер у `src/index.js`, `err.statusCode || 500`).

### Кампанії

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| POST | `/` | JWT | `{ name* }` | `201 { campaign }` (з новим `invite_code`) або `400`, якщо немає `name` |
| GET | `/` | JWT | — | `200 { campaigns: [...] }` — кампанії, де користувач ГМ або власник приєднаного персонажа; в кожній є `is_gm`; `gm_notes` присутнє лише там, де `is_gm === true` |
| GET | `/:id` | учасник | — | `200 { campaign: { ..., is_gm } }` (з `gm_notes`, якщо ГМ; без — якщо звичайний учасник) або `404`/`403` |
| PATCH | `/:id` | GM-only | `{ name* }` (обрізається `.trim()`) | `200 { campaign }` або `400` (порожнє імʼя), `404`, `403` |
| DELETE | `/:id` | GM-only | — | `204` (каскадно видаляє `campaign_characters` і `campaign_gallery`) або `404`, `403` |
| PATCH | `/:id/shared-notes` | GM-only | `{ shared_notes? }` (дефолт `''`) | `200 { campaign }` або `404`, `403` |
| PATCH | `/:id/gm-notes` | GM-only | `{ gm_notes? }` (дефолт `''`) | `200 { campaign }` або `404`, `403` |

### Персонажі в кампанії

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| POST | `/join` | JWT | `{ invite_code*, character_id* }` | `201 { campaign, character_id }` — новий звʼязок; `200 { message, campaign }` — персонаж уже приєднаний (ідемпотентно); `400` — без полів; `404` — невірний код або персонажа не знайдено; `403` — персонаж належить іншому користувачу |
| POST | `/:id/characters` | GM-only | `{ character_id* }` | `201 { character_id }` — новий звʼязок; `200 { message }` — вже приєднаний; `400`/`404`/`403` |
| GET | `/:id/characters` | учасник | — | `200 { characters: [...] }` — з `owner_id`, `owner_username`, `owner_email`, `is_mine` (порівняння `owner_id` з `req.user.sub`) або `404`/`403` |
| DELETE | `/:id/characters/:characterId` | GM-only | — | `204` — відвʼязує персонажа від кампанії (сам лист персонажа не видаляється) або `404`, `403` |

### Галерея

Зображення — це лише URL, що зберігається в БД; сам файл кладе `media`-сервіс (`POST /api/media/upload` з `entity_type=campaign-gallery`, `entity_id=<campaign_id>`) — `campaigns` файлів не приймає й не зберігає.

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/:id/gallery` | учасник | — | `200 { images: [...] }` або `404`/`403` |
| POST | `/:id/gallery` | GM-only | `{ image_url* }` | `201 { image }` або `400` — `image_url` не проходить білий список (див. нижче), `404`, `403` |
| DELETE | `/:id/gallery/:imageId` | GM-only | — | `204` (файл на диску не видаляється — див. корінний `README.md`, розділ «Завантажені зображення») або `404` (не знайдено в межах цієї кампанії), `403` |

**Білий список `image_url`** (`isAllowedImageUrl`, `src/controllers/campaign-gallery.controller.js`): рядок, довжиною від 1 до 500 символів (= `VARCHAR(500)` у схемі), що починається з `/uploads/` (свій upload) або `https://` (зовнішнє посилання). Це навмисно відсікає `javascript:`/`data:` та інші схеми, які інакше могли б потрапити в `<img src>` на сторінці кампанії.

`*` — обовʼязкове поле.

## Схема БД

Власна схема `campaigns` (`database/migrations/23-campaigns-service.sql`, `26-campaign-gallery.sql`):

- **`campaigns.campaigns`** (`src/models/campaign.model.js`) — `id`, `gm_id`, `name` (`VARCHAR(200)`), `invite_code` (`VARCHAR(12)`, унікальний, генерується сервісом при створенні — `crypto.randomBytes` → base64url → 8 символів A-Z0-9, з ретраєм при колізії `23505`), `shared_notes` (`TEXT`), `gm_notes` (`TEXT`), `created_at`, `updated_at`.
- **`campaigns.campaign_characters`** (`src/models/campaign-character.model.js`) — звʼязка кампанія↔персонаж: `id`, `campaign_id` (FK → `campaigns.id`, `ON DELETE CASCADE`), `character_id` (без FK — крос-схемний UUID, як і в `character_sheet`, персонажі належать сервісу `character-sheet`), `added_at`, унікальність по парі `(campaign_id, character_id)`.
- **`campaigns.campaign_gallery`** (`src/models/campaign-gallery.model.js`) — `id`, `campaign_id` (FK → `campaigns.id`, `ON DELETE CASCADE`), `image_url` (`VARCHAR(500)`), `created_at`.

Крос-схемні запити (без FK, лише JOIN за читання): `findAllForUser`/`findCharacterOwner` в `campaign.model.js` і `listWithOwners`/`isMember` в `campaign-character.model.js` звертаються до `character_sheet.characters` (і далі до `auth.users` за `username`/`email` власника) — модель авторизації в контролерах спирається саме на це: «учасник» кампанії означає «власник хоча б одного персонажа, приєднаного до неї».

Авторизація (хто ГМ, хто учасник) повністю вирішується в контролерах (`loadCampaignOr404`/`isGm`, `src/controllers/load-campaign.js`) — самі моделі жодного гейта за `user_id` не роблять.

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
- контролери (`src/controllers/__tests__`) мокають моделі (`jest.mock('../../models/...')`) і перевіряють коди відповіді (`400`/`403`/`404`/`200`/`201`/`204`) та форму payload'у, зокрема: приховування `gm_notes` для не-ГМ у `listMine`/`getOne`, ідемпотентність приєднання персонажа (`200` замість `201`, якщо вже доданий), обчислення `is_mine` в списку персонажів, білий список `image_url` у галереї; несподівані помилки моделі не перехоплюються контролером, а прокидаються (`rejects.toBe`) до глобального error-хендлера в `src/index.js`;
- middleware (`src/middleware/__tests__`) перевіряє `requireAuth`.
