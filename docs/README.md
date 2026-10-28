# Документація Walp Tabletop

Усі технічні описи проєкту зібрано тут, щоб їх можна було читати окремо від коду. Стартова точка — [кореневий README](../README.md) (запуск, структура, Nginx-маршрути, БД); сюди винесено все, що стосується окремих сервісів.

## Як читати

1. [conventions.md](conventions.md) — патерни, спільні для багатьох сервісів (структура бекенду, автентифікація й ролі, міжсхемні посилання, міжсервісні HTTP-виклики, канонічність/імпорт/експорт, зображення, rich-text, форми, міграції, real-time). Прочитайте перед сервісними файлами.
2. Файл потрібного сервіса з [services/](services/) — ендпоінти з правами доступу, схема БД, міжсхемні читання, змінні оточення, тести.

Файли описують **поточний стан коду**; при зміні маршруту, поля чи міграції оновлюйте відповідний файл у тому ж коміті.

## Сервіси

| Сервіс | Порт | Nginx | Призначення |
|---|---|---|---|
| [auth](services/auth.md) | 3001 | `/api/auth/` | реєстрація, логін, JWT, ролі |
| [user-profile](services/user-profile.md) | 3002 | `/api/profile/` | профіль, публічна активність користувача |
| [spellbook](services/spellbook.md) | 3003 | `/api/spellbook/` | заклинання (з формами), традиції, колекції |
| [skill-tree](services/skill-tree.md) | 3004 | `/api/skill-tree/` | дерево розвитку: вузли, звʼязки, видачі |
| [character-sheet](services/character-sheet.md) | 3005 | `/api/characters/` | лист персонажа, раса/підвид, прогрес; правила станів, таймер діяльності, відпочинок |
| [dice-roller](services/dice-roller.md) | 3006 | `/api/dice/` | кидки кубиків за формулою |
| [equipment](services/equipment.md) | 3007 | `/api/equipment/` | зброя, обладунки, предмети, артефакти, зілля, колекції |
| [abilities](services/abilities.md) | 3009 | `/api/abilities/` | вміння та маневри, колекції |
| [campaigns](services/campaigns.md) | 3010 | `/api/campaigns/` | кампанії: Стіл/Ширма, сесії, бій, SSE, таймер діяльності (через character-sheet) |
| [admin](services/admin.md) | 3011 | `/api/admin/` | конфіги сайту, ролі користувачів, бекап БД |
| [media](services/media.md) | 3012 | `/api/media/`, `/uploads/` | завантаження зображень |
| [maps](services/maps.md) | 3013 | `/api/maps/` | мапи, шари, мітки, локації |
| [compendium](services/compendium.md) | 3014 | `/api/compendium/` | види/підвиди, раси/народи |
| [chronology](services/chronology.md) | 3015 | `/api/chronology/` | фентезійні календарі, ери, події |
| [bestiary](services/bestiary.md) | 3016 | `/api/bestiary/` | істоти |
| [npcs](services/npcs.md) | 3017 | `/api/npcs/` | НІПи, фракції, звʼязки |
| [tools](services/tools.md) | 3018 | `/api/tools/` | сузір'я, колоди карт |
| [frontend](services/frontend.md) | 5173 | `/` | React SPA |

## Інше

- [pdf-export-plan.md](pdf-export-plan.md) — план (ще не реалізований) експорту листа персонажа в PDF.
- Опис ресурсів, привʼязаних до теки (логотип і брендинг, зображення рас/архетипів/кубиків/іконок бою), лишився поруч із файлами: `services/frontend/branding/README.md`, `services/frontend/src/assets/*/README.md`.
