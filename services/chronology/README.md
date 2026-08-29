# chronology

Сервіс власних фентезійних календарів і подій: місяці, дні тижня, сезони та супутники (місяці-небесні тіла) для кожного календаря, плюс лор-/сесійні події з місцем, персонажами та (опційно) тривалістю. Порт **3015** (`/api/chronology/` через Nginx).

## Ендпоінти

Усі шляхи — відносно кореня сервіса (Nginx проксує `/api/chronology/*` сюди). Авторизація — `Authorization: Bearer <access-token>`, перевіряється `requireAuth` (JWT, `JWT_ACCESS_SECRET`). Створення/редагування/видалення (`POST`/`PUT`/`DELETE`) додатково захищене `requireChronologyManager` — доступне лише ролям `admin` і `game_master`, **незалежно від того, хто створив календар** (не власницька перевірка, суто рольова).

### Календарі (`/`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/` | так | — | `200 { calendars: [...] }` — публічні + власні; адмін бачить усі |
| GET | `/:id` | так | — | `200 { calendar }` / `404`, якщо не існує або не видимий |
| POST | `/` | admin/game_master | `{ name, description?, current_era_name?, previous_era_name?, first_day_offset?, is_private? }` | `201 { calendar }` / `400` (без `name`) |
| PUT | `/:id` | admin/game_master | те саме, що й POST, плюс `default_year?`, `default_month_id?` | `200 { calendar }` / `404` |
| DELETE | `/:id` | admin/game_master | — | `200 { message }` / `404` |

`default_year`/`default_month_id` — рік і місяць, які ChronologyView відкриває за замовчуванням (коли немає прив'язаної кампанії з власною поточною датою — вона має пріоритет). Відсутні в `POST`, бо в щойно створеного календаря ще немає жодного місяця; `default_month_id`, якщо заданий, має належати цьому самому календарю — `400`, якщо це місяць іншого календаря.

### Місяці (`/:id/months`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/:id/months` | так (видимість батьківського календаря) | — | `200 { months: [...] }` |
| POST | `/:id/months` | admin/game_master | `{ name, length, order_num }` | `201 { month }` / `400` |
| PUT | `/:id/months/:monthId` | admin/game_master | те саме, що й POST | `200 { month }` / `404` |
| DELETE | `/:id/months/:monthId` | admin/game_master | — | `200 { message }` / `404` |

### Дні тижня (`/:id/weekdays`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/:id/weekdays` | так | — | `200 { weekdays: [...] }` |
| POST | `/:id/weekdays` | admin/game_master | `{ name, short_name?, order_num }` | `201 { weekday }` / `400` |
| PUT | `/:id/weekdays/:weekdayId` | admin/game_master | те саме, що й POST | `200 { weekday }` / `404` |
| DELETE | `/:id/weekdays/:weekdayId` | admin/game_master | — | `200 { message }` / `404` |

`short_name` (до 3 символів) — компактне позначення дня тижня для вузьких екранів (`ChronologyView`, < 768px); необов'язкове, порожнє падає назад на повне `name`.

### Сезони (`/:id/seasons`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/:id/seasons` | так | — | `200 { seasons: [...] }` |
| POST | `/:id/seasons` | admin/game_master | `{ name, start_month_id, start_day, color, bg_image_url? }` | `201 { season }` / `400` |
| PUT | `/:id/seasons/:seasonId` | admin/game_master | те саме, що й POST | `200 { season }` / `404` |
| DELETE | `/:id/seasons/:seasonId` | admin/game_master | — | `200 { message }` / `404` |

Примітки:
- `color` — hex-формат `#rrggbb` (`400`, якщо не відповідає).
- `start_month_id` має належати тому самому календарю (`:id` з URL) — `400`, якщо це місяць іншого календаря.

### Супутники (`/:id/moons`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/:id/moons` | так | — | `200 { moons: [...] }` |
| POST | `/:id/moons` | admin/game_master | `{ name, cycle_length, shift?, color }` | `201 { moon }` / `400` |
| PUT | `/:id/moons/:moonId` | admin/game_master | те саме, що й POST | `200 { moon }` / `404` |
| DELETE | `/:id/moons/:moonId` | admin/game_master | — | `200 { message }` / `404` |

### Події (`/:id/events`)

| Метод | Шлях | Авторизація | Тіло запиту | Відповідь |
|---|---|---|---|---|
| GET | `/:id/events` | так | — (опційно `?campaign_id=...`) | `200 { events: [...] }` (кожен елемент несе `participant_ids: string[]`) |
| POST | `/:id/events` | admin/game_master | `{ campaign_id?, name, description?, color, is_public?, year?, month_id?, day?, recurrence?, location_id?, region?, end_year?, end_month_id?, end_day?, participant_ids? }` | `201 { event }` / `400` |
| PUT | `/:id/events/:eventId` | admin/game_master | те саме, що й POST | `200 { event }` / `404` |
| DELETE | `/:id/events/:eventId` | admin/game_master | — | `200 { message }` / `404` |

Примітки:
- `campaign_id` відсутній/`null` → глобальна лор-подія, видима у будь-якій кампанії з цим календарем. Заданий → подія належить лише цій кампанії.
- `GET` без `?campaign_id`: лише глобальні події (`campaign_id IS NULL`). З `?campaign_id=X`: глобальні події **плюс** події кампанії `X`.
- `is_public` (за замовчуванням `true`) ховає подію від звичайних користувачів у `GET` — `admin`/`game_master` бачать усі події незалежно від `is_public`.
- `color` — hex-формат `#rrggbb`; `recurrence` — одне з `none`/`yearly`/`monthly`/`weekly` (за замовчуванням `none`); `day`/`end_day`, якщо задані, мають бути додатними.
- `month_id`/`end_month_id`, якщо задані, мають належати тому самому календарю (`:id` з URL) — `400`, якщо це місяць іншого календаря. `year`/`month_id`/`day` незалежно nullable — подію можна прив'язати до часу настільки точно, наскільки відомо ГМу; заповнення `end_year`/`end_month_id`/`end_day` перетворює точкову подію на тривалу.
- `location_id` (крос-сервісний UUID → `maps.locations.id`, без FK) і `region` (вільний текст, до 200 символів) взаємовиключні — `400`, якщо задані обидва.
- `participant_ids` — масив крос-сервісних UUID (`compendium.compendium_entries.id`, НІПи чи істоти); повна заміна набору учасників події при кожному `POST`/`PUT` (порожній масив чи відсутність поля прибирає всіх).

Усі неочікувані помилки моделі (наприклад, збій БД) не перехоплюються контролерами — вони прокидаються далі у глобальний error-handler (`err.statusCode || 500`), визначений у `src/index.js`.

## Схема БД

Сервіс володіє схемою `chronology` (перейменована з `calendar` — таблиці всередині зберегли свої назви):

- `chronology.calendars` — сам календар (`creator_id`, `name`, `description`, `current_era_name`, `previous_era_name`, `first_day_offset`, `is_private`, `default_year`, `default_month_id` → `calendar_months.id` (`ON DELETE SET NULL`), …). Видимість: власник + адмін завжди; будь-який автентифікований користувач, якщо `is_private = false`.
- `chronology.calendar_months` — місяці календаря (`calendar_id`, `name`, `length`, `order_num`).
- `chronology.calendar_weekdays` — дні тижня (`calendar_id`, `name`, `short_name`, `order_num`).
- `chronology.calendar_seasons` — сезони (`calendar_id`, `name`, `start_month_id` → `calendar_months.id`, `start_day`, `color`, `bg_image_url`).
- `chronology.calendar_moons` — супутники (`calendar_id`, `name`, `cycle_length`, `shift`, `color`).
- `chronology.calendar_events` — лор-/сесійні події (`calendar_id`, `campaign_id` — нативно nullable, крос-сервісний UUID без FK на `campaigns.campaigns.id`, як і скрізь у репо для крос-сервісних посилань, — `name`, `description`, `color`, `is_public`, `year`, `month_id` → `calendar_months.id`, `day`, `recurrence` — ENUM `chronology.event_recurrence` (`none`/`yearly`/`monthly`/`weekly`), `location_id` — крос-сервісний UUID → `maps.locations.id`, `region`, `end_year`, `end_month_id` → `calendar_months.id`, `end_day`; `location_id`/`region` взаємовиключні через `CHECK`).
- `chronology.calendar_event_participants` — учасники події (`event_id` → `calendar_events.id` `ON DELETE CASCADE`, `entry_id` — крос-сервісний UUID → `compendium.compendium_entries.id`, складений `PRIMARY KEY (event_id, entry_id)`).

Усі дочірні таблиці мають `calendar_id` з `ON DELETE CASCADE` — видалення календаря прибирає всю його структуру. `calendar_seasons.start_month_id`, `calendar_events.month_id`/`end_month_id` теж каскадні: видалення місяця прибирає сезони й події, що на нього посилаються.

## Змінні оточення

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — підключення до спільної БД.
- `JWT_ACCESS_SECRET` — перевірка access-токена в `requireAuth`.
- `FRONTEND_URL` — дозволений origin для CORS.
- `PORT` — порт, на якому слухає сервіс (за замовчуванням `3015`; у docker-compose задається окремо).

## Тести

```bash
cd services/chronology
npm install
npm test
```

Або через Docker (з кореня репозиторію), без локального Node.js:
```bash
docker compose run --rm chronology npm test
```

Покриття: моделі (`src/models/__tests__`), контролери (`src/controllers/__tests__`), auth-middleware (`src/middleware/__tests__`). Контролери тестуються з замоканими моделями (`jest.mock`) — перевіряються коди статусів (`400`/`404`/`200`/`201`), форма відповіді та рольова гейтованість.
