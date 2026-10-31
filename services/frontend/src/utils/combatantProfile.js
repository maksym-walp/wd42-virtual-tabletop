import npcsApi from '../api/npcs';
import bestiaryApi from '../api/bestiary';

// Звідки трекер бою бере кубики для автоматичних кидків.
//
// Персонаж гравця — з roll_profiles листа (GET /api/characters/effects):
// там уже враховано стани й модифікатори відкритих вузлів дерева.
// НІП чи істота — зі свого стат-блоку: 20 навичок виводяться з пʼяти
// атрибутів (npcs/src/dto/stat-block.dto.js, decorateStatBlock), тож кубик
// ухилення чи влучання в них теж є. «Ручний» НІП, якого ГМ набив числами,
// власних навичок не має — для нього лишаються кубики з рядка комбатанта
// (attack_die / damage_die) або голий d20.

const npcCache = new Map();

// Стат-блок за голим id: він може лежати і в npcs, і в bestiary — id не
// перетинаються (міграція 86), тож пробуємо обидва й запамʼятовуємо, який
// із двох сервісів відповів: спорядження доведеться питати в нього ж.
export async function loadStatBlock(entryId) {
  if (!entryId) return null;
  if (npcCache.has(entryId)) return npcCache.get(entryId);

  let found = null;
  const asNpc = await npcsApi.get(entryId).catch(() => null);
  if (asNpc) found = { entry: asNpc, api: npcsApi };
  else {
    const asCreature = await bestiaryApi.get(entryId).catch(() => null);
    if (asCreature) found = { entry: asCreature, api: bestiaryApi };
  }
  npcCache.set(entryId, found);
  return found;
}

const statBlockDie = (entry, skillKey) =>
  entry?.skills?.find((s) => s.key === skillKey)?.dice ?? null;

// Профіль у тому ж форматі, що й roll_profiles листа, щоб модалка кидка та
// формули не знали, персонаж це чи НІП.
const plainProfile = (die, { d20 = true, sources = [] } = {}) => ({
  die, mode: 'normal', bonus: 0, d20, disabled: false, sources, situational: [],
});

// target — ключ навички або бойова ціль ('initiative', 'attack', …).
export async function combatantProfile(combatant, sheet, target) {
  if (combatant?.character_id && sheet?.roll_profiles?.[target]) {
    return sheet.roll_profiles[target];
  }
  if (combatant?.compendium_entry_id) {
    const found = await loadStatBlock(combatant.compendium_entry_id);
    // Ініціатива НІПа — кубик за його Спритністю, як і в персонажа; сам
    // кубик ініціативи кидається без d20 (4.1).
    const key = target === 'initiative' ? 'evasion' : target;
    const die = statBlockDie(found?.entry, key);
    if (die) {
      return plainProfile(die, {
        d20: target !== 'initiative',
        sources: [found?.entry?.name].filter(Boolean),
      });
    }
  }
  // Ручний НІП: лише те, що ГМ вписав у рядок.
  if (target === 'attack' && combatant?.attack_die) return plainProfile(combatant.attack_die);
  if (target === 'initiative') return plainProfile(null, { d20: true });
  return plainProfile(null);
}

// Зброя, доступна комбатантові у виборі атаки.
export async function combatantWeapons(combatant, sheet) {
  if (combatant?.character_id) return sheet?.weapons ?? [];
  if (combatant?.compendium_entry_id) {
    const found = await loadStatBlock(combatant.compendium_entry_id);
    if (!found) return [];
    const list = await found.api.listEquipment(combatant.compendium_entry_id).catch(() => []);
    return (list ?? [])
      .filter((e) => e.item?.type === 'weapon' || e.type === 'weapon')
      .map((e) => ({
        equipment_id: e.equipment_id ?? e.id,
        name: e.item?.name ?? e.name,
        damage_die: e.item?.damage_die ?? e.damage_die,
        modifier: e.item?.modifier ?? e.modifier ?? null,
        mastered: true, // НІПи освоєністю не переймаються
      }));
  }
  return [];
}
