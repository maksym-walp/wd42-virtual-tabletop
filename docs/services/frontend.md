# frontend

React 18 SPA (Vite 5, Tailwind 4, react-router 6) — єдиний клієнт до всіх бекенд-сервісів. Порт **5173** (dev: Vite; prod: `serve -s dist` у Docker-стадії `production`), за Nginx доступний на `/`. Власного бекенду й БД нема: усі дані — через `/api/*` (маршрути Nginx — у [кореневому README](../../README.md)). Мова інтерфейсу — українська. Тестів у frontend немає.

## Стек і збірка

| | |
|---|---|
| UI | React 18, Tailwind CSS 4 (`@tailwindcss/vite`), `lucide-react` (іконки), шрифти Cinzel + Lora (`@fontsource`, self-hosted) |
| Роутинг | `react-router-dom` 6 (`src/App.jsx`) |
| HTTP | `axios` (`src/api/client.js`) |
| Rich-text | TipTap 2 (`@tiptap/*`) — редактор `SmartTextarea`, читач `SmartTextReader` |
| Мапи | `leaflet` + `react-leaflet` |
| Кадрування зображень | `react-easy-crop` |
| PWA | `vite-plugin-pwa` (`autoUpdate`; **API не кешується** — `NetworkOnly` для `/api/`; `/uploads/` — `CacheFirst`, 30 діб) |

Скрипти (`package.json`): `npm run dev` (Vite, `0.0.0.0:5173`, HMR через порт 80 за Nginx), `npm run build` (→ `dist/`), `npm run preview`, `npm run icons` (`scripts/generate-icons.js` генерує фавікон/PWA-іконки з `branding/logo.png`, див. `branding/README.md`). Dockerfile має стадії `development`, `build`, `production`. У dev-контейнері змонтовано лише `src/`: **нові npm-залежності потребують перезбірки образу** (`docker compose build frontend`), а не рестарту.

## Структура `src/`

```
App.jsx            # маршрути; AppShell (Navbar + скрол-контейнер #app-scroll + BottomNav)
main.jsx
api/               # по модулю на сервіс (див. нижче)
context/           # AuthContext, ThemeContext, DiceContext
hooks/             # useCampaignEvents (SSE), useCharacterConfig, useEventTypes, useMagicForms, useSpellKinds, useWeaponOptions, useEntryForms, useViewMode, …
pages/             # сторінки-маршрути (по одній на екран)
components/        # спільні компоненти; підтеки campaign/, character/, chronology/, compendium/, entity/, map/, npcs/, tools/, catalog/, admin/, ui/
constants/         # довідники та мапування (abilities, spellbook, equipment, characterSheet, maps, navigation, dice, duration, forms, statBlocks, …)
utils/             # чиста логіка: *ImportTemplate.js, chronology*.js, deck*.js, richText.js, money.js, spellAccess.js, skillTreeLayout.js, …
styles/global.css  # Tailwind + токени теми
collectionsDomains.js  # реєстр доменів колекцій (spellbook/equipment/abilities/bestiary/npcs)
```

### API-шар (`src/api/`)

`client.js` — спільний axios-інстанс: access-токен лише **в памʼяті** (не в `localStorage`), заголовок `Authorization: Bearer`, `withCredentials` для httpOnly refresh-cookie; на `401` робить один спільний silent-refresh (`POST /api/auth/refresh`) і повторює запит, при невдачі веде на `/login`. Решта модулів — тонкі обгортки над сервісами:

| Модуль | Сервіс / префікс |
|---|---|
| `abilities.js` | [abilities](abilities.md) `/api/abilities` |
| `admin.js` | [admin](admin.md) `/api/admin` |
| `bestiary.js` | [bestiary](bestiary.md) `/api/bestiary` |
| `campaigns.js` | [campaigns](campaigns.md) `/api/campaigns` |
| `characterSheet.js` | [character-sheet](character-sheet.md) `/api/characters` |
| `chronology.js` | [chronology](chronology.md) `/api/chronology` |
| `collections.js` | фабрика `createCollectionsApi(base)` — колекції кожного домену на його власному `/collections` |
| `compendium.js` | [compendium](compendium.md) `/api/compendium` |
| `dice.js` | [dice-roller](dice-roller.md) `/api/dice` |
| `equipment.js` | [equipment](equipment.md) `/api/equipment` |
| `maps.js` | [maps](maps.md) `/api/maps` |
| `media.js` | [media](media.md) `/api/media` — `upload`, `uploadWithThumbnail` (повертає `image_url` + `thumbnail_url`) |
| `npcs.js` | [npcs](npcs.md) `/api/npcs` |
| `profile.js` | [user-profile](user-profile.md) `/api/profile` |
| `skillTree.js` | [skill-tree](skill-tree.md) `/api/skill-tree` |
| `spellbook.js`, `traditions.js` | [spellbook](spellbook.md) `/api/spellbook` (заклинання / традиції) |
| `tools.js` | [tools](tools.md) `/api/tools` |
| `statBlockLoadout.js` | спільне спорядження/заклинання/вміння для НІПів та істот |

Автентифікація (`/api/auth`) викликається з `AuthContext` ([auth](auth.md)): при завантаженні — silent refresh, потім `GET /api/auth/me`.

### Контексти

- `AuthContext` — `user`, `loading`, `login`, `register`, `logout`, `updateAccount`, `changePassword`; відновлення сесії при старті.
- `ThemeContext` — світла/темна тема (`data-theme` на `<html>`, виставляється inline-скриптом у `index.html` до рендеру, щоб не блимало) і власний акцентний колір (лише для темної теми); зберігається в `localStorage` (`walp:theme`, `walp:accent`).
- `DiceContext` — глобальний стан кидків ([dice-roller](dice-roller.md)): плаваюче вікно, останній результат, до 10 останніх кидків, а також `requestRoll(config)` — відкриває вікно кидка перевірки (`components/RollDialog.jsx`, змонтоване глобально в `AppShell`). Кидки навичок ідуть через нього, тож зберігаються в історії dice-roller як звичайні.

## Маршрути

Захищені `PrivateRoute` (потрібна сесія); `AdminRoute` — лише роль `admin`; публічні — логін/реєстрація та перегляд за посиланням (`…/public/:id`).

| Розділ | Маршрути (скорочено) | Сторінки |
|---|---|---|
| Загальне | `/`, `/login`, `/register`, `/profile`, `/profile/:username` | `Dashboard`, `Login`, `Register`, `Profile`, `PublicProfile` |
| Персонажі | `/characters`, `/characters/new`, `/characters/:id`, `/characters/public/:id` | `CharacterList`, `CharacterNew`, `CharacterSheet` |
| Дерево розвитку | `/skill-tree` | `SkillTree` |
| Заклинання | `/spellbook[/new\|/:id\|/:id/edit]`, `/spellbook/traditions[…]`, `/spellbook/collections[…]` | `Spellbook`, `SpellForm`, `SpellView`, `Tradition*` |
| Вміння | `/abilities[/new\|/:id\|/:id/edit]`, `/abilities/collections[…]` | `AbilityCatalog`, `AbilityForm`, `AbilityView` |
| Спорядження | `/equipment/{weapon,armor,items,artifacts}`, `/equipment/new`, `/equipment/:id[/edit]`, `/equipment/collections[…]`, `/equipment/artifacts/print` | `EquipmentCatalog`, `EquipmentForm`, `EquipmentView`, `Artifact*` |
| Кампанії | `/campaigns`, `/campaigns/new`, `/campaigns/:id` | `CampaignList`, `CampaignNew`, `CampaignDetail` (вкладки Ширма [лише ГМ], Стіл, Бойова сцена, Налаштування; сесії — `SessionsPanel`), `CampaignCombat` |
| Мапи | `/maps`, `/maps/:id`, `/maps/locations`, `/locations/:id` | `MapList`, `MapView`, `LocationLibrary`, `LocationDetail` |
| Хронологія | `/chronology`, `/chronology/:id`, `/chronology/:id/build`, `/chronology/events[…]`, `/chronology/:id/events/:eventId[/edit]` | `ChronologyList`, `ChronologyView`, `ChronologyBuilder`, `ChronologyEvent*` |
| Компендіум | `/compendium`, `/compendium/{species,subspecies,races,peoples}/…` | `Compendium*` (види/підвиди, раси/народи) |
| Бестіарій / НІПи | `/bestiary[…]`, `/npcs[…]`, `/npcs/factions[…]`, `/{bestiary,npcs}/collections[…]` | `StatBlockList/Form/View` (одні й ті самі для `kind="creature"` і `kind="npc"`), `Faction*` |
| Інструменти | `/tools`, `/tools/constellations[…]`, `/tools/decks[…]` (+ `/:id/play`) | `ToolsHome`, `Constellation*`, `Deck*` |
| Адмін | `/admin` | `AdminPanel` |

Старі шляхи `/compendium/entries/*`, `/compendium/factions/*`, `/compendium/collections/*`, `/compendium/bestiary`, `/compendium/taxonomy`, `/chronology/:id/events` лишились як редіректи (`Legacy*Redirect`) після виділення [npcs](npcs.md)/[bestiary](bestiary.md) з compendium. Колекції всіх доменів рендерять спільні `CollectionsList`/`CollectionForm`/`CollectionView` з пропом `domainKey`.

Навігація: `constants/navigation.js` — основні пункти (Персонажі, Заклинання, Вміння, Спорядження) і меню «Ще» (Дерево, Мапи, Компендіум, Бестіарій, НІПи, Кампанії, Хронологія, Інструменти); на мобільних — `BottomNav`.

## Наскрізні механізми

- **Rich-text.** Усі багаторядкові описи й нотатки зберігаються як HTML-рядки в звичайних `TEXT`-колонках. `SmartTextarea` (редактор) і `SmartTextReader` (читач) побудовані на TipTap; кубики (формули на кшталт `2d6`) — вузол `DiceRollNode` з кнопкою кидка (раніше це був текстовий тег `[[формула]]`); безпека — через схему ProseMirror (без `dangerouslySetInnerHTML`). Для прев'ю в картках — `htmlToPreviewText()` (`utils/richText.js`). Міграція 78 перетворила старий текст у HTML.
- **Внутрішні посилання на записи.** У rich-text можна вставити посилання на заклинання, спорядження, вміння, істот, НІПів, персонажів, події та мапи: вузол `EntityLinkNode` показується як чіп з hover-карткою, пошук — через «@» (`EntitySuggestPopup`) або пікер. Реєстр видів записів, шляхів і способів завантаження — `components/entity/entityRegistry.jsx`; новий вид додається там одним рядком. Старі `<a>` на такі шляхи автоматично перетворюються на чіпи; анонімні глядачі записи не підвантажують.
- **Зображення.** Завантаження — `ImageUploadField` → [media](media.md) (`image_url` + `thumbnail_url`); кадрування під картку — `ImageCropDialog` (`react-easy-crop`), результат зберігається як `image_crop` (`{x,y,zoom,ratio}`), відображення — `CroppedImage`.
- **Імпорт / експорт.** Для кожного каталогу є шаблон імпорту в `utils/*ImportTemplate.js` (JSON із коментарями-підказками, `jsonWithComments.js`) і кнопки `ExportImportActions` / `CollectionExportButton`; завантаження файлу — `downloadJson.js`.
- **Real-time кампанії.** `hooks/useCampaignEvents` читає SSE-потік `GET /api/campaigns/:id/events` через `fetch` (токен у заголовку, не в URL), перепідключається з експоненційною затримкою до 30 с і після кожного перепідключення викликає всі обробники. Подія несе лише тему — обробник перезапитує свій ресурс (див. [campaigns](campaigns.md)). Сторінки без власної кампанії (лист персонажа) підписуються через `components/campaign/CampaignEventsListener.jsx` — по компоненту на кожну кампанію з `campaign_ids`.
- **Кидок перевірки.** Біля кожної навички — **одна** кнопка-кубик, що відкриває `RollDialog`: перемикач «d20 + кубик / лише кубик», шість режимів (`constants/dice.js`), плоский `±`, перемикачі ситуативних модифікаторів вузлів і підпис, звідки взялася перевага чи перешкода. Модалка живе в модулі кубиків, а не в листі: лист лише передає готовий профіль. `utils/rollProfile.js` збирає з нього рядок формули (`buildRollFormula`), а `mergeRollModes` дублює правило 1.1.4 **тільки** для ситуативних модифікаторів, які гравець вмикає вже у відкритому вікні — про його вибір сервер не знає. Решту рахує [character-sheet](character-sheet.md) (`roll_profiles`).
- **Стани, таймер діяльності й відпочинок.** Правил на клієнті нема: лист, Ширма й трекер бою показують обчислений сервером блок `effects` і тексти `condition_levels` ([character-sheet](character-sheet.md), `src/rules/`). `components/character/ConditionsSection.jsx` — три стани (5 квадратів + «понад межу» до 9, редактор навичок Травми), зміни йдуть одразу `PUT` (сервер нормалізує) і `notifyCharacter`; `DeathScaleSlider.jsx` — повзунок −3…+3; `RestControls.jsx` — одна кнопка відпочинку зі спадним списком трьох форм і підказкою при наведенні (`GET /:id/rest/preview`), вибір стану (`choice_required`), модалка результату, блоки «Останній відпочинок» і «Таймер діяльності» (спільні для листа й Ширми); `components/campaign/ActivityTimerPanel.jsx` — кнопки `+1/+4/+8/+12 год` на Ширмі зі сповіщеннями про Втому. `PotionControls.jsx` — одна кнопка зілля на блоці здоровʼя: зілля персонажа, вибір кількості порцій, стан звикання й результат (кидки зцілення, звикання, перевірка Імунітету); вкладка каталогу «Зілля» (`/equipment/potions`) — `EquipmentCatalog`/`EquipmentForm`/`EquipmentView` з `hooks/usePotionOptions.js`. `utils/effectChips.js` — чипи ефектів. Трекер бою бере `GET /api/characters/effects` (бейджі, профілі кидків, зброя) і має «Завершити бій».
- **Бойова сцена.** `pages/CampaignCombat.jsx`: ініціатива кидається справжнім кубиком за рівнем Спритності (раніше була заглушка `1d6`), ухилення — лише кубиком-модифікатором (4.5.1), колонка «Дії» показує трекер із трьох кружечків (менше — якщо Втома забрала дії) і позначку залишеної реакції, яка вмикає автоухилення. Кнопка ⚔ відкриває `AttackSheet` (зброя → ціль → навичка, якщо зброя «універсальна»), кнопка черепа — рятівний кидок від смерті для непритомного персонажа. Під таблицею — журнал бою: так ціль бачить, чому втратила здоровʼя, не роблячи жодного кліку. `utils/combatantProfile.js` бере кубики або з `roll_profiles` листа, або зі стат-блоку НІПа (там 20 навичок виводяться з пʼяти атрибутів), або з `attack_die`/`damage_die` «ручного» НІПа.
- **Дерево розвитку.** `components/NodeModifiersPicker.jsx` — механічний бік ефекту вузла (ціль + режим + значення + «ситуативний» + нотатка); `NodeModifierList` із того ж файлу показує його і в редакторі (`pages/SkillTree.jsx`), і в панелі гравця (`components/DevelopmentTree.jsx`). Довідник цілей і режимів — `constants/nodeModifiers.js`, дзеркало `skill-tree/src/models/node-modifier.js`.
- **Довідники з адмінки.** Хуки `useSpellKinds`, `useMagicForms`, `useWeaponOptions`, `useEventTypes`, `useCharacterConfig` підтягують налаштовувані списки з відповідних сервісів ([admin](admin.md) → `site_configs`).
- **Доступ до заклинань.** `utils/spellAccess.js` повторює на клієнті правило доступності ([character-sheet](character-sheet.md)): традиції + найвища відкрита складність; сервер усе одно перевіряє.
- **Хронологія.** Сторінки й `utils/chronology*.js` (математика дат, ери, синхронізація календарів, розкладка таймлайна) — клієнтська логіка поверх сирих даних [chronology](chronology.md); дати в БД — безперервний відлік днів, ери лише переозначають відображення.
- **Колоди й сузір'я.** `utils/deck.js`, `utils/deckEngine.js` (перетасування/роздача), `utils/constellation.js`, `components/tools/*` — клієнтський рушій для [tools](tools.md); артефакти можна друкувати карткою (`ArtifactPrint`, `utils/artifactCardImage.js`).

## Змінні оточення та CORS

Фронтенд не читає змінних оточення на етапі виконання. Усі запити йдуть на відносні `/api/...`, які Nginx проксує до сервісів; у dev `allowedHosts` у `vite.config.mjs` містить прод-домен. Бекенди дозволяють origin з `FRONTEND_URL`.

## Тести

Автоматичних тестів нема. Перевірка зміни: `npm run build` (у CI — job `build-frontend`) і ручна перевірка в браузері.
