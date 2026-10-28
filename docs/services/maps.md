# maps

Інтерактивні мапи світу та бібліотека локацій. Мапа — набір **шарів** (зображень, що змінюються за роками світу) з **мітками**, які посилаються на локації. Локація має хронологічні **версії** (опис, нотатка майстра, зображення, іконка). Порт **3013** (`/api/maps/` через Nginx), схема БД `maps`.

Мапи автономні: до кампанії вони привʼязуються не тут, а записом `map` на Столі кампанії та рядком у `campaigns.campaign_maps` ([campaigns](campaigns.md)); сервіс лише читає цей зв'язок, щоб вирішити, які мітки бачить гравець.

## Ендпоінти

Усі маршрути потребують `Authorization: Bearer <access-token>` (`requireAuth`, `JWT_ACCESS_SECRET`); публічних нема. Роутери: `/locations` → локації, решта (корінь) → мапи (локації змонтовані **першими**, бо мапи володіють кореневим `/:id`). Помилки — `{ message }`; `409` при дубліку версії для року.

Права (`src/controllers/access.js`):
- **створювати** мапи й локації — лише `game_master` та `admin`;
- **читати мапу** — власник (`created_by`), будь-хто, якщо `is_public`, або `admin`; **писати** — власник чи `admin`;
- **локація**: писати й бачити `gm_note` — власник чи `admin`; решта може прочитати локацію лише якщо її закріплено на мапі, яку вони можуть читати, і не бачить `gm_note` жодної версії.

### Мапи (`/`)

| Метод | Шлях | Доступ | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/` | авторизований | — | `200 { maps }` — власні + публічні (адмін: усі) |
| POST | `/` | `game_master` / `admin` | `{ name*, is_public? }` | `201 { map }` / `400` / `403` |
| GET | `/:id` | читання мапи | — | `200 { map }` (з `is_owner`) / `403` / `404` |
| PATCH | `/:id` | власник / `admin` | `{ name?, is_public?, preview_image_url?, preview_thumbnail_url? }` — `preview_*`: `undefined` — не чіпати, `null`/`''` — прибрати; лише `/uploads/…` або `https://`; мініатюра йде в парі з оригіналом | `200 { map }` / `400` / `403` / `404` |
| PATCH | `/:id/owner` | лише `admin` | `{ owner_username }` | `200 { map }` / `400` / `404` |
| DELETE | `/:id` | власник / `admin` | — | `204` (каскадно шари, версії, мітки) |

### Шари (`/:mapId/lenses`)

Шар — іменована картинка мапи (напр. «Політична», «Фізична»); кожен має щонайменше одну версію зображення, привʼязану до року світу (`year`, може бути від'ємним; `NULL` — «позачасова»).

| Метод | Шлях | Доступ | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/:mapId/lenses` | читання мапи | — | `200 { lenses }` (з `versions`) |
| POST | `/:mapId/lenses` | запис мапи | `{ name*, image_url*, year? }` — створює шар і його першу версію | `201 { lens }` / `400` |
| PATCH | `/:mapId/lenses/:lensId` | запис мапи | `{ name* }` — лише перейменування | `200 { lens }` / `404` |
| DELETE | `/:mapId/lenses/:lensId` | запис мапи | — | `204` / `404` |
| POST | `/:mapId/lenses/:lensId/versions` | запис мапи | `{ image_url*, year? }` | `201 { version }` / `400` / `409` (вже є версія на цей рік) |
| PATCH | `/:mapId/lenses/:lensId/versions/:versionId` | запис мапи | `{ image_url*, year? }` | `200 { version }` / `404` / `409` |
| DELETE | `/:mapId/lenses/:lensId/versions/:versionId` | запис мапи | — | `204` / `400` (єдину версію шару видаляти не можна) / `404` |

### Мітки (`/:mapId/pins`)

Мітка ставить локацію на мапу у нормалізованих координатах.

| Метод | Шлях | Доступ | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/:mapId/pins` | читання мапи | — | `200 { pins }`. Власник/адмін бачить усі мітки (з повним `visible_campaign_ids`). Решта — лише мітки без обмеження кампанією плюс мітки кампаній, привʼязаних до цієї мапи (`campaigns.campaign_maps`), учасником яких є глядач (ГМ або власник приєднаного персонажа). Контекст рахується на сервері, не з `?campaign_id` |
| POST | `/:mapId/pins` | запис мапи | `{ location_id*, x_coordinate*, y_coordinate*, min_zoom?, max_zoom?, lens_ids?, visible_campaign_ids?, start_year?, end_year? }` | `201 { pin }` / `400` |
| PATCH | `/:mapId/pins/:pinId` | запис мапи | ті самі поля без `location_id` | `200 { pin }` / `400` / `404` |
| DELETE | `/:mapId/pins/:pinId` | запис мапи | — | `204` / `404` |

Валідація: координати — числа `0..1`; `min_zoom`/`max_zoom` — цілі ≥ 0, `min_zoom ≤ max_zoom` (за замовчуванням 0 і 100); `lens_ids` — масив UUID **шарів цієї мапи**; `visible_campaign_ids` — масив UUID кампаній (перевіряється лише форма, не існування; порожній = без обмеження); `start_year ≤ end_year` (діапазон років, коли мітка видима; порожні — без обмеження). Закріпити можна лише локацію, якою користувач володіє (або `admin`).

### Локації (`/locations`)

| Метод | Шлях | Доступ | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/locations` | авторизований | — | `200 { locations }` — **власна** бібліотека (для авторингу й закріплення) |
| POST | `/locations` | `game_master` / `admin` | `{ name*, types?, marker_icon?, marker_level?, ...поля першої версії }` | `201 { location }` — створює локацію разом з базовою версією |
| GET | `/locations/export` | авторизований | `?id=` для однієї | `200 [ локації з versions ]` — масив у форматі імпорту; з `gm_note`, тому лише власна бібліотека або власник/адмін для `?id` (`403` інакше) |
| POST | `/locations/import` | `game_master` / `admin` | масив локацій | `201 { imported }` / `400` (не масив) |
| GET | `/locations/:id` | власник/адмін або якщо закріплена на читабельній мапі | — | `200 { location }` з `versions` (без `gm_note` для невласників) / `403` / `404` |
| PATCH | `/locations/:id` | власник / `admin` | `{ name*, types?, marker_icon?, marker_level? }` — лише базові поля | `200 { location }` |
| PATCH | `/locations/:id/owner` | лише `admin` | `{ owner_username }` | `200 { location }` / `400` / `404` |
| DELETE | `/locations/:id` | власник / `admin` | — | `204` |
| POST | `/locations/:id/versions` | власник / `admin` | поля версії (нижче) | `201 { version }` / `400` / `409` |
| PATCH | `/locations/:id/versions/:versionId` | власник / `admin` | поля версії | `200 { version }` / `404` / `409` |
| DELETE | `/locations/:id/versions/:versionId` | власник / `admin` | — | `204` / `400` (єдину версію видаляти не можна) / `404` |

**Базові поля локації**: `name`, `types` (масив довільних ключів, до 50 символів кожен; білого списку нема), `marker_icon` (URL `/uploads/…`, `/map-markers/…`, `https://…` або короткий емодзі, ≤ 16 символів), `marker_level` (ціле 1–4).

**Версії** — хронологічні знімки: `start_year`/`end_year` (діапазон років, коли версія діє; `end_year` порожній = безстроково; `start_year ≤ end_year`), `description` і `gm_note` (rich-text HTML; `gm_note` бачить лише власник/адмін), `image_url` (`/uploads/…` або `https://`), і необов'язкові перевизначення `name` (≤ 200), `marker_icon`, `marker_level`, `types` (`null` — успадкувати від базової локації). Перша версія — базова, перевизначень у неї нема. Другої версії з тим самим `start_year` бути не може (`409`).

Експорт/імпорт: файл несе `gm_note` і версії без `id`; прибираються `id`, `created_by`, `created_at`, `updated_at`. Імпорт прибирає некоректні іконки, рівні й типи (порожнє замість помилки), власник — імпортер.

## Схема БД

Сервіс володіє схемою `maps` (міграції 35–38 — створення, 61, 64–66, `67-location-multi-type-version-range`, 84):

- `maps.maps` — `created_by`, `name`, `is_public`, `preview_image_url`, `preview_thumbnail_url`, часові мітки.
- `maps.map_lenses` — `map_id` (FK `CASCADE`), `name`.
- `maps.map_lens_versions` — `map_lens_id` (FK `CASCADE`), `year` (nullable), `image_url`; унікальність пари (шар, рік).
- `maps.map_pins` — `map_id` (FK `CASCADE`), `location_id` (FK), `x_coordinate`, `y_coordinate` (0..1), `min_zoom`, `max_zoom`, `lens_ids UUID[]`, `visible_campaign_ids UUID[]` (голі UUID кампаній), `start_year`, `end_year`.
- `maps.locations` — `created_by`, `name`, `marker_icon`, `marker_level`, `types TEXT[]`.
- `maps.location_versions` — `location_id` (FK `CASCADE`), `start_year`, `end_year`, `description`, `gm_note`, `image_url`, перевизначення `name`/`marker_icon`/`marker_level`/`types`.

Міжсхемні читання: `campaigns.campaign_maps`, `campaigns.campaigns`, `campaigns.campaign_characters`, `character_sheet.characters` (членство в кампанії) — лише для видимості міток. Локації та їхній `id` використовують [chronology](chronology.md) (`location_id` події) і Стіл кампанії (запис `location`).

Зображення завантажуються через [media](media.md): `map-lenses`, `map-preview`, `location`, `marker-icon`.

## Змінні оточення

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — спільна БД (`src/config/db.js`).
- `JWT_ACCESS_SECRET` — перевірка access-токена.
- `FRONTEND_URL` — origin для CORS (за замовчуванням `http://localhost`).
- `PORT` — порт сервіса (за замовчуванням `3013`).

## Тести

```bash
cd services/maps
npm install
npm test
```

Jest, у `src/**/__tests__` (контролери, моделі). Сервіс не входить до матриці `test-backend` у `.github/workflows/deploy.yml`, тож у CI його тести не запускаються.
