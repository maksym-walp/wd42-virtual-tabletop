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
    ├── media/                     # порт 3012 — завантаження зображень
    └── frontend/                 # порт 5173 (dev) — React/Vite SPA
```

Кожен бекенд-сервіс має однакову структуру: `src/{config,controllers,middleware,models,routes}`, `src/index.js` — точка входу, тести в `src/**/__tests__`.

## Документація сервісів

Кожен бекенд-сервіс має власний `README.md` з переліком ендпоінтів, схемою БД (включно з міжсхемними читаннями), змінними оточення та інструкцією запуску тестів:

- [auth](services/auth/README.md) — реєстрація/логін, JWT
- [user-profile](services/user-profile/README.md) — профіль користувача
- [spellbook](services/spellbook/README.md) — заклинання
- [skill-tree](services/skill-tree/README.md) — дерево навичок
- [character-sheet](services/character-sheet/README.md) — лист персонажа
- [dice-roller](services/dice-roller/README.md) — кидки кубиків
- [equipment](services/equipment/README.md) — зброя/обладунки/предмети
- [maneuvers](services/maneuvers/README.md) — маневри бійців
- [abilities](services/abilities/README.md) — вміння за архетипами
- [campaigns](services/campaigns/README.md) — кампанії ГМ/гравців
- [artifacts](services/artifacts/README.md) — артефакти
- [media](services/media/README.md) — завантаження зображень

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
- `/api/media/` → media (завантаження файлів; `client_max_body_size 12m` лише тут)
- `/uploads/` → статика з volume `media_data`, повз бекенд
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

Для кожного бекенд-сервіса (`auth`, `user-profile`, `spellbook`, `skill-tree`, `character-sheet`, `dice-roller`, `equipment`, `maneuvers`, `abilities`, `campaigns`, `artifacts`, `media`):
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
cd services/<service>   # auth | user-profile | spellbook | skill-tree | character-sheet | dice-roller | equipment | maneuvers | abilities | campaigns | artifacts | media
npm test
```

Прогнати тести всіх бекенд-сервісів послідовно:
```bash
for s in auth user-profile spellbook skill-tree character-sheet dice-roller equipment maneuvers abilities campaigns artifacts media; do
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

## Завантажені зображення

Файли, які користувачі завантажують (галерея кампанії, портрети персонажів, зображення каталогів), лежать не в БД, а на спільному Docker-volume `media_data`:

- `media-service` монтує його в `/uploads` на запис і є єдиним, хто туди пише;
- `nginx` монтує той самий volume у `/uploads` **тільки для читання** і віддає `/uploads/...` як статику, взагалі не торкаючись Node.

У БД зберігаються лише URL (`campaigns.campaign_gallery.image_url`, `character_sheet.characters.image_url`, `image_url` у п'яти каталогах). Сам сервіс stateless — БД не має і схеми не володіє.

Наслідки, про які варто пам'ятати:

- Volume переживає `docker compose down`, але **знищується `docker compose down -v`** — разом із `postgres_data`.
- Видалення рядка з БД не видаляє файл з диска: `media-service` навмисно не має delete-ендпоінта, бо, не маючи БД, не зміг би перевірити власника файлу. Осиротілі файли — свідомий компроміс.
- Ліміт розміру — 10 МБ (multer), `client_max_body_size 12m` у nginx лише на `/api/media/`; решта ендпоінтів лишається на дефолтному 1m.
- Приймаються тільки JPEG/PNG/WebP/GIF, причому перевіряється не заявлений MIME-тип, а реальні magic bytes.

## Змінні оточення

Див. `.env.example`. Основні:
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`
- `FRONTEND_URL` — для CORS
- `AUTH_SERVICE_URL` — внутрішній URL для міжсервісних викликів
- `PORT` — задається окремо для кожного сервіса в docker-compose (3001–3012)
