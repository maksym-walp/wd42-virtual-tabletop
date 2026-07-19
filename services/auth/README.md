# auth

Сервіс аутентифікації: реєстрація, логін, видача та оновлення JWT, зміна акаунту/пароля. Порт **3001** (`/api/auth/` через Nginx). Єдиний сервіс, що володіє таблицями `auth.users` та `auth.refresh_tokens` — інші сервіси не звертаються до цієї схеми напряму, а перевіряють токен через `GET /validate` або власну копію `requireAuth`-мідлвари.

## Ендпоінти

Базовий шлях (через Nginx): `/api/auth`. У самому сервісі роути змонтовані на `/`.

| Метод | Шлях          | Авторизація        | Тіло запиту                                 | Відповідь |
|-------|---------------|---------------------|----------------------------------------------|-----------|
| POST  | `/register`   | ні                  | `{ email, username, password }` (email валідний, username 3–50 символів, password ≥ 8 символів) | 201, `{ accessToken, user: { id, email, username, role } }` + cookie `refresh_token` |
| POST  | `/login`      | ні                  | `{ email, password }`                        | 200, `{ accessToken, user }` + cookie `refresh_token` |
| POST  | `/refresh`    | cookie `refresh_token` | —                                          | 200, `{ accessToken }`; 401 `{ message: 'No refresh token' }`, якщо cookie відсутня |
| POST  | `/logout`     | `Authorization: Bearer <accessToken>` | —                       | 200, `{ message: 'Logged out' }`, cookie `refresh_token` очищається |
| GET   | `/me`         | `Authorization: Bearer <accessToken>` | —                       | 200, `{ user: { id, email, username, role } }` |
| PATCH | `/me`         | `Authorization: Bearer <accessToken>` | `{ email?, username? }`                | 200, `{ user, accessToken }` |
| PUT   | `/me/password`| `Authorization: Bearer <accessToken>` | `{ currentPassword, newPassword }` (newPassword ≥ 8 символів) | 200, `{ message: 'Password changed' }`, cookie `refresh_token` очищається (усі сесії користувача відкликаються) |
| GET   | `/validate`   | `Authorization: Bearer <token>` | —                                   | 200 `{ valid: true, user: <JWT payload> }` або 401 `{ valid: false }` |

`/register`, `/login`, `/me` (PATCH), `/me/password` валідуються через `express-validator` (`src/middleware/validate.middleware.js`): при помилці — 400 `{ errors: [...] }`, обробник контролера не викликається.

`/validate` призначений для інших бекенд-сервісів/зовнішніх клієнтів, щоб перевірити access-токен, не маючи прямого доступу до JWT-секрету.

## Схема БД

Володіє схемою `auth` (`database/init/01-init.sql`):

```sql
auth.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  username      VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL DEFAULT 'user',
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
)

auth.refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,   -- SHA-256 хеш refresh-токена, сам токен у БД не зберігається
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

Роль (`role`) — `user` або `admin`. Самостійного шляху отримати `admin` немає: роль видається лише через `ADMIN_USERNAMES` при старті сервіса (`src/config/seedAdmins.js`).

## Схема токенів і cookie

- **Access token** (JWT, підписаний `JWT_ACCESS_SECRET`, короткий TTL) повертається в тілі відповіді (`accessToken`) і зберігається на клієнті поза cookie (наприклад, у пам'яті фронтенду). Клієнт передає його в заголовку `Authorization: Bearer <accessToken>`. Payload: `{ sub, email, username, role }`.
- **Refresh token** (JWT, підписаний `JWT_REFRESH_SECRET`, довший TTL) видається лише як **httpOnly cookie** `refresh_token` — недоступний з JS на клієнті:
  ```
  httpOnly: true
  secure: true у продакшн (NODE_ENV=production), інакше false
  sameSite: 'strict'
  maxAge: 7 днів (фіксовано в коді контролера)
  path: '/'
  ```
  У БД зберігається лише SHA-256-хеш refresh-токена (`auth.refresh_tokens.token_hash`), тож витік бекапу БД не дає змоги відновити сам токен.
- `POST /refresh` обмінює дійсну cookie на новий access token, не видаючи новий refresh token.
- `PUT /me/password` і `POST /logout` очищають cookie; зміна пароля додатково видаляє **всі** refresh-токени користувача (`deleteAllRefreshTokens`) — інші активні сесії теж інвалідуються.

## Змінні оточення

| Змінна | Призначення |
|---|---|
| `JWT_ACCESS_SECRET` | секрет для підпису/перевірки access-токенів |
| `JWT_REFRESH_SECRET` | секрет для підпису/перевірки refresh-токенів |
| `JWT_ACCESS_EXPIRES` | TTL access-токена (за замовчуванням `15m`) |
| `JWT_REFRESH_EXPIRES` | TTL refresh-токена (за замовчуванням `7d`); також визначає термін дії рядка в `auth.refresh_tokens` |
| `ADMIN_USERNAMES` | список username через кому — при кожному старті сервіса промотуються в роль `admin` (ідемпотентно, `src/config/seedAdmins.js`) |
| `FRONTEND_URL` | дозволений origin для CORS (`credentials: true`, потрібно для роботи cookie) |
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | підключення до спільної БД |
| `PORT` | порт, на якому слухає сервіс (за замовчуванням `3001`) |
| `NODE_ENV` | коли `production` — cookie `refresh_token` виставляється з `secure: true` |

Значення беруться з кореневого `.env` (див. `.env.example`).

## Тести

```bash
cd services/auth
npm install
npm test
```

Тести лежать поряд із кодом у `src/**/__tests__` (Jest): моделі, сервіс аутентифікації, обидва мідлвари (`requireAuth`, `requireAdmin`), `validate.middleware`, `seedAdmins` і контролер (`auth.controller`) — усі зовнішні залежності (БД, `auth.service`) мокаються, БД для тестів не потрібна.
