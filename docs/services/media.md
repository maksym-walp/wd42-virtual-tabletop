# media

Сервіс завантаження зображень: приймає файл, перевіряє його, кладе на диск під згенерованим ім'ям, створює стиснуту мініатюру та повертає обидва URL. Порт **3012** (`/api/media/` через Nginx).

На відміну від інших бекенд-сервісів репозиторію, `media` не має БД — жодної схеми, жодних таблиць. Файли живуть на спільному Docker-volume `media_data`, а URL, що повертає сервіс, зберігають у себе сервіси-виклики (`campaigns`, `character-sheet`, `equipment` тощо).

## Ендпоінти

Усі запити потребують `Authorization: Bearer <access_token>` (`src/middleware/auth.middleware.js`, перевіряється `JWT_ACCESS_SECRET`).

| Метод | Шлях      | Авторизація | Тіло запиту                                                                 | Відповідь |
|-------|-----------|-------------|------------------------------------------------------------------------------|-----------|
| POST  | `/upload` | Bearer JWT  | `multipart/form-data`: поле-файл `file` (одне), текстові поля `entity_type`, `entity_id` (потрібне лише для деяких типів — див. нижче) | `201 { "image_url": "/uploads/<relDir>/<uuid>.<ext>", "thumbnail_url": "/uploads/<relDir>/<uuid>_thumb.webp" }` |

Помилки: `400` — файл не надіслано, невідомий `entity_type`, некоректний `entity_id`, файл не проходить перевірку magic bytes або поле файлу зайве/неочікуване; `401` — відсутній/недійсний токен; `413` — файл більший за ліміт (25 МБ); `500` — інше.

Delete-ендпоінта немає — це свідоме рішення, див. розділ нижче.

## Куди зберігаються файли: entity_type → шлях

Мапу задає `src/lib/resolve-target.js` (`TARGETS`) — це єдиний білий список значень `entity_type`, який сервіс приймає; усе інше відхиляється до будь-якого звернення до диска:

| `entity_type`          | Потрібен `entity_id` | Шлях на диску (відносно `UPLOAD_DIR`) | Хто використовує |
|-------------------------|:---------------------:|-----------------------------------------|------------------|
| `campaign-gallery`       | так (UUID)             | `campaigns/<entity_id>/gallery/`         | Стіл кампанії ([campaigns](campaigns.md)) |
| `combat-scene`           | так (UUID)             | `campaigns/combat-scenes/<entity_id>/`   | бойові сцени |
| `map-lenses`             | так (UUID)             | `maps/<entity_id>/lenses/`               | лінзи мап ([maps](maps.md)) |
| `map-preview`            | так (UUID)             | `maps/<entity_id>/preview/`              | прев'ю мап |
| `location`               | ні                     | `maps/locations/`                        | локації |
| `marker-icon`            | ні                     | `maps/marker-icons/`                     | іконки міток |
| `character`              | так (UUID)             | `characters/<entity_id>/`                | портрети персонажів |
| `item`                   | ні                     | `items/`                                 | каталоги (спорядження, заклинання, вміння, НІПи, істоти…) |
| `collection`             | ні                     | `collections/`                           | зображення колекцій |
| `skill-node-icon`        | ні                     | `skill-tree/icons/`                      | іконки вузлів дерева |
| `skill-tree-background`  | ні                     | `skill-tree/backgrounds/`                | фони вкладок дерева |
| `compendium-race`        | ні                     | `compendium/races/`                      | раси/народи |
| `calendar-season`        | ні                     | `calendar/seasons/`                      | фони сезонів ([chronology](chronology.md)) |
| `deck-card`              | ні                     | `tools/decks/`                           | карти колод ([tools](tools.md)) |

Коли `entity_id` потрібен, він звіряється з регексом UUID (v1–v5) — саме це, а не санітайзинг рядка, унеможливлює path traversal (`..`, `/`, `\`, NUL). Додатково є assert, що обчислений абсолютний шлях лишається всередині `UPLOAD_DIR` — страховка на випадок, якщо колись додадуть новий `entity_type` з менш суворим форматом ID.

## Валідація завантаження

1. **Дозволені MIME-типи** (`src/config/upload.js`, `MIME_EXT`): `image/jpeg`, `image/png`, `image/webp`, `image/gif`. Файл з іншим `Content-Type` частини відхиляється multer'ом (`fileFilter`) ще до контролера.
2. **Перевірка магічних байтів** (`src/lib/sniff.js`) — заявленому клієнтом MIME-типу не довіряють: реальні перші байти буфера звіряються із сигнатурою (JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, GIF `GIF8`, WebP — RIFF-контейнер із `WEBP` на 8-му байті). Це блокує, наприклад, SVG чи HTML, надіслані під виглядом `image/png`.
3. **Ліміт розміру** — 25 МБ (`MAX_BYTES` у `src/config/upload.js`, multer `limits.fileSize`; під високороздільні мапи). `client_max_body_size 25M` виставлено в `nginx/*.conf` лише на локації `/api/media/` — вирівняно з multer; решта ендпоінтів лишається на дефолтному 1m. Більше за ліміт відсіює nginx (`413` з HTML-тілом) ще до Node.
4. **Ім'я файлу генерується сервером**: `crypto.randomUUID()` + розширення з `MIME_EXT` (не з `file.mimetype` клієнта напряму, а через мапу на основі вже провалідованого типу). `req.file.originalname` не читається ніде — навіть «очищене» клієнтське ім'я лишалося б зайвим вектором атаки.

**Мініатюра.** Окрім оригіналу сервіс через `sharp` робить копію шириною до 400 px у `webp` (якість 80, без збільшення) і кладе поруч як `<uuid>_thumb.webp`. Каталоги зберігають обидва URL (`image_url` + `thumbnail_url`), щоб списки й картки тягнули мініатюру.

Файл приймається в пам'ять (`multer.memoryStorage()`), а не одразу на диск: це дозволяє повністю провалідувати вміст (sniff) до першого запису у файлову систему, і не залежить від порядку полів у формі.

## Stateless-сервіс, зберігання файлів

`media` не має БД і не володіє жодною схемою. Файли лежать на Docker-volume `media_data`, змонтованому в `/uploads`:
- контейнер `media` монтує volume на запис і є єдиним, хто туди пише;
- `nginx` монтує той самий volume лише на читання й віддає `/uploads/...` як статику, не звертаючись до Node.

Єдиний слід того, хто що завантажив, — рядок у логах (`console.log` у контролері з `user.sub`, `entity_type` і URL); БД-запису немає. Сервіси-виклики самі зберігають повернутий `url` у своїх таблицях (наприклад `campaigns.campaign_gallery.image_url`, `character_sheet.characters.image_url`).

Volume переживає `docker compose down`, але знищується `docker compose down -v`.

## Чому немає delete-ендпоінта

Це навмисне рішення. Щоб безпечно видалити файл, потрібно перевірити, що запитувач — власник об'єкта, до якого файл прив'язаний (кампанії, персонажа, предмета). У сервіса немає БД і немає доступу до даних про власність — він отримує лише `entity_type`/`entity_id` як непровірені текстові поля форми. Додавання delete без цієї перевірки означало б, що будь-який автентифікований користувач міг би видалити чужий файл, знаючи його `entity_type`/`entity_id`. Тому сервіс delete не робить узагалі; осиротілі файли на диску — свідомий компроміс.

## Змінні оточення

Читаються напряму з `process.env` у коді сервіса:

| Змінна               | Де використовується        | За замовчуванням     | Призначення |
|-----------------------|-----------------------------|-----------------------|-------------|
| `PORT`                 | `src/index.js`               | `3012`                 | порт, на якому слухає сервіс |
| `FRONTEND_URL`         | `src/index.js`               | `http://localhost`     | дозволений origin для CORS |
| `UPLOAD_DIR`           | `src/config/upload.js`       | `/uploads`             | корінь, куди пишуться файли |
| `JWT_ACCESS_SECRET`    | `src/middleware/auth.middleware.js` | —              | перевірка access-токена |

Повний список спільних змінних — у кореневому `.env.example`.

## Тести

```bash
cd services/media
npm install
npm test
```

Покриття: `src/controllers/__tests__/media.controller.test.js`, `src/middleware/__tests__/auth.middleware.test.js`, `src/lib/__tests__/resolve-target.test.js`, `src/lib/__tests__/sniff.test.js`.

## Запуск окремо від решти системи

```bash
cd services/media
npm install
npm run dev     # nodemon, hot-reload
# або
npm start        # звичайний запуск
```

Потрібен встановлений `UPLOAD_DIR` (локально — будь-яка тека з правами на запис) і `JWT_ACCESS_SECRET`, що збігається з тим, яким `auth` підписує токени.
