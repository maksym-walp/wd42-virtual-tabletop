import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Copy, Check, Upload, ImagePlus, Trash2, Shield, Crop, Minus, Plus } from 'lucide-react';
import characterApi from '../api/characterSheet';
import campaignApi from '../api/campaigns';
import mediaApi, { MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES } from '../api/media';
import spellbookApi from '../api/spellbook';
import equipmentApi from '../api/equipment';
import abilitiesApi from '../api/abilities';
import traditionsApi from '../api/traditions';
import { createCollectionsApi } from '../api/collections';
import { recordView } from '../utils/recentlyViewed';
import { spellAccessFor, missingAccessLabel } from '../utils/spellAccess';
import useMagicForms from '../hooks/useMagicForms';
import Tooltip from '../components/ui/Tooltip';
import { RITUAL_TYPES, formatDuration, primaryNature, natureLabels, FORM_TIERS, spellTiers, spellVariantForms, spellForCharacter } from '../constants/spellbook';
import { CATALOG_TYPES } from '../constants/artifacts';
import { abilityTiers, abilityVariantForms, abilityForCharacter } from '../constants/abilities';
import {
  ARCHETYPES, CHARACTERISTICS,
  DAMAGE_DICE, PHYSIQUE_HEALTH, ARCHETYPE_COLORS as ARCHETYPE_COLORS_LIGHT, ARCHETYPE_COLORS_DARK,
  valueToLevel, skillsToCharLevel, SKILL_PROGRESS_MARKS,
} from '../constants/characterSheet';
import { useTheme } from '../context/ThemeContext';
import DevelopmentTree from '../components/DevelopmentTree';
import GmSkillEditor from '../components/GmSkillEditor';
import Sheet from '../components/ui/Sheet';
import Lightbox from '../components/ui/Lightbox';
import CroppedImage from '../components/ui/CroppedImage';
import ImageCropDialog from '../components/ui/ImageCropDialog';
import Button from '../components/ui/Button';
import Field, { inputClass } from '../components/ui/Field';
import SmartTextReader from '../components/SmartTextReader';
import { htmlToPreviewText } from '../utils/richText';
import { raceLabel } from '../utils/characterRace';
import RollButton from '../components/RollButton';
import ScopeFilter, { matchesScope } from '../components/ScopeFilter';
import CanonBadge from '../components/CanonBadge';
import { useDice } from '../context/DiceContext';
import ShareButton from '../components/ShareButton';
import MoneySection from '../components/character/MoneySection';
import NarrativeTab from '../components/character/NarrativeTab';
import CharacterSidebar from '../components/character/CharacterSidebar';
import useCharacterConfig from '../hooks/useCharacterConfig';
import useMediaQuery from '../hooks/useMediaQuery';
import { useAuth } from '../context/AuthContext';
import ConditionsSection from '../components/character/ConditionsSection';
import DeathScaleSlider from '../components/character/DeathScaleSlider';
import RestControls, { RestResultModal, LastRestBlock, ActivityTimer } from '../components/character/RestControls';
import PotionControls, { availablePortions, potionStockLabel } from '../components/character/PotionControls';
import usePotionOptions, { potionSummary, portionsWord } from '../hooks/usePotionOptions';
import CampaignEventsListener from '../components/campaign/CampaignEventsListener';
import { fallbackProfile, ROLL_MODE_LABELS } from '../utils/rollProfile';
import { Dices } from 'lucide-react';

// ── debounce ─────────────────────────────────────────────────────────────────

function useDebounce(fn, delay = 800) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

function prereqMet(item, unlockedNodeIds) {
  const ids = item.prerequisite_node_ids || [];
  if (!ids.length) return true;
  return item.prerequisite_logic === 'and'
    ? ids.every((id) => unlockedNodeIds.has(id))
    : ids.some((id) => unlockedNodeIds.has(id));
}

function missingPrereqLabel(item) {
  const nodes = item.prerequisite_nodes || [];
  if (!nodes.length) return '';
  const joiner = item.prerequisite_logic === 'and' ? ' і ' : ' або ';
  return `Потрібно: ${nodes.map((n) => n.title).join(joiner)}`;
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function CharacterSheet({ publicView = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { conditions: conditionsConfig, currencies, races, condition_levels: conditionLevels } = useCharacterConfig();
  const { user } = useAuth();
  // На xl+ праворуч стоїть колонка з нотатками й вбудованими кубиками.
  const wide = useMediaQuery('(min-width: 1280px)');
  const ARCHETYPE_COLORS = theme === 'dark' ? ARCHETYPE_COLORS_DARK : ARCHETYPE_COLORS_LIGHT;

  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [tab, setTab]           = useState('skills');
  const [saving, setSaving]     = useState(false);
  const [allSpells, setAllSpells] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);
  const [allAbilities, setAllAbilities] = useState([]);
  const [allAbilityCollections, setAllAbilityCollections] = useState([]);
  const [allTraditions, setAllTraditions] = useState([]);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName]     = useState('');
  const [editingDefense, setEditingDefense]         = useState(false);
  const [defenseBonusDraft, setDefenseBonusDraft]   = useState(0);
  const [editingInspiration, setEditingInspiration] = useState(false);
  const [editingAllSkills, setEditingAllSkills] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  // Результат відпочинку, який натиснула інша сторона (ГМ чи власник) —
  // приходить real-time подією; lastRestSeen — щоб не показувати його двічі.
  const [incomingRest, setIncomingRest] = useState(null);
  const lastRestSeen = useRef(null);

  const handleCopyId = (characterId) => {
    navigator.clipboard.writeText(characterId).then(() => {
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 1500);
    });
  };

  useEffect(() => {
    const fetchSheet = publicView
      ? characterApi.getPublicSheet(id)
      : characterApi.getSheet(id);
    const noop = Promise.resolve([]);
    const abilityCollectionsApi = createCollectionsApi('/api/abilities/collections/');
    Promise.all([
      fetchSheet,
      publicView ? noop : (spellbookApi?.getAll?.() ?? noop),
      publicView ? noop : (equipmentApi?.getAll?.() ?? noop),
      publicView ? noop : (abilitiesApi?.getAll?.() ?? noop),
      publicView ? noop : abilityCollectionsApi.getAll().catch(() => []),
      publicView ? noop : traditionsApi.getAll().catch(() => []),
    ])
      .then(([sheet, spells, equipmentCatalog, abilityCatalog, abilityCollections, traditions]) => {
        setData(sheet);
        lastRestSeen.current = sheet.character.last_rest?.at ?? null;
        recordView({
          type: 'character', id, name: sheet.character.name,
          href: `/characters/${id}`, image_url: sheet.character.image_url,
        });
        setAllSpells(Array.isArray(spells) ? spells : []);
        // Спорядження й артефакти — вже один каталог (equipment.artifacts —
        // четвертий вид поруч зі зброєю/обладунком/предметами), тож єдиний
        // equipmentApi.getAll() накриває все, без окремого мержу.
        setAllEquipment(Array.isArray(equipmentCatalog) ? equipmentCatalog : []);
        setAllAbilities(Array.isArray(abilityCatalog) ? abilityCatalog : []);
        setAllAbilityCollections(Array.isArray(abilityCollections) ? abilityCollections : []);
        setAllTraditions(Array.isArray(traditions) ? traditions : []);
      })
      .catch(() => setError('Не вдалось завантажити лист персонажа'))
      .finally(() => setLoading(false));
  }, [id, publicView]);

  // Accumulate all pending field changes so rapid edits (HP then magic, etc.)
  // never lose earlier changes when the debounce timer resets.
  const pendingPatch = useRef({});

  // Двостороння синхронізація ХП: якщо патч зачіпає current_hp/temp_hp,
  // повідомляємо campaigns-сервіс — той сам знайде всіх комбатантів цього
  // персонажа (у будь-якому бою) і оновить їх, без очікування наступного
  // опитування трекера. Мовчки ігноруємо помилку — найчастіше персонаж
  // просто зараз ні в якому бою, і оновлювати нічого.
  const syncCombatHp = useCallback((patch) => {
    if (!('current_hp' in patch) && !('temp_hp' in patch)) return;
    campaignApi.syncCombatantHp(id, { health: patch.current_hp, temp_hp: patch.temp_hp }).catch(() => {});
  }, [id]);

  const saveVitalsFn = useCallback(async () => {
    const patch = { ...pendingPatch.current };
    pendingPatch.current = {};
    if (!Object.keys(patch).length) return;
    setSaving(true);
    try {
      await characterApi.update(id, patch);
      syncCombatHp(patch);
    }
    finally { setSaving(false); }
  }, [id, syncCombatHp]);

  const saveVitals = useDebounce(saveVitalsFn, 600);

  // Flush any unsaved changes when navigating away (component unmount)
  useEffect(() => {
    return () => {
      const patch = pendingPatch.current;
      if (Object.keys(patch).length) {
        characterApi.update(id, patch).catch(() => {});
        syncCombatHp(patch);
      }
    };
  }, [id, syncCombatHp]);

  const patchCharacter = (patch) => {
    setData(prev => ({ ...prev, character: { ...prev.character, ...patch } }));
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    saveVitals();
  };

  // Real-time подія 'characters' з кампаній персонажа: інша сторона змінила
  // стани, таймер чи відпочила — перечитуємо лист, не гублячи ще не збережені
  // правки (pendingPatch). Чужий новий відпочинок показуємо модалкою.
  const reloadSheet = useCallback(async () => {
    try {
      const fresh = await characterApi.getSheet(id);
      setData(prev => (prev ? { ...prev, ...fresh, character: { ...fresh.character, ...pendingPatch.current } } : prev));
      const rest = fresh.character.last_rest;
      if (rest?.at && rest.at !== lastRestSeen.current) {
        lastRestSeen.current = rest.at;
        if (rest.by?.user_id !== user?.id) setIncomingRest(rest);
      }
    } catch { /* наступна подія спробує ще раз */ }
  }, [id, user?.id]);

  // Стани нормалізує сервер (блок Втоми 5, падіння на 6-му рівні, Травма 5),
  // тож зберігаємо одразу, без дебаунсу, і беремо стан із відповіді.
  const changeConditions = async (conditions) => {
    try {
      const resp = await characterApi.updateConditions(id, { conditions });
      setData(prev => ({
        ...prev,
        character: { ...prev.character, ...resp.character, ...pendingPatch.current },
        effects: resp.effects,
        roll_profiles: resp.roll_profiles ?? prev.roll_profiles,
        ...(resp.skills ? { skills: resp.skills } : {}),
      }));
      campaignApi.notifyCharacter(id).catch(() => {});
    } catch (err) {
      window.alert(err.response?.data?.message || 'Не вдалося змінити стан');
    }
  };

  // Зілля: сервер уже записав ХП, стани й звикання; порожнє зілля зникає.
  const handleDrank = ({ character, item, effects, timer, potions, roll_profiles }, equipmentId) => {
    for (const key of ['current_hp', 'conditions', 'death_scale']) delete pendingPatch.current[key];
    setData(prev => ({
      ...prev,
      character: { ...prev.character, ...character },
      effects, timer, potions,
      roll_profiles: roll_profiles ?? prev.roll_profiles,
      equipment: item
        ? prev.equipment.map(e => (e.equipment_id === equipmentId ? { ...e, ...item } : e))
        : prev.equipment.filter(e => e.equipment_id !== equipmentId),
    }));
    campaignApi.syncCombatantHp(id, { health: character.current_hp, temp_hp: character.temp_hp })
      .catch(() => campaignApi.notifyCharacter(id).catch(() => {}));
  };

  // Відпочинок уже записав вітали на сервері — незбережені правки тих самих
  // полів застаріли. Синхронізація ХП з боєм заодно розсилає 'characters'.
  const handleRested = ({ result, character, effects, timer, potions, roll_profiles }) => {
    lastRestSeen.current = result.at;
    for (const key of ['current_hp', 'current_magic', 'heroic_actions_used', 'conditions', 'death_scale']) {
      delete pendingPatch.current[key];
    }
    setData(prev => ({
      ...prev, character: { ...prev.character, ...character }, effects, timer, potions,
      roll_profiles: roll_profiles ?? prev.roll_profiles,
    }));
    campaignApi.syncCombatantHp(id, { health: character.current_hp, temp_hp: character.temp_hp })
      .catch(() => campaignApi.notifyCharacter(id).catch(() => {}));
  };

  // Вибір/зняття підвиду: бонуси до навичок змінюються на бекенді дельтою,
  // тож підставляємо навички з відповіді.
  const changePeople = async (peopleId) => {
    setSaving(true);
    try {
      const { character, skills: freshSkills } = await characterApi.setPeople(id, peopleId || null);
      const chosen = races.find((r) => r.id === data.character.race_id)?.peoples.find((p) => p.id === peopleId);
      setData(prev => ({
        ...prev,
        character: {
          ...prev.character, ...character,
          people_name: chosen?.name ?? null, people_description: chosen?.description ?? null,
        },
        skills: freshSkills,
      }));
    } catch (err) {
      window.alert(err.response?.data?.message || 'Не вдалось змінити підвид');
    } finally {
      setSaving(false);
    }
  };

  const startEditName = () => {
    setDraftName(data.character.name);
    setEditingName(true);
  };
  const commitName = async () => {
    const trimmed = draftName.trim();
    setEditingName(false);
    if (!trimmed || trimmed === data.character.name) return;
    await characterApi.update(id, { name: trimmed });
    setData(prev => ({ ...prev, character: { ...prev.character, name: trimmed } }));
  };

  const openDefenseEditor = () => {
    setDefenseBonusDraft(data.character.defense_bonus ?? 0);
    setEditingDefense(true);
  };

  const patchSkill = async (skillKey, patch) => {
    const updated = await characterApi.patchSkill(id, skillKey, patch);
    setData(prev => ({
      ...prev,
      skills: prev.skills.map(s => s.skill_key === skillKey ? updated : s),
    }));
  };

  const unlockTreeNode = async (nodeId, via) => {
    const { progress, granted } = await characterApi.unlockNode(id, nodeId, via);
    if (progress) {
      setData(prev => (prev ? { ...prev, tree: [...(prev.tree || []), progress] } : prev));
    }
    // A "видавати автоматично" link added catalog entries, and a points
    // unlock decremented experience — pull a fresh sheet to stay consistent.
    const grantedAnything = granted && (granted.abilities?.length || granted.spells?.length);
    if (progress || grantedAnything) {
      try {
        const fresh = await characterApi.getSheet(id);
        setData(prev => (prev ? {
          ...prev,
          tree: fresh.tree,
          abilities: fresh.abilities,
          spells: fresh.spells,
          character: { ...prev.character, experience_points: fresh.character.experience_points },
        } : prev));
      } catch { /* keep optimistic state */ }
    }
  };

  const addSpell    = async (spellId, progress = {}) => {
    if (spells.length >= maxKnownSpells) return;
    const entry = await characterApi.addSpell(id, spellId, progress);
    if (entry) setData(prev => ({ ...prev, spells: [...prev.spells, entry] }));
  };
  const patchSpell  = async (spellId, patch) => {
    const updated = await characterApi.patchSpell(id, spellId, patch);
    setData(prev => ({ ...prev, spells: prev.spells.map(s => s.spell_id === spellId ? updated : s) }));
  };
  const removeSpell = async (spellId) => {
    await characterApi.removeSpell(id, spellId);
    setData(prev => ({ ...prev, spells: prev.spells.filter(s => s.spell_id !== spellId) }));
  };
  const addEquipment    = async (equipmentId) => {
    const item = await characterApi.addEquipment(id, equipmentId);
    if (item) setData(prev => ({ ...prev, equipment: [...prev.equipment, item] }));
  };
  const patchEquipment  = async (equipmentId, patch) => {
    const item = await characterApi.patchEquipment(id, equipmentId, patch);
    setData(prev => ({
      ...prev,
      equipment: prev.equipment.map(e => {
        if (e.equipment_id === equipmentId) return item;
        // Одягання нового обладунку знімає прапорець з усіх інших — бекенд це
        // вже зробив у БД, тут лише дзеркалимо локально, не чекаючи рефетчу.
        if (patch.is_equipped === true && e.item?.type === 'armor' && e.is_equipped) {
          return { ...e, is_equipped: false };
        }
        return e;
      }),
    }));
  };
  const removeEquipment = async (equipmentId) => {
    await characterApi.removeEquipment(id, equipmentId);
    setData(prev => ({ ...prev, equipment: prev.equipment.filter(e => e.equipment_id !== equipmentId) }));
  };
  const addAbility    = async (abilityId, progress = {}) => {
    const ability = await characterApi.addAbility(id, abilityId, progress);
    if (ability) setData(prev => ({ ...prev, abilities: [...prev.abilities, ability] }));
  };
  const patchAbility  = async (abilityId, patch) => {
    const updated = await characterApi.patchAbility(id, abilityId, patch);
    setData(prev => ({ ...prev, abilities: prev.abilities.map(a => a.ability_id === abilityId ? updated : a) }));
  };
  const removeAbility = async (abilityId) => {
    await characterApi.removeAbility(id, abilityId);
    setData(prev => ({ ...prev, abilities: prev.abilities.filter(a => a.ability_id !== abilityId) }));
  };
  const addRitual    = async (payload) => {
    const tracker = await characterApi.addRitual(id, payload);
    setData(prev => ({ ...prev, rituals: [...prev.rituals, tracker] }));
  };
  const updateRitual = async (trackerId, patch) => {
    const tracker = await characterApi.updateRitual(id, trackerId, patch);
    setData(prev => ({ ...prev, rituals: prev.rituals.map(r => r.id === trackerId ? tracker : r) }));
  };
  const removeRitual = async (trackerId) => {
    await characterApi.removeRitual(id, trackerId);
    setData(prev => ({ ...prev, rituals: prev.rituals.filter(r => r.id !== trackerId) }));
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (error)   return <div className="px-4 py-16 text-center text-danger">{error}</div>;
  if (!data)   return null;

  const { character: c, skills, spells, equipment, abilities, rituals, is_owner, is_gm, effects, timer } = data;
  // Профілі кидків: кубик, режим і бонус кожної перевірки з урахуванням
  // станів і модифікаторів відкритих вузлів (character-sheet/src/rules/modifiers.js).
  const rollProfiles = data.roll_profiles;
  const conditionLabels = Object.fromEntries(conditionsConfig.map((cond) => [cond.key, cond.label]));
  const archetype = ARCHETYPES[c.archetype];
  const unlockedNodeIds = new Set((data.tree || []).map(t => t.node_id));

  const skillMap = Object.fromEntries(skills.map(s => [s.skill_key, s]));

  // Free circle bump (critical success/failure, narrative growth): moves
  // one progress mark, costs nothing.
  const shiftSkillMark = (skillKey, delta) => {
    const s = skillMap[skillKey];
    if (!s) return;
    const current = s.progress_marks || 0;
    const next = Math.max(0, Math.min(SKILL_PROGRESS_MARKS, current + delta));
    if (next === current) return;
    patchSkill(skillKey, { progress_marks: next });
  };
  // Spends the character's game inspiration on one progress mark — or, with
  // every circle already marked, raises the skill itself by one.
  const improveWithInspiration = (skillKey) => {
    const s = skillMap[skillKey];
    if (!s || c.inspiration_used) return;
    const marks = s.progress_marks || 0;
    if (marks < SKILL_PROGRESS_MARKS) patchSkill(skillKey, { progress_marks: marks + 1 });
    else if (s.value < 12) patchSkill(skillKey, { value: s.value + 1, progress_marks: 0 });
    else return;
    patchCharacter({ inspiration_used: true });
  };
  // Single dispatcher behind each skill's edit menu.
  const handleSkillAction = (skillKey, action) => {
    if (action === 'crit_success') return shiftSkillMark(skillKey, 1);
    if (action === 'crit_failure') return shiftSkillMark(skillKey, -1);
    if (action === 'narrative')    return shiftSkillMark(skillKey, 1);
    if (action === 'inspiration')  return improveWithInspiration(skillKey);
  };

  const bulkPatchSkills = async (updates) => {
    const updated = await characterApi.bulkUpdateSkills(id, updates);
    setData(prev => ({
      ...prev,
      skills: prev.skills.map(s => updated.find(u => u.skill_key === s.skill_key) || s),
    }));
  };

  const charLevels = Object.fromEntries(
    CHARACTERISTICS.map(ch => [
      ch.key,
      skillsToCharLevel(ch.skills.map(s => skillMap[s.key]?.value ?? 1)),
    ])
  );

  const physiqueLevel  = charLevels.physique;
  const maxDiceCount   = PHYSIQUE_HEALTH[physiqueLevel] ?? 6;
  const totalCondLevel = (c.conditions || []).reduce((s, cond) => s + (cond.level || 0), 0);
  const healthDiceAll  = c.health_dice_values || [];
  const activeDice     = healthDiceAll.slice(0, Math.max(0, maxDiceCount - totalCondLevel));
  const maxHp          = activeDice.reduce((s, v) => s + v, 0);
  const magicSenseVal  = skillMap['magic_sense']?.value ?? 1;
  // Ефективний максимум (Хвороба ≥3 — половина) рахує character-sheet.
  const maxMagic       = effects?.max_magic_effective ?? magicSenseVal * archetype.magicMult;
  const mysticismVal   = skillMap['mysticism']?.value ?? 1;
  // Базовий ліміт чарів: Містицизм × половина множника архетипу.
  const baseKnownSpells = mysticismVal * (archetype.magicMult / 2);
  const maxKnownSpells = baseKnownSpells + (c.spell_bonus ?? 0);

  const INITIATIVE_DIE  = { 1:'d4',2:'d6',3:'d8',4:'d10',5:'d12',6:'d20' };
  const HEROIC_COUNT    = { 1:0,2:1,3:2,4:3,5:4,6:5 };
  const INSPIRATION_DIE = { 1:'—',2:'d4',3:'d6',4:'d8',5:'d10',6:'d12' };

  // Пасивний захист = захист ОДЯГНЕНОГО обладунку (лише один може бути
  // is_equipped) + ручний модифікатор. Раніше тут сумувався захист усього
  // обладунку в інвентарі — тепер має значення тільки одягнений предмет.
  const equippedArmorEntry = equipment.find(e => {
    const catalogItem = e.item || allEquipment.find(a => a.id === e.equipment_id);
    return catalogItem?.type === 'armor' && e.is_equipped;
  });
  const equippedArmorItem = equippedArmorEntry && (equippedArmorEntry.item || allEquipment.find(a => a.id === equippedArmorEntry.equipment_id));
  const equippedDefense = equippedArmorItem?.defense_value || 0;
  // Травма 3+ — пасивний захист удвічі менший (множник з effects, угору).
  const defenseFactor   = effects?.passive_defense_factor ?? 1;
  const totalDefense    = Math.ceil((equippedDefense + (c.defense_bonus ?? 0)) * defenseFactor);
  const heroicTotal    = HEROIC_COUNT[charLevels.wisdom];
  const heroicLeft     = heroicTotal - c.heroic_actions_used;
  const gameInspirationDie = INSPIRATION_DIE[charLevels.charisma];

  // Fighter has no archetype-specific tab of its own — its abilities
  // (including maneuver-capable ones, is_maneuver=true) show on the general
  // AbilitiesTab like every other archetype's. Ритуали чаклуна живуть у
  // «Магії та чарах», окремої вкладки не мають.
  const ARCHETYPE_TABS = {
    rogue:       { key: 'luck',      label: 'Вдача' },
  };
  const archetypeTab = ARCHETYPE_TABS[c.archetype];

  const TABS = [
    { key: 'skills',    label: 'Характеристики' },
    { key: 'magic',     label: 'Магія та чари' },
    ...(archetypeTab ? [archetypeTab] : []),
    { key: 'abilities', label: 'Вміння' },
    { key: 'equipment', label: 'Спорядження' },
    { key: 'tree',      label: 'Дерево розвитку' },
    { key: 'narrative', label: 'Наратив' },
  ];

  const tabButtons = TABS.map(t => (
    <button key={t.key}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
        tab === t.key ? 'border-gold/60 bg-gold/10 text-gold' : 'border-border text-text-dim'
      }`}
      onClick={() => setTab(t.key)}>
      {t.label}
    </button>
  ));

  return (
    <div className="mx-auto grid w-full max-w-[1920px] grid-cols-1 gap-6 px-4 py-5 pb-24 sm:px-6 md:pb-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:px-8 2xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="min-w-0">
      {/* ─── Header ─── */}
      {/* Фото ліворуч; праворуч імʼя/архетип і службовий блок, а під ними —
          перемикачі вкладок (з sm). */}
      <div className="mb-4 flex items-start gap-4">
        <CharacterPortrait character={c} isOwner={is_owner} onChange={patchCharacter} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
          {is_owner && editingName ? (
            <input
              autoFocus
              className="w-full max-w-[480px] border-0 border-b-2 border-gold bg-transparent px-0.5 font-display text-3xl font-bold text-text outline-none"
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }}
              maxLength={200}
            />
          ) : (
            <h1 className="flex flex-wrap items-center gap-2 font-display text-3xl text-accent">
              {c.name}
              {is_owner && (
                <button
                  className="rounded-md p-1.5 leading-none text-text-dim hover:bg-surface-hover hover:text-text"
                  onClick={startEditName} title="Змінити ім'я"
                >
                  <Pencil size={14} />
                </button>
              )}
              {/* Публічний персонаж — посилання на публічний лист (його відкриє будь-хто). */}
              <ShareButton url={c.is_public ? `${window.location.origin}/characters/public/${c.id}` : undefined} />
              {saving && <span className="font-sans text-xs font-normal text-text-dim">• Збереження...</span>}
            </h1>
          )}
          <p className="mt-1 text-sm text-text-dim">
            <span style={{ color: ARCHETYPE_COLORS[c.archetype]?.color }} className="font-semibold">
              {archetype.label}
            </span> · {raceLabel(c)}
            {(() => {
              const racePeoples = races.find((r) => r.id === c.race_id)?.peoples ?? [];
              if (!publicView && (is_owner || is_gm) && (racePeoples.length > 0 || c.people_id)) {
                return (
                  <>
                    {' · '}
                    <select
                      aria-label="Підвид"
                      title={c.people_description || 'Підвид'}
                      className="rounded-md border border-border bg-bg px-1.5 py-0.5 text-sm text-text-dim focus:border-accent focus:outline-none"
                      value={racePeoples.some((p) => p.id === c.people_id) ? c.people_id : ''}
                      onChange={(e) => changePeople(e.target.value)}
                    >
                      <option value="">Без підвиду</option>
                      {racePeoples.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </>
                );
              }
              return c.people_name ? <> · <span title={c.people_description || undefined}>{c.people_name}</span></> : null;
            })()}
          </p>
          </div>
        <div className="flex flex-col gap-2 text-xs text-text-dim sm:items-end">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
            {c.owner_username && (
              <span>Власник: <Link to={`/profile/${c.owner_username}`} className="text-accent hover:underline">{c.owner_username}</Link></span>
            )}
            {is_owner && (
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={c.is_public} className="h-5 w-5 accent-accent"
                  onChange={e => patchCharacter({ is_public: e.target.checked })} />
                <span className="text-sm text-text-dim">Публічний</span>
              </label>
            )}
            {c.is_public && (
              <a href={`/characters/public/${c.id}`} target="_blank" rel="noreferrer" className="text-sm text-accent">
                Поділитись ↗
              </a>
            )}
          </div>
          <button
            onClick={() => handleCopyId(c.id)}
            className="inline-flex max-w-full items-center gap-1.5 self-start rounded-md border border-border px-2 py-1 hover:bg-surface-hover hover:text-text sm:self-end"
            title="Скопіювати ID персонажа"
          >
            {idCopied ? <Check size={13} /> : <Copy size={13} />}
            <span className="truncate font-mono">{c.id}</span>
          </button>
        </div>
        </div>
        <div className="hidden border-b border-border pb-3 sm:block">
          <div className="flex flex-wrap gap-2">{tabButtons}</div>
        </div>
        </div>
      </div>

      {/* ─── Tabs (мобільний: липка смуга під шапкою; з sm — у шапці) ─── */}
      <div className="sticky top-0 z-20 mb-4 -mx-4 touch-pan-x overflow-x-auto overscroll-x-contain border-b border-border bg-bg px-4 py-2 sm:hidden">
        <div className="flex w-max gap-2">{tabButtons}</div>
      </div>

      <div>
        {tab === 'skills' && (
          <SkillsTab
            characteristics={CHARACTERISTICS}
            skillMap={skillMap}
            charLevels={charLevels}
            is_owner={is_owner}
            is_gm={is_gm}
            canUseInspiration={!c.inspiration_used}
            onAction={handleSkillAction}
            onEditAll={() => setEditingAllSkills(true)}
            initiativeDie={INITIATIVE_DIE[charLevels.agility]}
            initiativeModifier={effects?.initiative_modifier ?? 0}
            effects={effects}
            conditionLabels={conditionLabels}
            rollProfiles={rollProfiles}
            heroic={{ total: heroicTotal, left: heroicLeft, disabled: !!effects?.heroic_disabled }}
            onHeroicChange={(left) => patchCharacter({ heroic_actions_used: Math.max(0, Math.min(heroicTotal, heroicTotal - left)) })}
            extras={(
              <div className="flex flex-col gap-3">
                <BannerBox
                  label="НАТХНЕННЯ"
                  accent
                  sub={
                    <span className="inline-flex items-center gap-1">
                      {gameInspirationDie === '—' ? (
                        <span className={c.inspiration_used ? 'text-text-dim line-through' : ''}>—</span>
                      ) : (
                        <RollButton
                          formula={`1${gameInspirationDie}`}
                          disabled={c.inspiration_used}
                          title={`Кинути ${gameInspirationDie} (ігрове натхнення)`}
                          icon={false}
                          className="p-0 text-base font-bold disabled:line-through"
                        >
                          {gameInspirationDie}
                        </RollButton>
                      )}
                      {c.narrative_inspiration_die && <span className="text-text-dim">/</span>}
                      {c.narrative_inspiration_die && (
                        <RollButton
                          formula={`1${c.narrative_inspiration_die}`}
                          title={`Кинути ${c.narrative_inspiration_die} (наративне натхнення)`}
                          icon={false}
                          className="p-0 text-base font-bold"
                        >
                          {c.narrative_inspiration_die}
                        </RollButton>
                      )}
                    </span>
                  }
                  corner={is_owner && (
                    <button
                      type="button"
                      onClick={() => setEditingInspiration(true)}
                      title="Редагувати натхнення"
                      className="flex h-6 w-6 items-center justify-center rounded text-text-dim hover:bg-surface-hover hover:text-text"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                />
                <BannerBox
                  label="МАГІЧНА ЕНЕРГІЯ"
                  sub={(
                    <span className="inline-flex items-center gap-2">
                      {is_owner && (
                        <button type="button" aria-label="Менше магії"
                          className="flex h-7 w-7 items-center justify-center rounded border border-border bg-surface-hover text-sm text-text disabled:opacity-40"
                          disabled={c.current_magic <= 0}
                          onClick={() => patchCharacter({ current_magic: Math.max(0, c.current_magic - 1) })}>−</button>
                      )}
                      <span>{c.current_magic} / {maxMagic}</span>
                      {is_owner && (
                        <button type="button" aria-label="Більше магії"
                          className="flex h-7 w-7 items-center justify-center rounded border border-border bg-surface-hover text-sm text-text disabled:opacity-40"
                          disabled={c.current_magic >= maxMagic}
                          onClick={() => patchCharacter({ current_magic: Math.min(maxMagic, c.current_magic + 1) })}>+</button>
                      )}
                    </span>
                  )}
                  accent
                />
                <BannerBox
                  label="ПАСИВНИЙ ЗАХИСТ"
                  sub={defenseFactor < 1 ? <span title="Травма: пасивний захист удвічі менший" className="text-danger">{totalDefense}</span> : totalDefense}
                  onClick={is_owner ? openDefenseEditor : undefined}
                />
              </div>
            )}
            health={(
              <HealthCard
                c={c} maxHp={maxHp}
                maxDiceCount={maxDiceCount}
                totalCondLevel={totalCondLevel}
                conditionsConfig={conditionsConfig}
                conditionLevels={conditionLevels}
                conditionLabels={conditionLabels}
                effects={effects}
                timer={timer}
                is_owner={is_owner} archetype={archetype}
                patchCharacter={patchCharacter}
                onConditionsChange={changeConditions}
                onRested={handleRested}
                potions={equipment.filter((e) => e.item?.type === 'potion')}
                potionState={data.potions}
                onDrank={handleDrank}
              />
            )}
          />
        )}
        {tab === 'magic' && (
          <MagicTab
            c={c} maxMagic={maxMagic} archetype={archetype}
            maxKnownSpells={maxKnownSpells} baseKnownSpells={baseKnownSpells} mysticismVal={mysticismVal}
            spells={spells} allSpells={allSpells}
            is_owner={is_owner}
            patchCharacter={patchCharacter}
            onAddSpell={addSpell}
            onPatchSpell={patchSpell}
            onRemoveSpell={removeSpell}
            spellAccess={data.spell_access}
            isSpellMaster={!!data.is_spell_master}
            traditions={allTraditions}
          />
        )}
        {tab === 'magic' && c.archetype === 'spellcaster' && (
          <section className="mt-6">
            <div className="mb-3 border-b border-border pb-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-gold">Ритуали</span>
            </div>
            <RitualsTab
              trackers={rituals} is_owner={is_owner}
              onAdd={addRitual}
              onUpdate={updateRitual}
              onRemove={removeRitual}
            />
          </section>
        )}
        {tab === 'abilities' && (
          <AbilitiesTab
            abilities={abilities} allAbilities={allAbilities} archetype={c.archetype} is_owner={is_owner}
            onAdd={addAbility}
            onPatch={patchAbility}
            onRemove={removeAbility}
            unlockedNodeIds={unlockedNodeIds}
          />
        )}
        {tab === 'luck' && (
          <LuckTab c={c} is_owner={is_owner} patchCharacter={patchCharacter} />
        )}
        {tab === 'equipment' && (
          <EquipmentTab
            c={c} patchCharacter={patchCharacter} currencies={currencies}
            equipment={equipment} allEquipment={allEquipment} is_owner={is_owner}
            onAdd={addEquipment}
            onPatch={patchEquipment}
            onRemove={removeEquipment}
          />
        )}
        {tab === 'tree' && (
          <DevelopmentTree
            archetype={c.archetype}
            tree={data.tree || []}
            experiencePoints={c.experience_points || 0}
            is_owner={is_owner}
            onUnlock={unlockTreeNode}
            onExperienceChange={(v) => patchCharacter({ experience_points: v })}
            catalog={{
              abilities: allAbilities,
              abilityCollections: allAbilityCollections,
              traditions: allTraditions,
            }}
          />
        )}
        {tab === 'narrative' && (
          <NarrativeTab c={c} is_owner={is_owner} patchCharacter={patchCharacter} />
        )}
      </div>
      </div>

      {!publicView && (data.campaign_ids ?? []).map((campaignId) => (
        <CampaignEventsListener key={campaignId} campaignId={campaignId} handlers={{ characters: reloadSheet }} />
      ))}
      {incomingRest && (
        <RestResultModal result={incomingRest} characterName={c.name} labels={conditionLabels} onClose={() => setIncomingRest(null)} />
      )}

      {/* ─── Права колонка: нотатки + кубики (на вужчих екранах — під вкладкою) ─── */}
      <CharacterSidebar c={c} is_owner={is_owner} patchCharacter={patchCharacter} showDice={wide && !publicView} />

      {editingDefense && (
        <Sheet open onClose={() => setEditingDefense(false)} title="Пасивний захист">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-dim">
              {equippedArmorItem
                ? `Одягнено: ${equippedArmorItem.name} (захист ${equippedDefense})`
                : 'Обладунок не одягнено — захист від спорядження: 0.'}
              {' '}Разом із модифікатором нижче дає пасивний захист.
              {defenseFactor < 1 && ' Травма: результат удвічі менший (угору).'}
            </p>
            <Field label="Модифікатор">
              <input
                autoFocus
                type="number"
                className={inputClass}
                value={defenseBonusDraft}
                onChange={e => setDefenseBonusDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key !== 'Enter') return;
                  patchCharacter({ defense_bonus: parseInt(defenseBonusDraft, 10) || 0 });
                  setEditingDefense(false);
                }}
              />
            </Field>
            <p className="text-sm text-text-dim">
              Разом: {Math.ceil((equippedDefense + (parseInt(defenseBonusDraft, 10) || 0)) * defenseFactor)}
            </p>
            <Button onClick={() => {
              patchCharacter({ defense_bonus: parseInt(defenseBonusDraft, 10) || 0 });
              setEditingDefense(false);
            }}>Зберегти</Button>
          </div>
        </Sheet>
      )}

      {editingInspiration && (
        <Sheet open onClose={() => setEditingInspiration(false)} title="Натхнення">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <SectionTitle>Ігрове</SectionTitle>
              <p className="mb-3 text-2xl font-bold text-gold">{gameInspirationDie}</p>
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  checked={!!c.inspiration_used}
                  onChange={e => patchCharacter({ inspiration_used: e.target.checked })}
                />
                Використано цієї сесії
              </label>
            </div>
            <div>
              <SectionTitle>Наративне</SectionTitle>
              <p className="mb-3 text-xs text-text-dim">Кубик, який видав майстер за відігрування.</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  className={`rounded border px-2.5 py-1.5 text-sm ${!c.narrative_inspiration_die ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-dim'}`}
                  onClick={() => patchCharacter({ narrative_inspiration_die: null })}
                >Немає</button>
                {DAMAGE_DICE.map(die => (
                  <button
                    key={die}
                    className={`rounded border px-2.5 py-1.5 text-sm font-semibold ${c.narrative_inspiration_die === die ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-dim'}`}
                    onClick={() => patchCharacter({ narrative_inspiration_die: die })}
                  >{die}</button>
                ))}
              </div>
            </div>
          </div>
        </Sheet>
      )}

      {editingAllSkills && (
        <GmSkillEditor
          open
          onClose={() => setEditingAllSkills(false)}
          characteristics={CHARACTERISTICS}
          skillMap={skillMap}
          onSave={bulkPatchSkills}
        />
      )}
    </div>
  );
}

// ── CharacterPortrait ────────────────────────────────────────────────────────

// Зберігається через звичайний patchCharacter, тобто дебаунсом разом з
// рештою полів. Очищення шле image_url: null — це працює лише тому, що
// модель на бекенді використовує CASE WHEN, а не COALESCE.
function CharacterPortrait({ character, isOwner, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [zoomed, setZoomed] = useState(false);
  const [cropping, setCropping] = useState(false);

  const url = character.image_url;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('Файл завеликий — максимум 10 МБ');
      return;
    }

    setUploading(true);
    try {
      const uploaded = await mediaApi.upload(file, {
        entityType: 'character',
        entityId: character.id,
      });
      // Новий файл — новий кадр: старий рахувався під інші пропорції.
      onChange({ image_url: uploaded, image_crop: null });
      setCropping(true);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Не вдалось завантажити зображення');
    } finally {
      setUploading(false);
    }
  };

  // Чужий лист без портрета — не показуємо порожню рамку взагалі.
  if (!url && !isOwner) return null;

  const box = 'h-20 w-20 shrink-0 rounded-lg border border-border sm:h-24 sm:w-24';

  return (
    <div className="flex flex-col items-center gap-1">
      {url ? (
        <div className="group relative">
          <button type="button" onClick={() => setZoomed(true)} aria-label="Переглянути портрет">
            <div className={`${box} overflow-hidden`}>
              <CroppedImage src={url} crop={character.image_crop} />
            </div>
          </button>
          {isOwner && (
            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 rounded-b-lg bg-black/55 py-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                aria-label="Замінити портрет"
                className="rounded p-0.5 text-white hover:bg-white/20"
              >
                <Upload size={14} />
              </button>
              <button
                type="button"
                onClick={() => setCropping(true)}
                disabled={uploading}
                aria-label="Кадрувати портрет"
                className="rounded p-0.5 text-white hover:bg-white/20"
              >
                <Crop size={14} />
              </button>
              <button
                type="button"
                onClick={() => onChange({ image_url: null, image_crop: null })}
                disabled={uploading}
                aria-label="Видалити портрет"
                className="rounded p-0.5 text-white hover:bg-white/20"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label="Завантажити портрет"
          className={`${box} flex items-center justify-center border-2 border-dashed text-text-dim hover:bg-surface-hover hover:text-text`}
        >
          <ImagePlus size={20} />
        </button>
      )}

      {uploading && <span className="text-[10px] text-text-dim">Завантаження...</span>}
      {error && <span className="max-w-24 text-center text-[10px] text-danger">{error}</span>}

      {isOwner && (
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          className="hidden"
          onChange={handleFile}
        />
      )}

      {zoomed && url && <Lightbox images={[url]} onClose={() => setZoomed(false)} />}
      {cropping && url && (
        <ImageCropDialog
          src={url}
          crop={character.image_crop}
          aspect={1}
          onSave={(crop) => { onChange({ image_crop: crop }); setCropping(false); }}
          onClose={() => setCropping(false)}
        />
      )}
    </div>
  );
}

// ── BannerBox ─────────────────────────────────────────────────────────────────

// `corner` renders as a sibling of the (possibly clickable) Tag rather than
// nested inside it — Tag can itself be a <button> (e.g. inspiration opens an
// editor on click), and a roll button nested inside another button is
// invalid HTML that browsers mis-parse.
function BannerBox({ label, sub, accent, wide, onClick, corner }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <div className={`relative min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
      <Tag
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={`flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-md border-[1.5px] bg-surface px-1.5 py-2 text-center sm:px-3 ${
          accent ? 'border-gold/30' : 'border-border'
        } ${onClick ? 'cursor-pointer hover:bg-surface-hover' : ''}`}
      >
        <span className="text-[0.62rem] font-bold uppercase tracking-wide text-text-dim">{label}</span>
        <span className={`text-base font-bold ${accent ? 'text-gold' : 'text-text'}`}>{sub}</span>
      </Tag>
      {corner && <div className="absolute right-1 top-1 z-10 flex items-center gap-0.5">{corner}</div>}
    </div>
  );
}

// ── SkillsTab ─────────────────────────────────────────────────────────────────

function SkillsTab({
  characteristics, skillMap, charLevels, is_owner, is_gm, canUseInspiration, onAction, onEditAll,
  health, extras, initiativeDie, initiativeModifier = 0, effects, conditionLabels, rollProfiles,
  heroic, onHeroicChange,
}) {
  // Особливі значення в шапках характеристик: кубик ініціативи кидається
  // прямо звідси, героїчні дії Мудрості — лічильник «залишилось / макс».
  const renderEffect = (char, level) => {
    if (char.key === 'agility' && initiativeDie && initiativeDie !== '—') {
      return (
        <RollButton
          formula={`1${initiativeDie}${initiativeModifier ? initiativeModifier : ''}`}
          title={`Кинути ${initiativeDie} (ініціатива)${initiativeModifier ? ` ${initiativeModifier} від Втоми` : ''}`}
          icon={false}
          className="p-0 text-sm font-bold text-gold"
        >
          {initiativeDie}
        </RollButton>
      );
    }
    if (char.key === 'wisdom' && heroic) {
      return (
        <span className="inline-flex items-center gap-1">
          {is_owner && (
            <button type="button" aria-label="Використати героїчну дію"
              title={heroic.disabled ? 'Втома: героїчні дії недоступні' : undefined}
              className="flex h-5 w-5 items-center justify-center rounded border border-border text-xs text-text disabled:opacity-40"
              disabled={heroic.left <= 0 || heroic.disabled}
              onClick={() => onHeroicChange(heroic.left - 1)}>−</button>
          )}
          <span className={heroic.disabled ? 'text-text-dim line-through' : heroic.left > 0 ? 'text-gold' : ''}
            title={heroic.disabled ? 'Втома: героїчні дії недоступні' : undefined}>{heroic.left} / {heroic.total}</span>
          {is_owner && (
            <button type="button" aria-label="Повернути героїчну дію"
              className="flex h-5 w-5 items-center justify-center rounded border border-border text-xs text-text disabled:opacity-40"
              disabled={heroic.left >= heroic.total}
              onClick={() => onHeroicChange(heroic.left + 1)}>+</button>
          )}
        </span>
      );
    }
    return char.effect(level);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Вузька колонка здоровʼя ліворуч; праворуч характеристики 3×2, де
          шоста клітинка — натхнення, магічна енергія й пасивний захист. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[16rem_minmax(0,1fr)] 2xl:grid-cols-[17rem_minmax(0,1fr)]">
      <div className="min-w-0">{health}</div>
      <div className="grid grid-cols-1 content-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {characteristics.map(char => {
        const level  = charLevels[char.key];
        return (
          <div key={char.key} className="overflow-hidden rounded-lg border border-border bg-surface">
            {/* Section header strip */}
            <div className="flex items-start justify-between gap-2 border-b border-border bg-bg px-3 py-2">
              <div>
                <h3 className="m-0 text-[0.8rem] font-bold uppercase tracking-wide text-gold">{char.label}</h3>
                <LevelSquares level={level} />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-right text-[0.6rem] uppercase leading-tight tracking-wide text-text-dim">{char.effectLabel}</span>
                <span className="text-sm font-bold text-text-muted">{renderEffect(char, level)}</span>
              </div>
            </div>

            <div className="px-3 py-1.5">
              {char.skills.map(skill => {
                const s = skillMap[skill.key] || { value: 1, progress_marks: 0 };
                return (
                  <SkillRow
                    key={skill.key}
                    skillKey={skill.key}
                    rollProfiles={rollProfiles}
                    label={skill.label}
                    value={s.value}
                    progress={s.progress_marks}
                    is_owner={is_owner}
                    is_gm={is_gm}
                    canUseInspiration={canUseInspiration}
                    onAction={action => onAction(skill.key, action)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      {(extras || is_gm) && (
        <div className="flex min-w-0 flex-col gap-3">
          {extras}
          {is_gm && (
            <button
              className="rounded border border-border px-3 py-1.5 text-sm text-accent hover:bg-surface-hover"
              onClick={onEditAll}
            >
              Редагувати навички персонажа
            </button>
          )}
        </div>
      )}
      </div>
      </div>
    </div>
  );
}

function LevelSquares({ level }) {
  return (
    <div className="mt-1 flex gap-[3px]">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={`h-2.5 w-2.5 rounded-sm border-[1.5px] border-gold/30 ${i < level ? 'bg-gold' : 'bg-transparent'}`} />
      ))}
    </div>
  );
}

// The four actions offered by a skill's edit menu — see handleSkillAction
// in the parent CharacterSheet for what each one actually does.
const SKILL_ACTIONS = [
  { key: 'crit_success', label: 'Критичний успіх (+1)',      hint: 'нічого не витрачає' },
  { key: 'crit_failure', label: 'Критична невдача (−1)',     hint: 'нічого не витрачає' },
  { key: 'inspiration',  label: 'Покращити за ігрове натхнення' },
  { key: 'narrative',    label: 'Покращити наративно',       hint: 'нічого не витрачає' },
];

// Одна кнопка кидка: відкриває вікно, де гравець обирає, чи кидати разом
// з d20, яким режимом і з яким модифікатором. Сам профіль (кубик, режим,
// бонус, джерела, ситуативні модифікатори вузлів) рахує сервер —
// character-sheet/src/rules/modifiers.js.
function SkillRow({ skillKey, rollProfiles, label, value, progress, is_owner, is_gm, canUseInspiration = true, onAction }) {
  const { requestRoll } = useDice();
  // Публічний лист читають і неавторизовані: кидок їм недоступний (запит до
  // dice-roller потребує токена), тож кнопка стає звичайним написом — так
  // само, як це робила спільна RollButton.
  const { user } = useAuth();
  // Публічний лист і старі відповіді без roll_profiles — лише кубик навички.
  const profile = rollProfiles?.[skillKey] ?? fallbackProfile(value);
  const die = profile.die ?? '—';
  const isPlayerEditable = is_owner && !is_gm;
  const [menuOpen, setMenuOpen] = useState(false);
  // Коротко — чому кидок не звичайний: «перевага: Шосте чуття»,
  // «перешкода: Втома 2». Нівельовані фактори режим не змінюють, тож чипа
  // не буде: повний перелік джерел видно в самому вікні кидка.
  const modeChip = profile.mode && profile.mode !== 'normal'
    ? `${ROLL_MODE_LABELS[profile.mode] ?? profile.mode}${profile.sources?.length ? `: ${profile.sources.join('; ')}` : ''}`
    : null;
  const hasSituational = (profile.situational?.length ?? 0) > 0;

  const runAction = (action) => {
    setMenuOpen(false);
    onAction(action);
  };

  // A natural 1 or 20 on the d20 offers the same crit success/failure bump
  // the edit menu below exposes manually (for a physically-rolled die) —
  // one progress mark, nothing spent.
  const handleRollResult = (result) => {
    const d20 = result?.groups?.find(g => g.sides === 20);
    const nat = d20?.type === 'dice' ? d20.rolls?.[0] : d20?.dice?.[0]?.kept;
    if (nat !== 1 && nat !== 20) return;
    if (nat === 20 && progress >= SKILL_PROGRESS_MARKS) return;
    if (nat === 1 && progress <= 0) return;
    const verb = nat === 20 ? 'позначити' : 'стерти';
    if (window.confirm(`Природна ${nat} на кидку навички «${label}» — ${verb} одне коло?`)) {
      onAction(nat === 20 ? 'crit_success' : 'crit_failure');
    }
  };

  return (
    <div className="flex flex-col gap-0.5 border-b border-bg py-1">
      <div className="flex items-center justify-between gap-1">
        <span className="min-w-0 truncate text-sm font-semibold text-text-muted" title={label}>{label}</span>
        <div className="flex shrink-0 items-center gap-1">
          <span className="w-5 text-center text-base font-bold text-text">{value}</span>
          {isPlayerEditable && (
            <button
              className="rounded p-1 leading-none text-text-dim hover:bg-surface-hover hover:text-text"
              onClick={() => setMenuOpen(true)}
              title="Змінити навичку"
            >
              <Pencil size={11} />
            </button>
          )}
          {user ? (
            <button
              type="button"
              disabled={profile.disabled}
              title={profile.disabled ? profile.disabled_reason : `Кинути ${label}`}
              onClick={() => requestRoll({
                title: label,
                profile,
                onResult: isPlayerEditable ? handleRollResult : undefined,
              })}
              className={`inline-flex min-w-[46px] items-center justify-center gap-1 rounded border bg-bg px-1.5 py-0.5 text-xs font-semibold text-accent transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 ${
                modeChip ? 'border-danger/50' : 'border-border'
              }`}
            >
              <Dices size={11} />
              {die === '—' ? '—' : `+${die}`}
            </button>
          ) : (
            <span className="min-w-[46px] text-center text-xs font-semibold text-text-muted">
              {die === '—' ? '—' : `+${die}`}
            </span>
          )}
        </div>
      </div>
      {(modeChip || profile.disabled || hasSituational) && (
        <div className="flex flex-wrap gap-1 text-[0.65rem] font-semibold">
          {profile.disabled && <span className="rounded-full bg-danger/10 px-1.5 text-danger">недоступна (Травма)</span>}
          {!profile.disabled && modeChip && (
            <span className={`rounded-full px-1.5 ${profile.mode === 'adv' || profile.mode === 'wadv' ? 'bg-sage/15 text-sage' : 'bg-danger/10 text-danger'}`}>
              {modeChip}
            </span>
          )}
          {!profile.disabled && hasSituational && (
            <span className="rounded-full bg-gold/10 px-1.5 text-gold">ситуативне: {profile.situational.length}</span>
          )}
        </div>
      )}
      <div className="flex items-center gap-1">
        {Array.from({ length: SKILL_PROGRESS_MARKS }).map((_, i) => (
          <span key={i} className="flex h-5 w-5 items-center justify-center">
            <span className={`h-3 w-3 rounded-full border-[1.5px] border-gold/50 ${i < progress ? 'bg-gold' : 'bg-transparent'}`} />
          </span>
        ))}
      </div>

      {isPlayerEditable && menuOpen && (
        <Sheet open onClose={() => setMenuOpen(false)} title={label}>
          <div className="flex flex-col gap-2">
            {SKILL_ACTIONS.map(a => {
              const disabled =
                (a.key === 'crit_success' && progress >= SKILL_PROGRESS_MARKS) ||
                (a.key === 'crit_failure' && progress <= 0) ||
                (a.key === 'narrative' && progress >= SKILL_PROGRESS_MARKS) ||
                (a.key === 'inspiration' && (!canUseInspiration || (progress >= SKILL_PROGRESS_MARKS && value >= 12)));
              const hint = a.key === 'inspiration'
                ? (progress >= SKILL_PROGRESS_MARKS ? 'усі кола заповнені — підвищує навичку на 1' : 'позначає одне коло')
                  + (canUseInspiration ? '' : ' · натхнення вже використано')
                : a.hint;
              return (
                <button
                  key={a.key}
                  disabled={disabled}
                  onClick={() => runAction(a.key)}
                  className="flex flex-col items-start gap-0.5 rounded-lg border border-border px-3.5 py-2.5 text-left text-sm font-semibold text-text disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-surface-hover"
                >
                  <span>{a.label}</span>
                  {hint && <span className="text-xs font-normal text-text-dim">{hint}</span>}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}
    </div>
  );
}

// ── HealthCard ────────────────────────────────────────────────────────────────

// Здоровʼя (поточне/макс, кубики здоровʼя, тимчасове), відпочинок і таймер
// діяльності, шкала смерті та стани — стоїть на вкладці «Характеристики»
// поруч із характеристиками. Правила відпочинку й станів — на сервері
// (character-sheet), тут лише показ і виклики.
function HealthCard({
  c, maxHp, maxDiceCount, totalCondLevel, conditionsConfig, conditionLevels, conditionLabels, effects, timer,
  is_owner, archetype, patchCharacter, onConditionsChange, onRested, potions, potionState, onDrank,
}) {
  const { rollAndShow, rolling } = useDice();

  const healthDice   = c.health_dice_values || [];
  const crossedCount = totalCondLevel;

  const effectiveMaxHp = maxHp + (c.temp_hp || 0);
  const setCurrentHp  = v => patchCharacter({ current_hp: Math.max(0, Math.min(effectiveMaxHp, v)) });
  const setTempHp      = v => patchCharacter({ temp_hp: Math.max(0, v) });
  const setDeathScale = v => patchCharacter({ death_scale: v });

  const handleRollHealthDice = async (existing = []) => {
    const dieSize = parseInt(archetype.healthDie.slice(1));
    const needed = maxDiceCount - existing.length;
    if (needed <= 0) return;
    const roll = await rollAndShow(`${needed}d${dieSize}`);
    if (!roll) return;
    const newRolls = roll.groups.find(g => g.type === 'dice')?.rolls ?? [];
    const allDice = [...existing, ...newRolls].sort((a, b) => a - b);
    const currentHp = allDice.slice(0, Math.max(0, maxDiceCount - crossedCount)).reduce((s, v) => s + v, 0);
    patchCharacter({ health_dice_values: allDice, current_hp: currentHp });
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <SectionTitle>Здоров'я</SectionTitle>
        {is_owner && (
          <div className="flex shrink-0 items-center gap-1">
            <PotionControls characterId={c.id} potions={potions} potionState={potionState} labels={conditionLabels} onDrank={onDrank} />
            <RestControls characterId={c.id} characterName={c.name} labels={conditionLabels} onRested={onRested} />
          </div>
        )}
      </div>
      <p className="-mt-1 mb-3 text-xs italic text-text-dim">Кубик здоров'я — {archetype.healthDie}</p>

      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          {/* HP counter */}
          <div className="mb-2 flex items-center gap-2">
            <div className="flex flex-col items-center">
              <span className="mb-0.5 text-[0.62rem] uppercase tracking-wide text-text-dim">Поточне</span>
              <div className="flex items-center gap-1">
                {is_owner && <button className="flex h-9 w-9 items-center justify-center rounded border border-border bg-surface-hover text-text" onClick={() => setCurrentHp(c.current_hp - 1)}>−</button>}
                <span className="min-w-[40px] text-center text-3xl font-bold text-gold">{c.current_hp}</span>
                {is_owner && <button className="flex h-9 w-9 items-center justify-center rounded border border-border bg-surface-hover text-text" onClick={() => setCurrentHp(c.current_hp + 1)}>+</button>}
              </div>
            </div>
            <span className="text-lg text-border">/</span>
            <div className="flex flex-col items-center">
              <span className="mb-0.5 text-[0.62rem] uppercase tracking-wide text-text-dim">{totalCondLevel > 0 ? 'Макс (зі ст.)' : 'Макс'}</span>
              <span className={`text-lg font-semibold ${totalCondLevel > 0 ? 'text-danger' : 'text-text-muted'}`}>{maxHp}</span>
            </div>
          </div>

          {/* Dice pool — matches PDF cells */}
          <div className="mb-3 grid grid-cols-[repeat(auto-fill,minmax(26px,1fr))] gap-[3px]">
            {Array.from({ length: maxDiceCount }).map((_, i) => {
              const val     = healthDice[i];
              const crossed = i >= maxDiceCount - crossedCount;
              return (
                <div key={i} className={`flex h-[26px] items-center justify-center rounded border-[1.5px] text-xs font-semibold ${
                  crossed
                    ? 'border-danger/40 bg-danger/10 text-danger/70 line-through opacity-60'
                    : val
                      ? 'border-gold/50 bg-bg text-gold'
                      : 'border-border bg-bg text-text-dim'
                }`}>
                  {val ?? '·'}
                </div>
              );
            })}
          </div>

          {is_owner && healthDice.length < maxDiceCount && (
            <button
              className="mb-3 min-h-11 w-full rounded border border-border px-3 py-1.5 text-sm text-accent disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => handleRollHealthDice(healthDice)}
              disabled={rolling}
            >
              {healthDice.length === 0
                ? `Кинути ${maxDiceCount}${archetype.healthDie}`
                : `Кинути ${maxDiceCount - healthDice.length}${archetype.healthDie} (нові кістки)`}
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <span className="mb-0.5 text-[0.62rem] uppercase tracking-wide text-text-dim">Тимчасове</span>
              <div className="flex items-center gap-1">
                {is_owner && <button className="flex h-8 w-8 items-center justify-center rounded border border-border bg-surface-hover text-text" onClick={() => setTempHp((c.temp_hp || 0) - 1)}>−</button>}
                <span className="min-w-[24px] text-center text-lg font-semibold text-sage">{c.temp_hp || 0}</span>
                {is_owner && <button className="flex h-8 w-8 items-center justify-center rounded border border-border bg-surface-hover text-text" onClick={() => setTempHp((c.temp_hp || 0) + 1)}>+</button>}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 border-t border-border pt-3" />
      <ActivityTimer timer={timer} />
      <div className="mt-2">
        <p className="mb-0.5 text-[0.62rem] uppercase tracking-wide text-text-dim">Останній відпочинок</p>
        <LastRestBlock lastRest={c.last_rest} labels={conditionLabels} />
      </div>

      <div className="mt-4 border-t border-border pt-4" />
      <SectionTitle>Шкала смерті</SectionTitle>
      <div className="-mt-1 mb-3 flex items-center justify-between">
        <p className="text-xs italic text-text-dim">Кидок — d12</p>
        <RollButton formula="1d12" title="Кинути d12" size={16} />
      </div>
      <DeathScaleSlider value={c.death_scale} editable={is_owner} onChange={setDeathScale} />

      <div className="mt-3 border-t border-border pt-3" />
      <SectionTitle>Стани та ефекти</SectionTitle>
      <ConditionsSection
        conditions={c.conditions || []}
        effects={effects}
        conditionsConfig={conditionsConfig}
        conditionLevels={conditionLevels}
        editable={is_owner}
        onChange={onConditionsChange}
      />
    </div>
  );
}

// ── MagicTab ──────────────────────────────────────────────────────────────────

// spellAccess — що дерево відкрило для заклинань (традиції + складність,
// див. utils/spellAccess.js); isSpellMaster — глядач-майстер дає заклинання
// поза цими правилами.
function MagicTab({ c, maxMagic, archetype, maxKnownSpells, baseKnownSpells, mysticismVal, spells, allSpells, is_owner, patchCharacter, onAddSpell, onPatchSpell, onRemoveSpell, spellAccess, isSpellMaster, traditions = [] }) {
  const [spellSearch, setSpellSearch] = useState('');
  const [spellScope, setSpellScope]   = useState('');
  const [showPicker, setShowPicker]   = useState(false);
  // Заклинання з рівневими формами додається лише після вибору форми, до
  // якої персонаж уже дійшов — тут id заклинання, для якого відкрито вибір.
  const [tierPickFor, setTierPickFor] = useState(null);
  const [editingMaxSpells, setEditingMaxSpells] = useState(false);
  const [maxSpellsDraft, setMaxSpellsDraft] = useState(maxKnownSpells);

  const traditionNameOf = (id) => traditions.find(t => t.id === id)?.name;
  const knownIds   = new Set(spells.map(s => s.spell_id));
  const filteredAll = allSpells.filter(s =>
    !knownIds.has(s.id) &&
    matchesScope(s, spellScope) &&
    s.name?.toLowerCase().includes(spellSearch.toLowerCase())
  );
  const atMaxSpells = spells.length >= maxKnownSpells;

  const setMagic = v => patchCharacter({ current_magic: Math.max(0, Math.min(maxMagic, v)) });

  const openMaxSpellsEditor = () => {
    setMaxSpellsDraft(maxKnownSpells);
    setEditingMaxSpells(true);
  };
  const saveMaxSpells = () => {
    const desiredMax = Math.max(0, parseInt(maxSpellsDraft, 10) || 0);
    patchCharacter({ spell_bonus: desiredMax - baseKnownSpells });
    setEditingMaxSpells(false);
  };

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_2fr]">

      {/* Left: energy tracker */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <SectionTitle>Магічна енергія</SectionTitle>

        <div className="mb-3 flex items-center gap-2">
          <div className="flex flex-col items-center">
            <span className="mb-0.5 text-[0.62rem] uppercase tracking-wide text-text-dim">Поточна</span>
            <div className="flex items-center gap-1">
              {is_owner && <button className="flex h-9 w-9 items-center justify-center rounded border border-border bg-surface-hover text-text" onClick={() => setMagic(c.current_magic - 1)}>−</button>}
              <span className="min-w-[40px] text-center text-3xl font-bold text-gold">{c.current_magic}</span>
              {is_owner && <button className="flex h-9 w-9 items-center justify-center rounded border border-border bg-surface-hover text-text" onClick={() => setMagic(c.current_magic + 1)}>+</button>}
            </div>
          </div>
          <span className="text-lg text-border">/</span>
          <div className="flex flex-col items-center">
            <span className="mb-0.5 text-[0.62rem] uppercase tracking-wide text-text-dim">Макс</span>
            <span className="text-lg font-semibold text-text-muted">{maxMagic}</span>
          </div>
        </div>

        {/* Magic energy circles — like the PDF */}
        <div className="my-3 flex flex-wrap">
          {Array.from({ length: Math.min(maxMagic, 60) }).map((_, i) => (
            <button key={i}
              className={`flex h-9 w-9 items-center justify-center ${is_owner ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => is_owner && setMagic(i < c.current_magic ? i : i + 1)}
            >
              <span className={`h-3.5 w-3.5 rounded-full border-[1.5px] ${i < c.current_magic ? 'border-accent bg-accent' : 'border-border bg-transparent'}`} />
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[0.73rem] text-text-dim">⏱ Відпочинок (год): +{archetype.magicMult} оч.</span>
          <span className="text-[0.73rem] text-text-dim">🌙 Сон/медитація: +{archetype.meditationDie}+{archetype.magicMult}</span>
        </div>
      </div>

      {/* Right: spells */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle className="flex items-center gap-1">
            Чари ({spells.length} / {maxKnownSpells})
            {is_owner && (
              <button
                onClick={openMaxSpellsEditor}
                title="Змінити максимум заклинань"
                className="rounded p-1 text-xs leading-none text-text-dim hover:bg-surface-hover hover:text-text"
              >✎</button>
            )}
          </SectionTitle>
          {is_owner && (
            <button
              className="min-h-9 rounded border border-border px-2.5 py-1.5 text-sm text-accent disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setShowPicker(!showPicker)}
              disabled={!showPicker && atMaxSpells}
              title={!showPicker && atMaxSpells ? 'Досягнуто максимум відомих заклинань' : undefined}
            >
              {showPicker ? '✕' : '+ Додати'}
            </button>
          )}
        </div>

        {atMaxSpells && (
          <p className="mb-3 text-xs italic text-text-dim">Досягнуто максимум відомих заклинань ({maxKnownSpells}).</p>
        )}

        {showPicker && (
          <div className="mb-4 rounded-md border border-border bg-bg p-3">
            <input className={`${inputClass} mb-2 text-sm`} placeholder="Пошук..." value={spellSearch}
              onChange={e => setSpellSearch(e.target.value)}
            />
            <ScopeFilter scope={spellScope} onChange={setSpellScope} size="sm" className="mb-2" />
            <div className="max-h-[180px] overflow-y-auto">
              {filteredAll.length === 0 && <p className="my-2 text-sm text-text-dim">Немає доступних заклинань</p>}
              {filteredAll.map(s => {
                const access = spellAccessFor(s, spellAccess);
                const met = access.met || isSpellMaster;
                // Рівневі форми, які дерево відкрило (майстру — усі).
                const tierOpen = (t) => isSpellMaster || access.allowedForms === null
                  || access.allowedForms.includes(t === 'full' ? 'main' : t);
                const tiers = spellTiers(s);
                const add = (progress) => { onAddSpell(s.id, progress); setShowPicker(false); setTierPickFor(null); };
                return (
                  <div key={s.id} className="border-b border-bg py-1.5 text-sm text-text-muted">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span>
                          {s.name} <em className="text-xs text-text-dim">{natureLabels(s.nature)}</em>
                          {tiers.length > 0 && <em className="ml-1 text-xs text-text-dim">· рівневі форми</em>}
                          {s.is_canonical && <CanonBadge className="ml-1.5" />}
                        </span>
                        {!access.met && (
                          <span className="text-xs text-text-dim">
                            {missingAccessLabel(access.missing, traditionNameOf)}
                            {isSpellMaster && <span className="text-gold"> · майстер може видати</span>}
                          </span>
                        )}
                      </div>
                      <button
                        className="min-h-9 rounded border border-border px-2.5 py-1.5 text-sm text-accent disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => (tiers.length ? setTierPickFor(tierPickFor === s.id ? null : s.id) : add({}))}
                        disabled={atMaxSpells || !met}
                        title={!access.met && isSpellMaster ? 'Майстер дає заклинання поза правилами дерева розвитку' : undefined}
                      >{tierPickFor === s.id ? '✕' : '+'}</button>
                    </div>
                    {tierPickFor === s.id && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-text-dim">Яку форму вже освоїв персонаж?</span>
                        {tiers.map(t => (
                          <button
                            key={t}
                            className="min-h-8 rounded border border-accent/60 px-2.5 py-1 text-xs font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => add({ form_tier: t })}
                            disabled={!tierOpen(t)}
                            title={tierOpen(t) ? undefined : 'Складність цієї форми ще не відкрито на дереві розвитку'}
                          >{FORM_TIERS[t].label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          {spells.length === 0 && <p className="my-2 text-sm text-text-dim">Заклинань ще немає</p>}
          {spells.map(entry => {
            const spell = entry.spell || allSpells.find(s => s.id === entry.spell_id);
            // Заклинання від майстра правила доступності не обмежують.
            const met = !spell || entry.gm_granted || spellAccessFor(spell, spellAccess).met;
            return (
              <SpellEntry key={entry.spell_id} entry={entry} spell={spell}
                is_owner={is_owner} met={met}
                onPatch={patch => onPatchSpell(entry.spell_id, patch)}
                onRemove={() => onRemoveSpell(entry.spell_id)}
              />
            );
          })}
        </div>
      </div>

      {editingMaxSpells && (
        <Sheet open onClose={() => setEditingMaxSpells(false)} title="Максимум заклинань">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-dim">
              За замовчуванням дорівнює Містицизм × половина множника архетипу ({mysticismVal} × {archetype.magicMult / 2} = {baseKnownSpells}). Тут можна вказати інше число.
            </p>
            <Field label="Максимум відомих заклинань">
              <input
                autoFocus
                type="number"
                min={0}
                className={inputClass}
                value={maxSpellsDraft}
                onChange={e => setMaxSpellsDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveMaxSpells()}
              />
            </Field>
            <Button onClick={saveMaxSpells}>Зберегти</Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function SpellEntry({ entry, spell: baseSpell, is_owner, met = true, onPatch, onRemove }) {
  const [showModal, setShowModal] = useState(false);
  const [showForms, setShowForms] = useState(false);
  const tiers = baseSpell ? spellTiers(baseSpell) : [];
  const variants = baseSpell ? spellVariantForms(baseSpell) : [];
  // Показуємо поля форми, якою персонаж користується (див. spellForCharacter).
  const spell = baseSpell && spellForCharacter(baseSpell, entry);

  return (
    <>
      <div className="flex cursor-pointer items-center justify-between border-b border-bg py-2" onClick={() => setShowModal(true)}>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-sm text-text">{spell?.name ?? '(невідоме)'}</span>
          <span className="text-xs text-text-dim">
            {[(tiers.length > 0 || variants.length > 1) && spell?.form_label, spell?.nature?.length && natureLabels(spell.nature), spell?.energy_cost && `${spell.energy_cost} ен.`, spell?.action_time && `${spell.action_time} д.`]
              .filter(Boolean).join(' · ')}
          </span>
          {entry.gm_granted && <span className="text-xs text-gold">від майстра</span>}
          {!met && <span className="text-xs text-danger">⚠ традицію чи складність більше не відкрито на дереві розвитку</span>}
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {is_owner && tiers.length > 0 && (
            <select
              className="min-h-9 rounded border border-border bg-bg px-1.5 text-xs text-text"
              value={entry.form_tier ?? 'full'}
              onChange={e => onPatch({ form_tier: e.target.value })}
              title="Рівнева форма, яку освоїв персонаж"
            >
              {tiers.map(t => <option key={t} value={t}>{FORM_TIERS[t].label}</option>)}
            </select>
          )}
          {variants.length > 1 && (
            <button
              className={`min-h-9 rounded border px-2 text-xs ${showForms ? 'border-accent text-accent' : 'border-border text-text-dim'}`}
              onClick={() => setShowForms(o => !o)}
              title="Альтернативні форми"
            >Форми {showForms ? '▴' : '▾'}</button>
          )}
          <label className={`inline-flex items-center gap-1.5 ${is_owner ? 'cursor-pointer' : 'cursor-default'}`}>
            <input
              type="checkbox"
              className="h-5 w-5 accent-sage"
              checked={!!entry.mastered}
              disabled={!is_owner}
              onChange={() => is_owner && onPatch({ mastered: !entry.mastered })}
            />
            <span className="text-xs text-text-dim">освоєно</span>
          </label>
          <a href={`/spellbook/${entry.spell_id}`} target="_blank" rel="noreferrer"
            className="flex h-9 w-9 items-center justify-center text-sm text-accent" title="Відкрити у Книзі заклинань"
            onClick={e => e.stopPropagation()}
          >↗</a>
          {is_owner && <button className="flex h-9 w-9 items-center justify-center text-sm text-danger" onClick={onRemove}>✕</button>}
        </div>
      </div>
      {showForms && variants.length > 1 && (
        <FormsProgressPanel
          variants={variants} entry={entry} radioName={`primary-form-${entry.spell_id}`}
          is_owner={is_owner} onPatch={onPatch}
        />
      )}
      {showModal && spell && (
        <SpellDetailModal spell={spell} spellId={entry.spell_id} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

// Альтернативні форми заклинання / вміння в листі: яка основна для персонажа
// й які освоєні. Форми, яких дерево розвитку персонажу не відкрило, сервер
// не дає ні обрати, ні позначити.
function FormsProgressPanel({ variants, entry, radioName, is_owner, onPatch }) {
  const masteredForms = entry.mastered_forms ?? ['main'];
  const primaryForm = variants.some(f => f.key === entry.primary_form) ? entry.primary_form : 'main';

  const setPrimary = (key) => onPatch({
    primary_form: key,
    // Основною обирають освоєну форму — позначаємо її освоєною разом.
    mastered_forms: masteredForms.includes(key) ? masteredForms : [...masteredForms, key],
  });
  const toggleMastered = (key) => onPatch({
    mastered_forms: masteredForms.includes(key) ? masteredForms.filter(k => k !== key) : [...masteredForms, key],
  });

  return (
    <div className="mb-2 rounded-md border border-border bg-bg px-3 py-2">
      <div className="mb-1 grid grid-cols-[1fr_auto_auto] gap-x-4 text-[0.65rem] uppercase tracking-wide text-text-dim">
        <span>Форма</span><span>основна</span><span>освоєно</span>
      </div>
      {variants.map(f => (
        <div key={f.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-t border-border/50 py-1.5 text-sm text-text">
          <span>{f.label}</span>
          <input
            type="radio"
            name={radioName}
            className="h-5 w-5 justify-self-center accent-accent"
            checked={primaryForm === f.key}
            disabled={!is_owner}
            onChange={() => is_owner && setPrimary(f.key)}
            aria-label={`Основна форма: ${f.label}`}
          />
          <input
            type="checkbox"
            className="h-5 w-5 justify-self-center accent-sage"
            checked={masteredForms.includes(f.key)}
            disabled={!is_owner}
            onChange={() => is_owner && toggleMastered(f.key)}
            aria-label={`Освоєно: ${f.label}`}
          />
        </div>
      ))}
    </div>
  );
}

// ── SpellDetailModal ──────────────────────────────────────────────────────────

function SpellDetailModal({ spell, spellId, onClose }) {
  useMagicForms(); // підвантажує відредаговані адміном назви/описи форм магії
  const type   = primaryNature(spell.nature);
  const ritual = RITUAL_TYPES[spell.ritual];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative z-10 flex max-h-[85vh] w-full max-w-[540px] flex-col overflow-hidden rounded-t-2xl border-t border-border bg-surface sm:rounded-2xl sm:border"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-surface-hover px-4 py-3">
          <div className="flex items-center gap-2">
            <Tooltip text={type.description}>
              <span className="rounded border border-border px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-text-dim">{type.label}</span>
            </Tooltip>
            <span className="font-display text-base font-bold text-gold">{spell.name}</span>
            {spell.form_label && <span className="text-xs italic text-text-dim">{spell.form_label}</span>}
          </div>
          <div className="flex items-center gap-2">
            <a href={`/spellbook/${spellId}`} target="_blank" rel="noreferrer"
              className="flex h-9 items-center rounded border border-border px-2 text-sm text-accent" title="Відкрити у Книзі заклинань">↗</a>
            <button className="flex h-9 w-9 items-center justify-center text-text-dim" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="overflow-y-auto p-4">
          <div className="mb-4 grid grid-cols-4 gap-px overflow-hidden rounded-md border border-border bg-border">
            <ModalStat label="Енергія"   value={spell.energy_cost} />
            <ModalStat label="Дії"       value={`${spell.action_time} / 3`} />
            <ModalStat label="Ритуал"    value={ritual ? `${ritual.symbol} ${ritual.label}` : '—'} />
            <ModalStat label="Тривалість" value={formatDuration(spell.duration_value, spell.duration_unit)} />
          </div>
          {spell.narrative_desc && (
            <SmartTextReader text={spell.narrative_desc} className="mb-3 text-sm italic leading-relaxed text-text-dim" />
          )}
          {spell.mechanical_desc && (
            <SmartTextReader text={spell.mechanical_desc} className="text-sm leading-relaxed text-text-muted" />
          )}
        </div>
      </div>
    </div>
  );
}

function ModalStat({ label, value }) {
  return (
    <div className="flex flex-col items-center gap-0.5 bg-bg px-2 py-1.5">
      <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{label}</span>
      <span className="text-sm font-semibold text-text-muted">{value ?? '—'}</span>
    </div>
  );
}

// ── EquipmentTab ──────────────────────────────────────────────────────────────

const EQUIPMENT_SECTIONS = [
  { type: 'weapon', addLabel: 'зброю' },
  { type: 'armor', addLabel: 'обладунок' },
  { type: 'artifact', addLabel: 'артефакт' },
  { type: 'item', addLabel: 'предмет' },
  { type: 'potion', addLabel: 'зілля' },
];

function EquipmentTab({ c, patchCharacter, currencies, equipment, allEquipment, is_owner, onAdd, onPatch, onRemove }) {
  const section = ({ type, addLabel }) => (
    <EquipmentTypeSection
      key={type}
      type={type}
      addLabel={addLabel}
      equipment={equipment}
      allEquipment={allEquipment}
      is_owner={is_owner}
      onAdd={onAdd}
      onPatch={onPatch}
      onRemove={onRemove}
    />
  );

  // Зброя | Обладунок, Артефакт | Предмет, Зілля — по парі в рядку на ширших екранах.
  return (
    <div>
      <MoneySection c={c} is_owner={is_owner} patchCharacter={patchCharacter} currencies={currencies} />
      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
        {EQUIPMENT_SECTIONS.map(section)}
      </div>
    </div>
  );
}

// One independent add-picker + owned-item list per equipment type (weapon,
// armor, artifact, item) — each section searches/filters only within its own type.
function EquipmentTypeSection({ type, addLabel, equipment, allEquipment, is_owner, onAdd, onPatch, onRemove }) {
  const [search, setSearch]         = useState('');
  const [scope, setScope]           = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const items = equipment.filter(e => (e.item || allEquipment.find(a => a.id === e.equipment_id))?.type === type);
  const knownIds = new Set(equipment.map(e => e.equipment_id));
  const filteredAll = allEquipment.filter(item =>
    item.type === type &&
    !knownIds.has(item.id) &&
    matchesScope(item, scope) &&
    item.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mb-6 min-w-0">
      <div className="mb-2.5 flex items-center justify-between border-b border-border pb-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-gold">{CATALOG_TYPES[type].label}</span>
        {is_owner && (
          <button className="min-h-7 rounded border border-border px-2.5 py-1 text-xs text-accent" onClick={() => setShowPicker(v => !v)}>
            {showPicker ? '✕ Закрити' : `+ Додати ${addLabel}`}
          </button>
        )}
      </div>

      {showPicker && (
        <div className="mb-3 rounded-md border border-border bg-bg p-3">
          <input className={`${inputClass} mb-2 text-sm`} placeholder="Пошук..." value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <ScopeFilter scope={scope} onChange={setScope} size="sm" className="mb-2" />
          <div className="max-h-[220px] overflow-y-auto">
            {filteredAll.length === 0 && <p className="my-2 text-sm text-text-dim">Немає доступних предметів</p>}
            {filteredAll.map(item => (
              <div key={item.id} className="flex items-center justify-between border-b border-bg py-1.5 text-sm text-text-muted">
                <span>{item.name}{item.is_canonical && <CanonBadge className="ml-1.5" />}</span>
                <button className="min-h-9 rounded border border-border px-2.5 py-1.5 text-sm text-accent" onClick={() => { onAdd(item.id); setShowPicker(false); }}>+</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && !showPicker ? (
        <p className="mb-2 text-sm text-text-dim">Немає</p>
      ) : (
        items.map(entry => (
          <EquipmentItem key={entry.equipment_id} entry={entry}
            item={entry.item || allEquipment.find(a => a.id === entry.equipment_id)}
            is_owner={is_owner}
            onRemove={() => onRemove(entry.equipment_id)}
            onPatch={patch => onPatch(entry.equipment_id, patch)}
          />
        ))
      )}
    </div>
  );
}

function EquipmentItem({ entry, item, is_owner, onRemove, onPatch }) {
  const { tiersMap, sizesMap } = usePotionOptions();
  const isPotion = item?.type === 'potion';
  return (
    <div className="mb-1.5 flex items-center gap-3 rounded-md border border-border bg-bg px-3 py-2.5">
      <Link to={item ? `${item.type === 'artifact' ? '/equipment/artifacts' : '/equipment'}/${item.id}` : '#'} className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm text-text">{item?.name ?? '(невідоме)'}</span>
        <span className="text-xs text-text-dim">
          {[
            item?.damage_die && `Шкода: ${item.damage_die}`,
            item?.defense_value != null && `Захист: ${item.defense_value}`,
            item?.type === 'armor' && entry.is_equipped && 'Одягнено',
            isPotion && potionSummary(item, { tiersMap, sizesMap }),
          ].filter(Boolean).join(' · ')}
        </span>
        {isPotion && (
          <span className="text-xs text-text-dim">
            Є {availablePortions(entry)} {portionsWord(availablePortions(entry))}: {potionStockLabel(entry, sizesMap)}
          </span>
        )}
      </Link>

      {isPotion && is_owner && (
        <div className="flex shrink-0 items-center gap-1" title="Повні ємності">
          <button type="button" aria-label="Мінус ємність" disabled={!entry.containers}
            onClick={() => onPatch({ containers: entry.containers - 1 })}
            className="flex h-8 w-8 items-center justify-center rounded border border-border text-text disabled:opacity-40"><Minus size={13} /></button>
          <span className="w-5 text-center text-sm font-semibold text-text">{entry.containers}</span>
          <button type="button" aria-label="Плюс ємність" disabled={entry.containers >= 99}
            onClick={() => onPatch({ containers: entry.containers + 1 })}
            className="flex h-8 w-8 items-center justify-center rounded border border-border text-text disabled:opacity-40"><Plus size={13} /></button>
        </div>
      )}

      {item?.type === 'weapon' && item.damage_die && (
        <RollButton formula={`1${item.damage_die}`} title={`Кинути ${item.damage_die}`} />
      )}

      {item?.type === 'armor' && (
        <button
          type="button"
          onClick={() => is_owner && onPatch({ is_equipped: !entry.is_equipped })}
          disabled={!is_owner}
          title={entry.is_equipped ? 'Зняти обладунок' : 'Одягнути обладунок'}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded ${
            entry.is_equipped ? 'text-sage' : 'text-text-dim'
          } ${is_owner ? 'hover:bg-surface-hover' : ''}`}
        >
          <Shield size={18} fill={entry.is_equipped ? 'currentColor' : 'none'} />
        </button>
      )}

      {item?.type === 'weapon' && (
        <label className={`inline-flex items-center gap-1.5 ${is_owner ? 'cursor-pointer' : 'cursor-default'}`}>
          <input
            type="checkbox"
            className="h-5 w-5 accent-sage"
            checked={!!entry.mastered}
            disabled={!is_owner}
            onChange={() => is_owner && onPatch({ mastered: !entry.mastered })}
          />
          <span className="text-xs text-text-dim">освоєно</span>
        </label>
      )}

      {is_owner && (
        <button className="flex h-9 w-9 items-center justify-center text-sm text-danger" onClick={onRemove}>✕</button>
      )}
    </div>
  );
}

// ── AbilitiesTab (вміння, all archetypes) ───────────────────────────────────
// Same reference-table pattern as equipment, but the picker is
// scoped to catalog entries whose `archetypes` checkboxes include this
// character's archetype, enforcing the per-archetype restriction set when
// the ability was created.
function AbilitiesTab({ abilities, allAbilities, archetype, is_owner, onAdd, onPatch, onRemove, unlockedNodeIds }) {
  const [search, setSearch]         = useState('');
  const [scope, setScope]           = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [tierPickFor, setTierPickFor] = useState(null); // ability id whose "which tier?" choice is open

  const relevant    = allAbilities.filter(a => (a.archetypes || []).includes(archetype));
  const knownIds    = new Set(abilities.map(a => a.ability_id));
  const filteredAll = relevant.filter(a =>
    !knownIds.has(a.id) &&
    matchesScope(a, scope) &&
    a.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {is_owner && (
        <div className="mb-5 flex items-center justify-between">
          <button className="min-h-9 rounded border border-border px-4 py-1.5 text-sm text-accent" onClick={() => setShowPicker(!showPicker)}>
            {showPicker ? '✕ Закрити' : '+ Додати вміння'}
          </button>
          <Link to="/abilities" className="text-sm text-accent">Увесь каталог →</Link>
        </div>
      )}

      {showPicker && (
        <div className="mb-4 rounded-md border border-border bg-bg p-3">
          <input className={`${inputClass} mb-2 text-sm`} placeholder="Пошук..." value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <ScopeFilter scope={scope} onChange={setScope} size="sm" className="mb-2" />
          <div className="max-h-[220px] overflow-y-auto">
            {filteredAll.length === 0 && <p className="my-2 text-sm text-text-dim">Немає доступних вмінь</p>}
            {filteredAll.map(a => {
              const met = prereqMet(a, unlockedNodeIds);
              const tiers = abilityTiers(a);
              const add = (progress) => { onAdd(a.id, progress); setShowPicker(false); setTierPickFor(null); };
              return (
                <div key={a.id} className="border-b border-bg py-1.5 text-sm text-text-muted">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span>
                        {a.name}
                        {tiers.length > 0 && <em className="ml-1 text-xs text-text-dim">· рівневі форми</em>}
                        {a.is_canonical && <CanonBadge className="ml-1.5" />}
                      </span>
                      {!met && <span className="text-xs text-text-dim">{missingPrereqLabel(a)}</span>}
                    </div>
                    <button
                      className="min-h-9 rounded border border-border px-2.5 py-1.5 text-sm text-accent disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!met}
                      onClick={() => (tiers.length ? setTierPickFor(tierPickFor === a.id ? null : a.id) : add({}))}
                    >{tierPickFor === a.id ? '✕' : '+'}</button>
                  </div>
                  {tierPickFor === a.id && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-text-dim">Яку форму вже освоїв персонаж?</span>
                      {tiers.map(t => (
                        <button
                          key={t}
                          className="min-h-8 rounded border border-accent/60 px-2.5 py-1 text-xs font-semibold text-accent"
                          onClick={() => add({ form_tier: t })}
                        >{FORM_TIERS[t].label}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {abilities.length === 0 && !showPicker && <p className="text-sm text-text-dim">Вмінь ще немає</p>}
      {abilities.map(entry => {
        const a = entry.ability || allAbilities.find(x => x.id === entry.ability_id);
        const met = !a || prereqMet(a, unlockedNodeIds);
        return (
          <AbilityEntry key={entry.ability_id} entry={entry} ability={a}
            is_owner={is_owner} met={met}
            onPatch={patch => onPatch(entry.ability_id, patch)}
            onRemove={() => onRemove(entry.ability_id)}
          />
        );
      })}
    </div>
  );
}

// Рядок вміння в листі — з формами так само, як SpellEntry: рівнева форма,
// до якої дійшов персонаж, і альтернативні (основна / освоєні).
function AbilityEntry({ entry, ability: baseAbility, is_owner, met = true, onPatch, onRemove }) {
  const [showForms, setShowForms] = useState(false);
  const tiers = baseAbility ? abilityTiers(baseAbility) : [];
  const variants = baseAbility ? abilityVariantForms(baseAbility) : [];
  // Поля (описи, тривалість) — з форми, якою персонаж користується.
  const a = baseAbility && abilityForCharacter(baseAbility, entry);
  const hasForms = tiers.length > 0 || variants.length > 1;
  const href = a ? `/abilities/${a.id}${hasForms ? `?form=${encodeURIComponent(a.form_key)}` : ''}` : '#';

  return (
    <div className="mb-1.5 rounded-md border border-border bg-bg px-3 py-2.5">
      <div className="flex items-start gap-3">
        <Link to={href} className="flex flex-1 flex-col gap-0.5">
          <span className="text-sm text-text">
            {a?.name ?? '(невідоме)'}
            {hasForms && <span className="text-xs text-text-dim"> · {a.form_label}</span>}
          </span>
          {(a?.narrative_desc || a?.mechanical_desc) && (
            <span className="text-xs text-text-dim">{htmlToPreviewText(a.narrative_desc || a.mechanical_desc)}</span>
          )}
          {!met && <span className="text-xs text-danger">⚠ вимоги дерева розвитку більше не виконані</span>}
        </Link>
        <div className="flex items-center gap-2">
          {is_owner && tiers.length > 0 && (
            <select
              className="min-h-9 rounded border border-border bg-bg px-1.5 text-xs text-text"
              value={entry.form_tier ?? 'full'}
              onChange={e => onPatch({ form_tier: e.target.value })}
              title="Рівнева форма, яку освоїв персонаж"
            >
              {tiers.map(t => <option key={t} value={t}>{FORM_TIERS[t].label}</option>)}
            </select>
          )}
          {variants.length > 1 && (
            <button
              className={`min-h-9 rounded border px-2 text-xs ${showForms ? 'border-accent text-accent' : 'border-border text-text-dim'}`}
              onClick={() => setShowForms(o => !o)}
              title="Альтернативні форми"
            >Форми {showForms ? '▴' : '▾'}</button>
          )}
          {is_owner && (
            <button className="flex h-9 w-9 items-center justify-center text-sm text-danger" onClick={onRemove}>✕</button>
          )}
        </div>
      </div>
      {showForms && variants.length > 1 && (
        <div className="mt-2">
          <FormsProgressPanel
            variants={variants} entry={entry} radioName={`primary-form-ability-${entry.ability_id}`}
            is_owner={is_owner} onPatch={onPatch}
          />
        </div>
      )}
    </div>
  );
}

// ── RitualsTab (spellcaster; секція «Магії та чарів») ───────────────────────

function RitualsTab({ trackers, is_owner, onAdd, onUpdate, onRemove }) {
  const [creating, setCreating] = useState(false);
  const [name, setName]         = useState('');
  const [rounds, setRounds]     = useState(3);
  const [participantsText, setParticipantsText] = useState('');

  const startCreate = () => { setCreating(true); setName(''); setRounds(3); setParticipantsText(''); };

  const handleCreate = async (e) => {
    e.preventDefault();
    const names = participantsText.split(',').map(s => s.trim()).filter(Boolean);
    if (!name.trim() || names.length === 0) return;
    const participants = names.map(n => ({ name: n, successes: Array(rounds).fill(false) }));
    await onAdd({ name: name.trim(), rounds, participants });
    setCreating(false);
  };

  return (
    <div>
      {is_owner && !creating && (
        <button className="mb-5 min-h-9 rounded border border-border px-4 py-1.5 text-sm text-accent" onClick={startCreate}>
          + Новий ритуал
        </button>
      )}

      {creating && (
        <form onSubmit={handleCreate} className="mb-5 rounded-lg border border-border bg-surface p-5">
          <SectionTitle className="mb-4">Новий ритуал</SectionTitle>
          <div className="mb-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-text-dim">Назва ритуалу</label>
              <input className={inputClass} value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-dim">Кількість етапів (раундів)</label>
              <input type="number" min={1} max={12} className={inputClass} value={rounds} onChange={e => setRounds(Math.max(1, Math.min(12, Number(e.target.value) || 1)))} />
            </div>
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-xs text-text-dim">Учасники (через кому)</label>
            <input className={inputClass} value={participantsText} onChange={e => setParticipantsText(e.target.value)} placeholder="Аранель, Богдан, Ви" required />
          </div>
          <div className="flex gap-2">
            <Button type="submit">Створити</Button>
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Скасувати</Button>
          </div>
        </form>
      )}

      {trackers.length === 0 && !creating && <p className="text-sm text-text-dim">Ритуалів ще немає</p>}
      {trackers.map(t => (
        <RitualTracker key={t.id} tracker={t} is_owner={is_owner}
          onUpdate={patch => onUpdate(t.id, patch)}
          onRemove={() => onRemove(t.id)}
        />
      ))}
    </div>
  );
}

function RitualTracker({ tracker, is_owner, onUpdate, onRemove }) {
  const toggleCell = (participantIdx, roundIdx) => {
    const participants = tracker.participants.map((p, i) => {
      if (i !== participantIdx) return p;
      const successes = p.successes.map((v, j) => (j === roundIdx ? !v : v));
      return { ...p, successes };
    });
    onUpdate({ participants });
  };

  return (
    <div className="mb-4 rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle className="mb-0">{tracker.name}</SectionTitle>
        {is_owner && <button className="text-sm text-danger" onClick={onRemove}>✕ Видалити</button>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-border px-2 py-1.5 text-left text-xs uppercase tracking-wide text-text-dim">Учасник</th>
              {Array.from({ length: tracker.rounds }).map((_, i) => (
                <th key={i} className="border-b border-border px-2 py-1.5 text-xs uppercase tracking-wide text-text-dim">{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tracker.participants.map((p, pi) => (
              <tr key={pi}>
                <td className="border-b border-bg px-2 py-1.5 text-text-muted">{p.name}</td>
                {Array.from({ length: tracker.rounds }).map((_, ri) => (
                  <td key={ri} className="border-b border-bg px-2 py-1.5 text-center">
                    <button
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] ${is_owner ? 'cursor-pointer' : 'cursor-default'} ${p.successes[ri] ? 'border-sage bg-sage/30' : 'border-border bg-transparent'}`}
                      onClick={() => is_owner && toggleCell(pi, ri)}
                      title={p.successes[ri] ? 'Успіх' : 'Провал'}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── LuckTab (rogue) ──────────────────────────────────────────────────────────

function LuckTab({ c, is_owner, patchCharacter }) {
  const setLuckCurrent = v => patchCharacter({ luck_current: Math.max(0, Math.min(c.luck_max, v)) });
  const setLuckMax     = v => patchCharacter({ luck_max: Math.max(0, v) });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-lg border border-border bg-surface p-4">
        <SectionTitle>Вдача</SectionTitle>
        <p className="-mt-1 mb-3 text-xs italic text-text-dim">Дозволяє перекинути d20 при перевірці</p>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <span className="mb-0.5 text-[0.62rem] uppercase tracking-wide text-text-dim">Залишилось</span>
            <div className="flex items-center gap-1">
              {is_owner && <button className="flex h-9 w-9 items-center justify-center rounded border border-border bg-surface-hover text-text" onClick={() => setLuckCurrent(c.luck_current - 1)}>−</button>}
              <span className="min-w-[40px] text-center text-3xl font-bold text-gold">{c.luck_current}</span>
              {is_owner && <button className="flex h-9 w-9 items-center justify-center rounded border border-border bg-surface-hover text-text" onClick={() => setLuckCurrent(c.luck_current + 1)}>+</button>}
            </div>
          </div>
          <span className="text-lg text-border">/</span>
          <div className="flex flex-col items-center">
            <span className="mb-0.5 text-[0.62rem] uppercase tracking-wide text-text-dim">Макс</span>
            <div className="flex items-center gap-1">
              {is_owner && <button className="flex h-8 w-8 items-center justify-center rounded border border-border bg-surface-hover text-text" onClick={() => setLuckMax(c.luck_max - 1)}>−</button>}
              <span className="min-w-[24px] text-center text-lg font-semibold text-text-muted">{c.luck_max}</span>
              {is_owner && <button className="flex h-8 w-8 items-center justify-center rounded border border-border bg-surface-hover text-text" onClick={() => setLuckMax(c.luck_max + 1)}>+</button>}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <SectionTitle>Ігрове натхнення</SectionTitle>
        <p className="-mt-1 mb-3 text-xs italic text-text-dim">Кубик, який ви можете віддати іншому гравцю (або собі) цієї сесії</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            className={`rounded border px-2.5 py-1.5 text-sm ${!c.rogue_inspiration_die ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-dim'}`}
            onClick={() => is_owner && patchCharacter({ rogue_inspiration_die: null })}
            disabled={!is_owner}
          >Немає</button>
          {DAMAGE_DICE.map(die => (
            <button
              key={die}
              className={`rounded border px-2.5 py-1.5 text-sm font-semibold ${c.rogue_inspiration_die === die ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-dim'}`}
              onClick={() => is_owner && patchCharacter({ rogue_inspiration_die: die })}
              disabled={!is_owner}
            >{die}</button>
          ))}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-text-dim">Кому віддано</span>
          <input
            className={inputClass}
            value={c.rogue_inspiration_given_to ?? ''}
            onChange={e => patchCharacter({ rogue_inspiration_given_to: e.target.value || null })}
            placeholder="Ім'я гравця чи персонажа"
            disabled={!is_owner}
          />
        </label>
      </div>
    </div>
  );
}

function SectionTitle({ children, className = '' }) {
  return (
    <h3 className={`m-0 mb-2.5 text-[0.78rem] font-bold uppercase tracking-wide text-gold ${className}`}>
      {children}
    </h3>
  );
}
