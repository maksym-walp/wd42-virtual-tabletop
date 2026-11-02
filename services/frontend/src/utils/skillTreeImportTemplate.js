import { CHARACTERISTICS, ARCHETYPES } from '../constants/characterSheet';
import { COMBAT_TARGETS, MODIFIER_MODES } from '../constants/nodeModifiers';
import { SPELL_COMPLEXITIES } from '../constants/spellbook';

// Шаблон для POST /api/skill-tree/import (повна заміна архетипу) і
// POST /api/skill-tree/import-nodes (додає підмножину вузлів) — з
// коментарями (JSONC), той самий прийом, що й у abilitiesImportTemplate.js.
// Формат тотожний відповіді GET /export: { nodes: [...], edges: [...] }.
export function buildSkillTreeImportTemplate() {
  const archetypeList = Object.entries(ARCHETYPES).map(([k, v]) => `${k} (${v.label})`).join(', ');
  const skillList = CHARACTERISTICS.flatMap((c) => c.skills.map((s) => `${s.key} (${s.label})`)).join(', ');
  const combatTargetList = COMBAT_TARGETS.map((t) => `${t.key} (${t.label})`).join(', ');
  const modeList = MODIFIER_MODES.map((m) => `${m.key} (${m.label})`).join(', ');
  const complexityList = Object.entries(SPELL_COMPLEXITIES).map(([k, v]) => `${k} (${v.label})`).join(', ');

  return `// Шаблон дерева розвитку для POST /api/skill-tree/import (повна заміна
// вказаного архетипу — старі вузли, звʼязки й прогрес персонажів по них
// видаляються назавжди) або POST /api/skill-tree/import-nodes (додає ці
// вузли окремою гілкою, нічого не видаляючи). Архетип, у який імпортується
// дерево, визначає активна вкладка редактора — поле "archetype" в самому
// файлі нижче лише для читабельності.
//
// "id" вузлів:
//   POST /import        — "id" стає реальним id рядка в базі; має бути
//                          унікальним у межах файлу.
//   POST /import-nodes   — "id" лише локальний ключ усередині файлу: кожен
//                          вузол отримує НОВИЙ id в базі. Потрібен тут лише
//                          щоб "edges" могли посилатись один на одного в
//                          межах цього самого документа.
//
// Поле вузла "archetype": при POST /import має збігатися з archetype усього
// документа (інакше 400); при POST /import-nodes ігнорується — вузол завжди
// йде в активну вкладку, лишень "archetypes" (масив, нижче) враховується.
//
// Поля вузла (nodes[]):
//   id                  — рядок, унікальний у межах файлу (див. вище)
//   title               — обов'язкове, рядок
//   description         — HTML-рядок або null
//   icon                — emoji ("🛡") чи URL іконки, або null
//   cost                — число (пункти досвіду; 0 = безкоштовно)
//   pos_x, pos_y        — координати вузла на полотні
//   narrative_condition — масив рядків: нарративні умови відкриття
//   effect              — масив рядків: вільний текст ефекту для гравця
//                          (механіку, яку рахує система сама, описує "modifiers" нижче)
//   archetype           — одне з: ${archetypeList} — вкладка вузла (див. примітку вище)
//   archetypes          — масив тих самих ключів: інші вкладки, де вузол теж
//                          видимий (спільні/расові вузли); [] — лише своя вкладка
//   require_both        — true/false: відкриття потребує і пунктів, і нарративної
//                          умови (інакше гравець обирає шлях сам: пункти або нарратив)
//   is_root             — true/false
//   unlocks_complexity  — одне з: ${complexityList}, або null — найвища складність
//                          форми заклинання, яку вузол відкриває (драбина: відкриває й усі нижчі).
//                          Традиції вузли не відкривають — гравець позначає їх сам у меню чарів.
//   cast_skill_options  — масив { id, tradition_id, skill_key, note }: для заклинань
//                          указаної традиції дозволяє кастувати навичкою skill_key
//                          замість Чарування, а не лише нею
//                            id           — рядок, стабільний ключ picker'а (можна "")
//                            tradition_id — uuid традиції (сервіс spellbook, GET /api/spellbook/traditions)
//                            skill_key    — одне з: ${skillList}
//                            note         — рядок до 200 символів (напр. "проти звірів"), або ""
//   modifiers           — масив механічних модифікаторів кидків (міграція 112):
//                          { id, target, mode, value, situational, note }
//                            id          — рядок, стабільний ключ picker'а (можна "")
//                            target      — навичка: ${skillList};
//                                          або бойова ціль: ${combatTargetList}
//                            mode        — одне з: ${modeList}
//                                          ("damage_dice" дозволяє лише "bonus")
//                            value       — bonus: ціле ±N (затискається в ±20); rank_up/rank_down:
//                                          скільки рангів кубика; для режимів без значення — 0
//                            situational — false: діє завжди сама; true: лише пропонується
//                                          перемикачем у вікні кидка, коли умова з "note" виконана
//                            note        — рядок до 200 символів, або ""
//   grants              — масив прив'язок до каталогу вмінь:
//                          { item_kind, item_id, mode, form_key }
//                            item_kind — "ability" | "ability_collection"
//                            item_id   — uuid запису (сервіс abilities, каталог або колекція)
//                            mode      — "grant" (відкриття вузла додає запис у лист персонажа) |
//                                        "unlock" (лише робить доступним для ручного додавання)
//                            form_key  — лише для "ability": null (усі форми) | "main" |
//                                        "primitive" | "perfected" (для "ability_collection" — завжди null)
//
// Поля звʼязку (edges[]):
//   source_id, target_id — "id" двох РІЗНИХ вузлів із цього самого документа
//   edge_type             — "required" (потрібен, щоб відкрити ціль) | "optional"
//                            (досить хоч одного з усіх вхідних "optional")
//
{
  "archetype": "fighter",
  "nodes": [
    {
      "id": "n1",
      "title": "Приклад: Стійка ветерана",
      "description": "Загартований у боях — менше вразливий до втоми від тривалої діяльності.",
      "icon": "🛡",
      "cost": 2,
      "pos_x": 0,
      "pos_y": 0,
      "narrative_condition": [],
      "effect": ["+1 до кидка Витривалості проти таймера діяльності"],
      "archetype": "fighter",
      "archetypes": [],
      "require_both": false,
      "is_root": true,
      "unlocks_complexity": null,
      "cast_skill_options": [],
      "modifiers": [
        { "id": "", "target": "endurance_timer", "mode": "bonus", "value": 1, "situational": false, "note": "" }
      ],
      "grants": []
    },
    {
      "id": "n2",
      "title": "Приклад: Другий подих",
      "description": "Героїчна дія відновлює більше здоров'я.",
      "icon": null,
      "cost": 3,
      "pos_x": 120,
      "pos_y": 0,
      "narrative_condition": [],
      "effect": [],
      "archetype": "fighter",
      "archetypes": [],
      "require_both": false,
      "is_root": false,
      "unlocks_complexity": null,
      "cast_skill_options": [],
      "modifiers": [],
      "grants": [
        { "item_kind": "ability", "item_id": "00000000-0000-0000-0000-000000000000", "mode": "unlock", "form_key": null }
      ]
    }
  ],
  "edges": [
    { "source_id": "n1", "target_id": "n2", "edge_type": "required" }
  ]
}
`;
}
