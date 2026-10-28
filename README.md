# Walp Tabletop

Мікросервісний застосунок для настільної рольової гри (українською): акаунти й ролі, листи персонажів, дерево розвитку, каталоги заклинань, вмінь і спорядження, бестіарій і НІПи, кампанії зі Столом/Ширмою та боєм у реальному часі, інтерактивні мапи, фентезійні календарі, допоміжні інструменти (сузір'я, колоди карт). Frontend на React, кожен бекенд-сервіс — окремий Node.js/Express застосунок зі своєю схемою у спільній БД PostgreSQL, маршрутизація через Nginx.

**Докладна документація — у [docs/](docs/README.md)**: індекс, [спільні домовленості](docs/conventions.md) і по одному файлу на сервіс у [docs/services/](docs/services/). Цей файл описує лише запуск, структуру репозиторію й інфраструктуру.

## Структура проекту

```
.
├── docker-compose.yml          # dev-оточення
├── docker-compose.prod.yml     # prod-оточення
├── .env / .env.example         # спільні змінні оточення
├── docs/                       # уся технічна документація (див. docs/README.md)
├── nginx/                      # реверс-проксі (nginx.conf — dev, nginx.prod.conf — prod)
├── database/
│   ├── init/                   # SQL, що виконується при першому старті postgres
│   ├── migrations/             # подальші міграції (NN-назва.sql)
│   └── migrate.sh              # застосовує ще не застосовані міграції
├── deploy/                     # systemd-юніти прод-стеку та оновлення сертифіката (certbot)
├── scripts/backup-db.sh        # pg_dump у backups/ (gzip, зберігання 14 днів)
├── .github/workflows/deploy.yml  # CI: тести бекендів + збірка frontend, деплой гілки production
└── services/
    ├── auth/               # 3001 — реєстрація/логін, JWT, ролі
    ├── user-profile/       # 3002 — профіль користувача
    ├── spellbook/          # 3003 — заклинання, традиції, колекції
    ├── skill-tree/         # 3004 — дерево розвитку
    ├── character-sheet/    # 3005 — лист персонажа
    ├── dice-roller/        # 3006 — кидки кубиків
    ├── equipment/          # 3007 — зброя/обладунки/предмети/артефакти
    ├── abilities/          # 3009 — вміння та маневри
    ├── campaigns/          # 3010 — кампанії ГМ/гравців, бій, SSE
    ├── admin/              # 3011 — конфіги сайту, ролі, бекап БД
    ├── media/              # 3012 — завантаження зображень (без БД)
    ├── maps/               # 3013 — інтерактивні мапи та локації
    ├── compendium/         # 3014 — види/підвиди, раси/народи
    ├── chronology/         # 3015 — календарі та події
    ├── bestiary/           # 3016 — істоти
    ├── npcs/               # 3017 — НІПи та фракції
    ├── tools/              # 3018 — сузір'я, колоди карт
    └── frontend/           # 5173 — React/Vite SPA
```

Кожен бекенд-сервіс має однакову структуру: `src/{config,controllers,middleware,models,routes}`, `src/index.js` — точка входу, тести в `src/**/__tests__` (деталі — [docs/conventions.md](docs/conventions.md)). Окрім сервісів у compose є `postgres` (16, том `postgres_data`), `adminer` (веб-UI БД, порт `ADMINER_PORT`, за замовчуванням 8080; на проді лише `127.0.0.1`) і `nginx`.

## Документація сервісів

Опис ендпоінтів (з правами доступу), схеми БД (включно з міжсхемними читаннями), змінних оточення й тестів кожного сервіса:

- [auth](docs/services/auth.md) · [user-profile](docs/services/user-profile.md) · [admin](docs/services/admin.md) · [media](docs/services/media.md)
- [spellbook](docs/services/spellbook.md) · [abilities](docs/services/abilities.md) · [equipment](docs/services/equipment.md) · [skill-tree](docs/services/skill-tree.md) · [character-sheet](docs/services/character-sheet.md) · [dice-roller](docs/services/dice-roller.md)
- [campaigns](docs/services/campaigns.md) · [maps](docs/services/maps.md) · [chronology](docs/services/chronology.md)
- [compendium](docs/services/compendium.md) · [bestiary](docs/services/bestiary.md) · [npcs](docs/services/npcs.md) · [tools](docs/services/tools.md)
- [frontend](docs/services/frontend.md)

Nginx проксує запити з порту 80 (на проді 80 → редірект на 443, 443 з SSL):
- `/api/auth/` → auth
- `/api/profile/` → user-profile
- `/api/spellbook/` → spellbook
- `/api/skill-tree/` → skill-tree
- `/api/characters/` → character-sheet
- `/api/dice/` → dice-roller
- `/api/equipment/` → equipment
- `/api/abilities/` → abilities (вміння та маневри)
- `/api/campaigns/` → campaigns (включно з SSE `/:id/events`)
- `/api/maps/` → maps
- `/api/compendium/` → compendium
- `/api/bestiary/` → bestiary
- `/api/npcs/` → npcs
- `/api/chronology/` → chronology
- `/api/tools/` → tools (сузір'я, колоди карт)
- `/api/admin/` → admin (`client_max_body_size 200M` і `proxy_read_timeout 300s` — під відновлення БД з архіву)
- `/api/media/` → media (завантаження файлів; `client_max_body_size 25M` лише тут)
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

Відмінності від dev: збірка production-стадії Dockerfile (без hot-reload), `restart: always`, Postgres не проброшений назовні, Nginx слухає 80 (лише ACME-challenge і редірект) та 443 з сертифікатами Let's Encrypt (`/etc/letsencrypt/live/tabletop.walpapur.com/`), використовується `nginx/nginx.prod.conf`. Прод-стек піднімає systemd-юніт `deploy/walp-tabletop.service`, сертифікат оновлює таймер `deploy/certbot-renew.timer` (webroot `certbot-webroot/`, після оновлення — `nginx -s reload`). Деплой автоматичний: push у гілку `production` → CI (тести + збірка frontend) → на self-hosted раннері `git reset --hard origin/production`, `docker compose build`, `up -d`, рестарт nginx, `database/migrate.sh`.

### Керування окремими сервісами в Docker

```bash
docker compose up -d postgres auth          # підняти тільки потрібні сервіси
docker compose logs -f auth                 # логи одного сервіса
docker compose restart spellbook
docker compose down                         # зупинити все (додати -v щоб видалити volume БД)
```

## Локальний запуск без Docker

Потрібен Node.js 20+ і локальний/віддалений PostgreSQL, змінні оточення — з `.env`.

Для кожного бекенд-сервіса (`auth`, `user-profile`, `spellbook`, `skill-tree`, `character-sheet`, `dice-roller`, `equipment`, `abilities`, `campaigns`, `admin`, `media`, `maps`, `compendium`, `chronology`, `bestiary`, `npcs`, `tools`):
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

Тести є лише в бекенд-сервісах (Jest, БД мокається), у frontend тестів немає (перевірка — `npm run build`). У CI (`.github/workflows/deploy.yml`) тести запускаються для `auth`, `user-profile`, `spellbook`, `skill-tree`, `character-sheet`, `dice-roller`, `equipment`, `abilities`, `campaigns`, `bestiary`, `npcs`, `admin`, `media`, `tools`; **`maps`, `compendium` і `chronology` до матриці CI не входять** — їхні тести доводиться запускати вручну.

Запуск тестів одного сервіса:
```bash
cd services/<service>   # будь-який бекенд-сервіс зі списку вище
npm test
```

Прогнати тести всіх бекенд-сервісів послідовно:
```bash
for s in auth user-profile spellbook skill-tree character-sheet dice-roller equipment abilities campaigns admin media maps compendium chronology bestiary npcs tools; do
  (cd services/$s && npm test) || break
done
```

## База даних

- Кожен сервіс володіє власною схемою (`auth`, `character_sheet`, `spellbook`, …), а посилання між схемами — голі UUID без FK; деталі — [docs/conventions.md](docs/conventions.md). Службові схеми: `public.schema_migrations` (журнал міграцій) і `trash.deleted_records` (знімки видалених записів).
- При першому старті контейнера `postgres` автоматично виконуються скрипти з `database/init/*.sql` (у порядку номерів); решту схеми створюють міграції.
- Файли в `database/migrations/*.sql` застосовує `database/migrate.sh`: він проганяє всі ще не застосовані файли по порядку і фіксує їх у таблиці `schema_migrations`, тож повторний запуск безпечний.
  ```bash
  bash database/migrate.sh
  ```
  На проді цей скрипт викликається останнім кроком деплой-воркфлоу (`.github/workflows/deploy.yml`) — окремо запускати не потрібно. Локально (dev) запускати вручну після `docker compose up`. Резервну копію знімає `scripts/backup-db.sh` (gzip-дамп у `backups/`), а адмін також може вивантажити/відновити всю БД у JSON-архіві через [admin](docs/services/admin.md) (медіафайли в архів не входять).
- Підключення до БД усередині Docker-мережі: `postgres:5432`. Зовні (dev) — `localhost:5433`.

## Завантажені зображення

Файли, які користувачі завантажують (галерея кампанії, портрети персонажів, зображення каталогів), лежать не в БД, а на спільному Docker-volume `media_data`:

- `media-service` монтує його в `/uploads` на запис і є єдиним, хто туди пише;
- `nginx` монтує той самий volume у `/uploads` **тільки для читання** і віддає `/uploads/...` як статику, взагалі не торкаючись Node.

У БД зберігаються лише URL (`character_sheet.characters.image_url`, `image_url` у каталогах та колекціях, зображення мап і локацій, записи Столу кампанії). Сам сервіс stateless — БД не має і схеми не володіє.

Наслідки, про які варто пам'ятати:

- Volume переживає `docker compose down`, але **знищується `docker compose down -v`** — разом із `postgres_data`.
- Видалення рядка з БД не видаляє файл з диска: `media-service` навмисно не має delete-ендпоінта, бо, не маючи БД, не зміг би перевірити власника файлу. Осиротілі файли — свідомий компроміс.
- Ліміт розміру — 25 МБ (multer), `client_max_body_size 25M` у nginx лише на `/api/media/`; решта ендпоінтів лишається на дефолтному 1m.
- Для кожного оригіналу сервіс створює webp-мініатюру (400 px) і повертає обидва URL (`image_url`, `thumbnail_url`).
- Приймаються тільки JPEG/PNG/WebP/GIF, причому перевіряється не заявлений MIME-тип, а реальні magic bytes.

## Змінні оточення

Див. `.env.example`. Основні:
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`
- `FRONTEND_URL` — для CORS
- `AUTH_SERVICE_URL` — присутня в `.env.example`, але жоден сервіс її не читає (токени перевіряються локально за `JWT_ACCESS_SECRET`, див. [docs/conventions.md](docs/conventions.md))
- `CHARACTER_SHEET_URL` — адреса character-sheet для campaigns (`http://character-sheet:3005`): таймер діяльності й завершення бою застосовують правила станів через HTTP — задокументований виняток, див. [docs/conventions.md](docs/conventions.md#міжсервісні-http-виклики)
- `ADMIN_USERNAMES` — імена через кому, яким auth при старті видає роль `admin`
- `ADMINER_PORT`, `ADMINER_BIND`, `ADMINER_DESIGN` — налаштування веб-UI БД
- `PORT` — задається окремо для кожного сервіса в docker-compose (3001–3018)
