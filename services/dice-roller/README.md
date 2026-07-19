# dice-roller

Сервіс кидків кубиків: приймає формулу (наприклад `2d20+1d8+adv(1d10)-5`), розбирає й обчислює її, зберігає кожен кидок в історію користувача та рахує зведену статистику. Порт **3006** (`/api/dice/` через Nginx).

## Ендпоінти

Усі шляхи — відносно кореня сервіса (Nginx проксує `/api/dice/*` сюди). Усі три ендпоінти потребують `Authorization: Bearer <access_token>` (`requireAuth`, `src/middleware/auth.middleware.js`, перевіряється `JWT_ACCESS_SECRET`) — неавтентифікованих маршрутів немає.

| Метод | Шлях | Авторизація | Тіло запиту / query | Відповідь |
|---|---|---|---|---|
| POST | `/rolls` | Bearer JWT | `{ formula: string }` | `201 { roll }` / `400`, якщо `formula` відсутнє або не є рядком |
| GET | `/rolls` | Bearer JWT | query: `limit?`, `offset?` | `200 { rolls: [...] }` |
| GET | `/stats` | Bearer JWT | — | `200 { stats }` |

Примітки:
- `POST /rolls` розбирає й обчислює формулу через `rollFormula()` (`src/formula/index.js`) і одразу зберігає результат через `RollModel.create`. Помилку формули (`FormulaError`, невірний синтаксис / перевищені ліміти) контролер не перехоплює — вона прокидається у глобальний error-handler (`err.statusCode || 500`, `src/index.js`), який зазвичай віддає `400` з текстом помилки українською.
- `GET /rolls`: `limit` обмежується формулою `Math.min(Number(query.limit) || 20, 100)` (за замовчуванням 20, максимум 100; нечислове значення тихо повертається до 20), `offset` — `Number(query.offset) || 0` (за замовчуванням 0, нечислове значення — 0).
- `GET /stats` — суцільна статистика по всіх кидках користувача: кількість кидків, час останнього кидка, загальна кількість кинутих кубиків, кількість натуральних 20 і 1 на d20, розбивка по гранях кубика (`by_die`).
- Форма об'єкта `roll`, що повертає `POST /rolls` і елементи `rolls` у `GET /rolls`: `{ id, user_id, formula, total, groups, created_at }`, де `groups` — покроковий розбір кожного доданка формули (тип кубика/модифікатор, конкретні кинуті значення, знак, проміжна сума).

## Синтаксис формули та ліміти

Реалізовано в `src/formula/` (`tokenizer.js` → `parser.js` → `evaluator.js`, зібрано разом у `index.js`; ці шари вже покриті власними тестами в `src/formula/__tests__/`).

Граматика (спрощено):
```
Formula      := Signed ( ('+' | '-') Signed )*
Signed       := ('-')? Term
Term         := WrappedGroup | DiceGroup | Integer
DiceGroup    := N 'd' M            (напр. 2d20)
WrappedGroup := ('adv'|'dis'|'wadv'|'wdis') '(' DiceGroup ')'
```

- `NdM` — кинути `N` кубиків з `M` гранями і підсумувати. Кубик має щонайменше 2 грані (`d1` заборонено) і не більше 1000 граней; `N` — від 1 до 100 в одній групі (ліміти `MIN_SIDES`/`MAX_SIDES`/`MAX_COUNT_PER_GROUP` у `src/formula/parser.js`).
- `adv(NdM)` / `dis(NdM)` — переваги/незручність: кожен з `N` кубиків кидається двічі, лишається краще (`adv`) або гірше (`dis`) значення, потім усе сумується.
- `wadv(NdM)` / `wdis(NdM)` — «зважена» перевага/незручність: кожен кубик кидається тричі, лишається найкраще (`wadv`) або найгірше (`wdis`) значення.
- Голе ціле число (наприклад `-5`) — плоский модифікатор, додається/віднімається без кидка.
- Доданки з'єднуються `+`/`-`; перед першим доданком також можна поставити знак.

Ліміти в `src/formula/index.js`, що перевіряються після парсингу і до обчислення (кидання самих кубиків):
- `MAX_TERMS = 20` — не більше 20 доданків у формулі загалом.
- `MAX_TOTAL_DICE = 500` — сумарна «вага» кубиків у формулі. Плоский `NdM` важить `N`, а обгорнутий кубик важить `N`, помножене на коефіцієнт режиму: `adv`/`dis` — ×2 (кожен кубик кидається двічі), `wadv`/`wdis` — ×3 (кожен кубик кидається тричі). Модифікатори (голі числа) у цю суму не входять.
- Порожня чи складена лише з пробілів формула відхиляється ще до токенізації.

Усі помилки формули (порожня формула, невідомий символ, перевищені ліміти, некоректна структура) — екземпляри `FormulaError` (`src/formula/errors.js`) зі властивістю `statusCode` (типово `400`).

## Схема БД

Сервіс володіє схемою `dice_roller` (`database/init/07-dice-roller.sql`):

- `dice_roller.rolls` — один рядок на кожен кидок (append-only, без `update`/`delete`-ендпоінтів): `id` (UUID), `user_id`, `formula` (текст оригінальної формули), `total` (підсумкове число), `groups` (JSONB — покроковий розбір, що саме випало по кожному доданку), `created_at`.
- Індекс `idx_dice_roller_rolls_user_created` на `(user_id, created_at DESC)` — під історію (`GET /rolls`, сортування за часом) і статистику.

`GET /stats` рахує зведення прямо в SQL (`RollModel.getStats`, `src/models/roll.model.js`): розкладає `groups` через `jsonb_array_elements`, окремо для простих кубиків (`type = 'dice'`) і обгорнутих (`type IN ('adv','dis','wadv','wdis')`, бере лише `kept`-значення кожного кубика), рахує суму/мін/макс по гранях і кількість `nat20`/`nat1` серед d20.

## Змінні оточення

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — підключення до спільної БД (`src/config/db.js`).
- `JWT_ACCESS_SECRET` — перевірка access-токена в `requireAuth`.
- `FRONTEND_URL` — дозволений origin для CORS (за замовчуванням `http://localhost`).
- `PORT` — порт, на якому слухає сервіс (за замовчуванням `3006`; у docker-compose задається окремо).

Повний список спільних змінних — у кореневому `.env.example`.

## Тести

```bash
cd services/dice-roller
npm install
npm test
```

Або через Docker (з кореня репозиторію), без локального Node.js:
```bash
docker compose run --rm dice-roller npm test
```

Покриття:
- `src/formula/__tests__/tokenizer.test.js`, `parser.test.js`, `evaluator.test.js` — нижні шари формульного рушія (розбір рядка на токени, побудова доданків, обчислення кидків).
- `src/formula/__tests__/index.test.js` — оркестрація `rollFormula()`: порожня/пробільна формула, ліміт `MAX_TERMS`, ліміт `MAX_TOTAL_DICE` разом із множниками режимів (`adv`/`dis` ×2, `wadv`/`wdis` ×3).
- `src/controllers/__tests__/roll.controller.test.js` — контролер із замоканими `../formula` та `RollModel`: валідація `formula` (400), збереження успішного кидка (201), прокидання `FormulaError` з рушія формул без перехоплення (обробляє глобальний error-handler у `src/index.js`), клампінг/дефолти `limit`/`offset` у `GET /rolls`, наскрізна передача статистики в `GET /stats`.

## Запуск окремо від решти системи

```bash
cd services/dice-roller
npm install
npm run dev     # nodemon, hot-reload
# або
npm start        # звичайний запуск
```

Потрібні змінні підключення до БД та `JWT_ACCESS_SECRET`, що збігається з тим, яким `auth` підписує токени.
