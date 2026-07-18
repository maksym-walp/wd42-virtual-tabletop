# Walp Tabletop

Мікросервісний застосунок для настільної рольової гри: аутентифікація, профіль користувача, книга заклинань, дерево навичок, лист персонажа. Frontend на React, кожен бекенд-сервіс — окремий Node.js/Express застосунок, спільна БД PostgreSQL, маршрутизація через Nginx.

## Структура проекту

```
.
├── docker-compose.yml          # dev-оточення
├── docker-compose.prod.yml     # prod-оточення
├── .env / .env.example         # спільні змінні оточення
├── nginx/                      # реверс-проксі (dev/prod конфіги)
├── database/
│   ├── init/                   # SQL, що виконується при першому старті postgres
│   ├── migrations/             # подальші міграції
│   └── migrate.sh              # застосовує ще не застосовані міграції
└── services/
    ├── auth/                   # порт 3001 — реєстрація/логін, JWT
    ├── user-profile/           # порт 3002 — профіль користувача
    ├── spellbook/               # порт 3003 — заклинання
    ├── skill-tree/              # порт 3004 — дерево навичок
    ├── character-sheet/         # порт 3005 — лист персонажа
    ├── dice-roller/              # порт 3006 — кидки кубиків
    ├── equipment/                # порт 3007 — зброя/обладунки/предмети
    ├── maneuvers/                # порт 3008 — маневри бійців
    ├── abilities/                 # порт 3009 — вміння (за архетипами)
    ├── campaigns/                 # порт 3010 — кампанії ГМ/гравців
    ├── artifacts/                 # порт 3011 — артефакти
    └── frontend/                 # порт 5173 (dev) — React/Vite SPA
```

Кожен бекенд-сервіс має однакову структуру: `src/{config,controllers,middleware,models,routes}`, `src/index.js` — точка входу, тести в `src/**/__tests__`.

Nginx проксує запити з порту 80:
- `/api/auth/` → auth
- `/api/profile/` → user-profile
- `/api/spellbook/` → spellbook
- `/api/skill-tree/` → skill-tree
- `/api/characters/` → character-sheet
- `/api/dice/` → dice-roller
- `/api/equipment/` → equipment
- `/api/maneuvers/` → maneuvers
- `/api/abilities/` → abilities
- `/api/campaigns/` → campaigns
- `/api/artifacts/` → artifacts
- `/` → frontend

## Швидкий старт (Docker)

1. Скопіювати `.env.example` у `.env` і заповнити значення (особливо `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — згенерувати командою з коментаря у файлі).
2. Підняти все dev-оточення:
   ```bash
   docker compose up --build
   ```
3. Застосунок доступний на `http://localhost` (через Nginx). Postgres додатково прокинутий на `localhost:5433`.

Dev-контейнери бекенд-сервісів мають примонтовану `src/` папку (`nodemon`, hot-reload). Фронтенд-контейнер запускає Vite dev-сервер.

### Продакшн

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Відмінності від dev: збірка production-стадії Dockerfile (без hot-reload), Postgres не проброшений назовні, Nginx слухає 80 і 443 з SSL-сертифікатами з `nginx/ssl`, використовується `nginx/nginx.prod.conf`.

### Керування окремими сервісами в Docker

```bash
docker compose up -d postgres auth          # підняти тільки потрібні сервіси
docker compose logs -f auth                 # логи одного сервіса
docker compose restart spellbook
docker compose down                         # зупинити все (додати -v щоб видалити volume БД)
```

## Локальний запуск без Docker

Потрібен Node.js 20+ і локальний/віддалений PostgreSQL, змінні оточення — з `.env`.

Для кожного бекенд-сервіса (`auth`, `user-profile`, `spellbook`, `skill-tree`, `character-sheet`, `dice-roller`, `equipment`, `maneuvers`, `abilities`, `campaigns`, `artifacts`):
```bash
cd services/<service>
npm install
npm run dev     # nodemon, hot-reload
# або
npm start        # звичайний запуск
```

Frontend:
```bash
cd services/frontend
npm install
npm run dev       # Vite dev-сервер, http://localhost:5173
npm run build      # прод-збірка у dist/
npm run preview    # перегляд прод-збірки локально
```

## Тести

Тести є лише в бекенд-сервісах (Jest), у frontend тестів немає.

Запуск тестів одного сервіса:
```bash
cd services/<service>   # auth | user-profile | spellbook | skill-tree | character-sheet | dice-roller | equipment | maneuvers | abilities | campaigns | artifacts
npm test
```

Прогнати тести всіх бекенд-сервісів послідовно:
```bash
for s in auth user-profile spellbook skill-tree character-sheet dice-roller equipment maneuvers abilities campaigns artifacts; do
  (cd services/$s && npm test) || break
done
```

## База даних

- При першому старті контейнера `postgres` автоматично виконуються скрипти з `database/init/*.sql` (у порядку номерів).
- Файли в `database/migrations/*.sql` застосовує `database/migrate.sh`: він проганяє всі ще не застосовані файли по порядку і фіксує їх у таблиці `schema_migrations`, тож повторний запуск безпечний.
  ```bash
  bash database/migrate.sh
  ```
  На проді цей скрипт викликається останнім кроком деплой-воркфлоу (`.github/workflows/deploy.yml`) — окремо запускати не потрібно. Локально (dev) запускати вручну після `docker compose up`.
- Підключення до БД усередині Docker-мережі: `postgres:5432`. Зовні (dev) — `localhost:5433`.

## Змінні оточення

Див. `.env.example`. Основні:
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`
- `FRONTEND_URL` — для CORS
- `AUTH_SERVICE_URL` — внутрішній URL для міжсервісних викликів
- `PORT` — задається окремо для кожного сервіса в docker-compose (3001–3011)
