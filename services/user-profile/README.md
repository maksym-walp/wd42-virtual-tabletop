# user-profile

Бекенд-сервіс профілю користувача: створює/повертає профіль поточного користувача та збирає публічний профіль будь-кого за іменем користувача, агрегуючи його публічні дані з інших сервісів. Порт **3002**, за Nginx доступний як `/api/profile/`.

## Ендпоінти

Усі шляхи нижче відносні до `/api/profile/` (через Nginx) або до кореня сервіса напряму (`http://localhost:3002/`). Авторизація — JWT access-токен у заголовку `Authorization: Bearer <token>`, перевіряється спільним `requireAuth` middleware (`src/middleware/auth.middleware.js`).

| Метод | Шлях          | Авторизація | Тіло запиту | Відповідь |
|-------|---------------|-------------|-------------|-----------|
| GET   | `/me`         | обов'язкова | —           | `200 { profile }` — профіль поточного користувача (`user_profile.profiles`); якщо рядка ще нема, створюється при першому зверненні (get-or-create) |
| GET   | `/u/:username`| обов'язкова | —           | `200 { username, characters, equipment, spells, abilities, maneuvers, collections }` — публічна активність користувача; `404 { message: "Користувача не знайдено" }`, якщо такого `username` нема серед активних (`auth.users.is_active = true`) |

Помилки, які не оброблені явно в контролері (наприклад, збій БД), пролітають до спільного error-handler'а в `src/index.js`, що повертає `err.statusCode || 500`.

## База даних

Сервіс володіє однією таблицею:

```sql
user_profile.profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

(колонки `display_name`, `bio`, `avatar_url` були прибрані міграцією `database/migrations/22-simplify-user-profile.sql` — сторінка профілю їх більше не показує).

### Крос-схемні читання

`GET /u/:username` не обмежується власною схемою — `src/models/publicProfile.model.js` читає напряму з чужих схем в тій самій Postgres-інстанції (той самий підхід, що й у `character-sheet` до `auth`). Кожен запит фільтрує `is_public = true` (і `is_active = true` для користувача), тому приватні дані ніколи не потрапляють у відповідь:

- `auth.users` — резолв `username` → `{ id, username }`
- `character_sheet.characters`
- `equipment.items`, `equipment.collections`
- `spellbook.spells`, `spellbook.collections`
- `abilities.entries`, `abilities.collections`
- `maneuvers.entries`, `maneuvers.collections`

## Змінні оточення

Читаються з `process.env` (значення — з кореневого `.env`, див. `.env.example`):

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — підключення до спільного Postgres (`src/config/db.js`)
- `JWT_ACCESS_SECRET` — перевірка access-токена в `requireAuth` (`src/middleware/auth.middleware.js`)
- `FRONTEND_URL` — дозволений origin для CORS (`src/index.js`)
- `PORT` — порт, на якому слухає сервіс (за замовчуванням `3002`; у docker-compose задається явно)

## Тести

```bash
cd services/user-profile
npm install
npm test
```

Тести (Jest) лежать поруч із кодом у `src/**/__tests__`:
- `src/controllers/__tests__/profile.controller.test.js` — контролери, з замоканими моделями
- `src/models/__tests__/profile.model.test.js`, `src/models/__tests__/publicProfile.model.test.js` — моделі, з замоканим `pg`-пулом (`src/config/__mocks__/db.js`)
- `src/middleware/__tests__/auth.middleware.test.js` — JWT-перевірка

Без локально встановленого Node.js тести можна прогнати через Docker з кореня репозиторію:
```bash
docker compose run --rm user-profile npm test
```
