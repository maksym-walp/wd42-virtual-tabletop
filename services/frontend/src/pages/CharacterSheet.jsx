import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronUp, ChevronDown, Pencil, Copy, Check, Upload, ImagePlus, Trash2 } from 'lucide-react';
import characterApi from '../api/characterSheet';
import mediaApi, { MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES } from '../api/media';
import spellbookApi from '../api/spellbook';
import equipmentApi from '../api/equipment';
import artifactsApi from '../api/artifacts';
import maneuversApi from '../api/maneuvers';
import abilitiesApi from '../api/abilities';
import skillTreeApi from '../api/skillTree';
import { recordView } from '../utils/recentlyViewed';
import { MAGIC_TYPES, RITUAL_TYPES, formatDuration } from '../constants/spellbook';
import { CATALOG_TYPES } from '../constants/artifacts';
import {
  ARCHETYPES, RACES, CHARACTERISTICS, CONDITIONS,
  DAMAGE_DICE, PHYSIQUE_HEALTH, LEVEL_MIN_VALUE, ARCHETYPE_COLORS,
  valueToLevel, modifierDie, skillsToCharLevel, CURRENCIES,
} from '../constants/characterSheet';
import useSvgPanZoom from '../hooks/useSvgPanZoom';
import Sheet from '../components/ui/Sheet';
import Lightbox from '../components/ui/Lightbox';
import Button from '../components/ui/Button';
import Field, { inputClass } from '../components/ui/Field';
import IntInput from '../components/ui/IntInput';
import DiceFormulaText from '../components/DiceFormulaText';
import RollButton from '../components/RollButton';
import ScopeFilter, { matchesScope } from '../components/ScopeFilter';
import CanonBadge from '../components/CanonBadge';
import { useDice } from '../context/DiceContext';

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

  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [tab, setTab]           = useState('skills');
  const [saving, setSaving]     = useState(false);
  const [allSpells, setAllSpells] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);
  const [allManeuvers, setAllManeuvers] = useState([]);
  const [allAbilities, setAllAbilities] = useState([]);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName]     = useState('');
  const [editingDefense, setEditingDefense]         = useState(false);
  const [defenseDraft, setDefenseDraft]             = useState(0);
  const [editingInspiration, setEditingInspiration] = useState(false);
  const [idCopied, setIdCopied] = useState(false);

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
    Promise.all([
      fetchSheet,
      publicView ? Promise.resolve([]) : (spellbookApi?.getAll?.() ?? Promise.resolve([])),
      publicView ? Promise.resolve([]) : (artifactsApi?.getAll?.() ?? Promise.resolve([])),
      publicView ? Promise.resolve([]) : (equipmentApi?.getAll?.() ?? Promise.resolve([])),
      publicView ? Promise.resolve([]) : (maneuversApi?.getAll?.() ?? Promise.resolve([])),
      publicView ? Promise.resolve([]) : (abilitiesApi?.getAll?.() ?? Promise.resolve([])),
    ])
      .then(([sheet, spells, artifactCatalog, equipmentCatalog, maneuverCatalog, abilityCatalog]) => {
        setData(sheet);
        recordView({
          type: 'character', id, name: sheet.character.name,
          href: `/characters/${id}`, image_url: sheet.character.image_url,
        });
        setAllSpells(Array.isArray(spells) ? spells : []);
        // The sheet's equipment tab spans both catalogs (weapons/armor/items
        // and artifacts), which are separate services — merge them into the
        // single list the tab and its picker work off.
        setAllEquipment([
          ...(Array.isArray(equipmentCatalog) ? equipmentCatalog : []),
          ...(Array.isArray(artifactCatalog) ? artifactCatalog : []),
        ]);
        setAllManeuvers(Array.isArray(maneuverCatalog) ? maneuverCatalog : []);
        setAllAbilities(Array.isArray(abilityCatalog) ? abilityCatalog : []);
      })
      .catch(() => setError('Не вдалось завантажити лист персонажа'))
      .finally(() => setLoading(false));
  }, [id, publicView]);

  // Accumulate all pending field changes so rapid edits (HP then magic, etc.)
  // never lose earlier changes when the debounce timer resets.
  const pendingPatch = useRef({});

  const saveVitalsFn = useCallback(async () => {
    const patch = { ...pendingPatch.current };
    pendingPatch.current = {};
    if (!Object.keys(patch).length) return;
    setSaving(true);
    try { await characterApi.update(id, patch); }
    finally { setSaving(false); }
  }, [id]);

  const saveVitals = useDebounce(saveVitalsFn, 600);

  // Flush any unsaved changes when navigating away (component unmount)
  useEffect(() => {
    return () => {
      const patch = pendingPatch.current;
      if (Object.keys(patch).length) {
        characterApi.update(id, patch).catch(() => {});
      }
    };
  }, [id]);

  const patchCharacter = (patch) => {
    setData(prev => ({ ...prev, character: { ...prev.character, ...patch } }));
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    saveVitals();
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

  const openDefenseEditor = (currentTotal) => {
    setDefenseDraft(currentTotal);
    setEditingDefense(true);
  };

  const patchSkill = async (skillKey, patch) => {
    const updated = await characterApi.patchSkill(id, skillKey, patch);
    setData(prev => ({
      ...prev,
      skills: prev.skills.map(s => s.skill_key === skillKey ? updated : s),
    }));
  };

  const unlockTreeNode = async (nodeId) => {
    const entry = await characterApi.unlockNode(id, nodeId);
    if (entry) setData(prev => ({ ...prev, tree: [...(prev.tree || []), entry] }));
  };
  const lockTreeNode = async (nodeId) => {
    await characterApi.lockNode(id, nodeId);
    setData(prev => ({ ...prev, tree: (prev.tree || []).filter(t => t.node_id !== nodeId) }));
  };
  const useBreakthrough = async (nodeId) => {
    await characterApi.useBreakthrough(id, nodeId);
    setData(prev => ({ ...prev, nephilim_breakthroughs: [...(prev.nephilim_breakthroughs || []), nodeId] }));
  };
  const revokeBreakthrough = async (nodeId) => {
    await characterApi.revokeBreakthrough(id, nodeId);
    setData(prev => ({ ...prev, nephilim_breakthroughs: (prev.nephilim_breakthroughs || []).filter(n => n !== nodeId) }));
  };

  const addSpell    = async (spellId) => {
    if (spells.length >= maxKnownSpells) return;
    const entry = await characterApi.addSpell(id, spellId);
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
    setData(prev => ({ ...prev, equipment: prev.equipment.map(e => e.equipment_id === equipmentId ? item : e) }));
  };
  const removeEquipment = async (equipmentId) => {
    await characterApi.removeEquipment(id, equipmentId);
    setData(prev => ({ ...prev, equipment: prev.equipment.filter(e => e.equipment_id !== equipmentId) }));
  };
  const addManeuver    = async (maneuverId) => {
    const maneuver = await characterApi.addManeuver(id, maneuverId);
    if (maneuver) setData(prev => ({ ...prev, maneuvers: [...prev.maneuvers, maneuver] }));
  };
  const removeManeuver = async (maneuverId) => {
    await characterApi.removeManeuver(id, maneuverId);
    setData(prev => ({ ...prev, maneuvers: prev.maneuvers.filter(m => m.maneuver_id !== maneuverId) }));
  };
  const addAbility    = async (abilityId) => {
    const ability = await characterApi.addAbility(id, abilityId);
    if (ability) setData(prev => ({ ...prev, abilities: [...prev.abilities, ability] }));
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

  if (loading) return <div className="mx-auto max-w-[1100px] px-4 py-16 text-center text-text-dim sm:px-6">Завантаження...</div>;
  if (error)   return <div className="mx-auto max-w-[1100px] px-4 py-16 text-center text-danger sm:px-6">{error}</div>;
  if (!data)   return null;

  const { character: c, skills, spells, equipment, maneuvers, abilities, rituals, is_owner } = data;
  const archetype = ARCHETYPES[c.archetype];
  const race      = RACES[c.race];
  const unlockedNodeIds = new Set((data.tree || []).map(t => t.node_id));

  const skillMap = Object.fromEntries(skills.map(s => [s.skill_key, s]));

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
  const activeDice     = healthDiceAll.slice(0, maxDiceCount - totalCondLevel);
  const maxHp          = activeDice.reduce((s, v) => s + v, 0);
  const enduranceVal   = skillMap['endurance']?.value ?? 1;
  const maxMagic       = enduranceVal * archetype.magicMult;
  const mysticismVal   = skillMap['mysticism']?.value ?? 1;
  const maxKnownSpells = mysticismVal + (c.spell_bonus ?? 0);

  const INITIATIVE_DIE  = { 1:'d4',2:'d6',3:'d8',4:'d10',5:'d12',6:'d20' };
  const HEROIC_COUNT    = { 1:0,2:1,3:2,4:3,5:4,6:5 };
  const INSPIRATION_DIE = { 1:'—',2:'d4',3:'d6',4:'d8',5:'d10',6:'d12' };

  const passiveDefense = equipment.reduce((s, e) => {
    const catalogItem = e.item || allEquipment.find(a => a.id === e.equipment_id);
    return catalogItem?.type === 'armor' ? s + (catalogItem.defense_value || 0) : s;
  }, 0);
  const totalDefense   = passiveDefense + (c.defense_bonus ?? 0);
  const heroicTotal    = HEROIC_COUNT[charLevels.wisdom];
  const heroicLeft     = heroicTotal - c.heroic_actions_used;
  const gameInspirationDie = INSPIRATION_DIE[charLevels.charisma];

  const ARCHETYPE_TABS = {
    fighter:     { key: 'maneuvers', label: 'Маневри' },
    spellcaster: { key: 'rituals',   label: 'Ритуали' },
    rogue:       { key: 'luck',      label: 'Вдача' },
  };
  const archetypeTab = ARCHETYPE_TABS[c.archetype];

  const TABS = [
    { key: 'skills',    label: 'Характеристики' },
    { key: 'vitals',    label: 'Стан' },
    { key: 'magic',     label: 'Магія та чари' },
    ...(archetypeTab ? [archetypeTab] : []),
    { key: 'abilities', label: 'Вміння' },
    { key: 'equipment', label: 'Спорядження' },
    { key: 'tree',      label: 'Дерево розвитку' },
    { key: 'notes',     label: 'Нотатки' },
  ];

  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-6 pb-28 sm:px-6 md:pb-16">
      {/* ─── Header ─── */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <CharacterPortrait character={c} isOwner={is_owner} onChange={patchCharacter} />
          <div>
          <div className="mb-1 flex items-center gap-4">
            <Link to="/characters" className="text-sm text-accent">← Персонажі</Link>
            {saving && <span className="text-xs text-text-dim">• Збереження...</span>}
          </div>
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
            <h1 className="m-0 flex items-center gap-2 font-display text-3xl font-bold text-text">
              {c.name}
              {is_owner && (
                <button
                  className="rounded-md p-1.5 text-sm leading-none text-text-dim hover:bg-surface-hover hover:text-text"
                  onClick={startEditName} title="Змінити ім'я"
                >✎</button>
              )}
            </h1>
          )}
          <p className="mt-1 text-sm text-text-dim">
            <span style={{ color: ARCHETYPE_COLORS[c.archetype]?.color }} className="font-semibold">
              {archetype.label}
            </span> · {race.label}
            {c.race_ancestry ? ` (${RACES[c.race_ancestry]?.label ?? c.race_ancestry})` : ''}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-text-dim">
            <button
              onClick={() => handleCopyId(c.id)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 hover:bg-surface-hover hover:text-text"
              title="Скопіювати ID персонажа"
            >
              {idCopied ? <Check size={13} /> : <Copy size={13} />}
              <span className="font-mono">{c.id}</span>
            </button>
            {c.owner_username && (
              <span>Власник: <Link to={`/profile/${c.owner_username}`} className="text-accent hover:underline">{c.owner_username}</Link></span>
            )}
          </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
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
      </div>

      {/* ─── Banner (matches the PDF top row) ─── */}
      <div className="mb-5 flex flex-wrap gap-1.5">
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
          label="ЗАХИСТ"
          sub={`пасивний: ${totalDefense}`}
          onClick={is_owner ? () => openDefenseEditor(totalDefense) : undefined}
        />
        <BannerBox
          label="ГЕРОЇЧНІ ДІЇ"
          sub={`${heroicLeft} / ${heroicTotal}`}
          accent={heroicLeft > 0}
        />
        <BannerBox
          label="ІНІЦІАТИВА"
          accent
          sub={
            <RollButton
              formula={`1${INITIATIVE_DIE[charLevels.agility]}`}
              title={`Кинути ${INITIATIVE_DIE[charLevels.agility]} (ініціатива)`}
              icon={false}
              className="p-0 text-base font-bold"
            >
              {INITIATIVE_DIE[charLevels.agility]}
            </RollButton>
          }
        />
        <BannerBox label="ПЗ" sub={`${c.current_hp} / ${maxHp}${c.temp_hp ? ` (+${c.temp_hp})` : ''}`} accent wide />
        <BannerBox label="МАГІЯ" sub={`${c.current_magic} / ${maxMagic}`} wide />
      </div>

      {/* ─── Tabs ─── */}
      <div className="sticky top-0 z-20 mb-6 -mx-4 overflow-x-auto border-b border-border bg-bg px-4 py-2 sm:static sm:mx-0 sm:overflow-visible sm:px-0">
        <div className="flex w-max gap-2 sm:w-full sm:flex-wrap">
          {TABS.map(t => (
            <button key={t.key}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.key ? 'border-gold/60 bg-gold/10 text-gold' : 'border-border text-text-dim'
              }`}
              onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {tab === 'skills' && (
          <SkillsTab
            characteristics={CHARACTERISTICS}
            skillMap={skillMap}
            charLevels={charLevels}
            is_owner={is_owner}
            onPatchSkill={patchSkill}
          />
        )}
        {tab === 'vitals' && (
          <VitalsTab
            c={c} maxHp={maxHp}
            maxDiceCount={maxDiceCount}
            totalCondLevel={totalCondLevel}
            heroicTotal={heroicTotal}
            is_owner={is_owner} archetype={archetype}
            patchCharacter={patchCharacter}
          />
        )}
        {tab === 'magic' && (
          <MagicTab
            c={c} maxMagic={maxMagic} archetype={archetype}
            maxKnownSpells={maxKnownSpells} mysticismVal={mysticismVal}
            spells={spells} allSpells={allSpells}
            is_owner={is_owner}
            patchCharacter={patchCharacter}
            onAddSpell={addSpell}
            onPatchSpell={patchSpell}
            onRemoveSpell={removeSpell}
            unlockedNodeIds={unlockedNodeIds}
          />
        )}
        {tab === 'maneuvers' && (
          <ManeuversTab
            maneuvers={maneuvers} allManeuvers={allManeuvers} is_owner={is_owner}
            onAdd={addManeuver}
            onRemove={removeManeuver}
            unlockedNodeIds={unlockedNodeIds}
          />
        )}
        {tab === 'abilities' && (
          <AbilitiesTab
            abilities={abilities} allAbilities={allAbilities} archetype={c.archetype} is_owner={is_owner}
            onAdd={addAbility}
            onRemove={removeAbility}
            unlockedNodeIds={unlockedNodeIds}
          />
        )}
        {tab === 'rituals' && (
          <RitualsTab
            trackers={rituals} is_owner={is_owner}
            onAdd={addRitual}
            onUpdate={updateRitual}
            onRemove={removeRitual}
          />
        )}
        {tab === 'luck' && (
          <LuckTab c={c} is_owner={is_owner} patchCharacter={patchCharacter} />
        )}
        {tab === 'equipment' && (
          <EquipmentTab
            c={c} patchCharacter={patchCharacter}
            equipment={equipment} allEquipment={allEquipment} is_owner={is_owner}
            onAdd={addEquipment}
            onPatch={patchEquipment}
            onRemove={removeEquipment}
          />
        )}
        {tab === 'tree' && (
          <TreeTab
            c={c}
            tree={data.tree || []}
            nephilimBreakthroughs={data.nephilim_breakthroughs || []}
            is_owner={is_owner}
            patchCharacter={patchCharacter}
            onUnlock={unlockTreeNode}
            onLock={lockTreeNode}
            onUseBreakthrough={useBreakthrough}
            onRevokeBreakthrough={revokeBreakthrough}
            allAbilities={allAbilities}
            allSpells={allSpells}
            allManeuvers={allManeuvers}
          />
        )}
        {tab === 'notes' && (
          <NotesTab c={c} is_owner={is_owner} patchCharacter={patchCharacter} />
        )}
      </div>

      {editingDefense && (
        <Sheet open onClose={() => setEditingDefense(false)} title="Пасивний захист">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-dim">
              Від спорядження: {passiveDefense}. Тут можна вказати інше загальне число.
            </p>
            <Field label="Пасивний захист">
              <input
                autoFocus
                type="number"
                min={0}
                className={inputClass}
                value={defenseDraft}
                onChange={e => setDefenseDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key !== 'Enter') return;
                  patchCharacter({ defense_bonus: Math.max(0, parseInt(defenseDraft, 10) || 0) - passiveDefense });
                  setEditingDefense(false);
                }}
              />
            </Field>
            <Button onClick={() => {
              patchCharacter({ defense_bonus: Math.max(0, parseInt(defenseDraft, 10) || 0) - passiveDefense });
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
      onChange({ image_url: uploaded });
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
            <img src={url} alt="" className={`${box} object-cover`} />
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
                onClick={() => onChange({ image_url: null })}
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
    <div className={`relative ${wide ? 'min-w-[120px] flex-[1.5]' : 'min-w-[90px] flex-1'}`}>
      <Tag
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={`flex w-full flex-col items-center gap-0.5 rounded-md border-[1.5px] bg-surface px-3 py-2.5 ${
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

function SkillsTab({ characteristics, skillMap, charLevels, is_owner, onPatchSkill }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
      {characteristics.map(char => {
        const level  = charLevels[char.key];
        const effect = char.effect(level);
        return (
          <div key={char.key} className="overflow-hidden rounded-lg border border-border bg-surface">
            {/* Section header strip */}
            <div className="flex items-start justify-between border-b border-border bg-bg px-3.5 py-2.5">
              <div>
                <h3 className="m-0 text-[0.8rem] font-bold uppercase tracking-wide text-gold">{char.label}</h3>
                <LevelSquares level={level} />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[0.6rem] uppercase tracking-wide text-text-dim">{char.effectLabel}</span>
                <span className="text-sm font-bold text-text-muted">{effect}</span>
              </div>
            </div>

            <div className="px-3.5 py-2">
              {char.skills.map(skill => {
                const s = skillMap[skill.key] || { value: 1, progress_marks: 0 };
                const minValue = LEVEL_MIN_VALUE[level] ?? 1;
                return (
                  <SkillRow
                    key={skill.key}
                    label={skill.label}
                    value={s.value}
                    progress={s.progress_marks}
                    minValue={minValue}
                    is_owner={is_owner}
                    onProgressClick={idx => {
                      if (!is_owner) return;
                      const newMarks = s.progress_marks === idx + 1 ? idx : idx + 1;
                      onPatchSkill(skill.key, { progress_marks: newMarks });
                    }}
                    onLevelAdjust={delta => {
                      if (!is_owner) return;
                      const next = Math.max(minValue, Math.min(12, s.value + delta));
                      if (next === s.value) return;
                      onPatchSkill(skill.key, { value: next, progress_marks: delta > 0 ? 0 : 5 });
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
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

function SkillRow({ label, value, progress, minValue = 1, is_owner, onProgressClick, onLevelAdjust }) {
  const die = modifierDie(value);
  const rollFormula = die === '—' ? '1d20' : `1d20+1${die}`;
  const canLevelDown = is_owner && progress === 0 && value > minValue;
  const canLevelUp   = is_owner && progress === 5 && value < 12;
  return (
    <div className="flex flex-col gap-1 border-b border-bg py-1.5">
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-text-muted">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="w-6 text-center text-base font-bold text-text">{value}</span>
          <RollButton
            formula={rollFormula}
            title={`Кинути ${label}: ${rollFormula}`}
            size={11}
            className="min-w-[28px] rounded border border-border bg-bg px-1.5 py-0.5 text-xs font-semibold"
          >
            {die === '—' ? '—' : `+${die}`}
          </RollButton>
        </div>
      </div>
      <div className="flex items-center">
        {is_owner && (
          <button
            className={`flex h-9 w-9 items-center justify-center text-xs font-bold ${
              canLevelDown ? 'rounded border border-danger/40 bg-danger/10 text-danger' : 'text-border'
            }`}
            onClick={() => onLevelAdjust(-1)}
            disabled={!canLevelDown}
            title="Зменшити навичку (стерти всі кружечки)"
          >−</button>
        )}
        <div className="flex items-center">
          {Array.from({ length: 5 }).map((_, i) => (
            <button key={i}
              className={`flex h-9 w-9 items-center justify-center ${is_owner ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => onProgressClick(i)}
              title={is_owner ? `Позначити ${i + 1} коло` : undefined}
            >
              <span className={`h-3.5 w-3.5 rounded-full border-[1.5px] border-gold/50 ${i < progress ? 'bg-gold' : 'bg-transparent'}`} />
            </button>
          ))}
        </div>
        {is_owner && (
          <button
            className={`flex h-9 w-9 items-center justify-center text-xs font-bold ${
              canLevelUp ? 'rounded border border-sage/40 bg-sage/10 text-sage' : 'text-border'
            }`}
            onClick={() => onLevelAdjust(1)}
            disabled={!canLevelUp}
            title="Підвищити навичку (заповнити всі кружечки)"
          >+</button>
        )}
      </div>
    </div>
  );
}

// ── VitalsTab ─────────────────────────────────────────────────────────────────

function VitalsTab({ c, maxHp, maxDiceCount, totalCondLevel, heroicTotal, is_owner, archetype, patchCharacter }) {
  const { rollAndShow, rolling } = useDice();
  const healthDice   = c.health_dice_values || [];
  const crossedCount = totalCondLevel;

  const effectiveMaxHp = maxHp + (c.temp_hp || 0);
  const setCurrentHp  = v => patchCharacter({ current_hp: Math.max(0, Math.min(effectiveMaxHp, v)) });
  const setTempHp      = v => patchCharacter({ temp_hp: Math.max(0, v) });
  const setDeathScale = v => patchCharacter({ death_scale: v });

  const setConditionLevel = (type, level) => {
    const conditions = [...(c.conditions || [])];
    const idx = conditions.findIndex(cond => cond.type === type);
    if (level === 0) {
      if (idx !== -1) conditions.splice(idx, 1);
    } else if (idx === -1) {
      conditions.push({ type, level });
    } else {
      conditions[idx] = { ...conditions[idx], level };
    }
    patchCharacter({ conditions });
  };

  const handleRollHealthDice = async (existing = []) => {
    const dieSize = parseInt(archetype.healthDie.slice(1));
    const needed = maxDiceCount - existing.length;
    if (needed <= 0) return;
    const roll = await rollAndShow(`${needed}d${dieSize}`);
    if (!roll) return;
    const newRolls = roll.groups.find(g => g.type === 'dice')?.rolls ?? [];
    const allDice = [...existing, ...newRolls].sort((a, b) => a - b);
    const currentHp = allDice.slice(0, maxDiceCount - crossedCount).reduce((s, v) => s + v, 0);
    patchCharacter({ health_dice_values: allDice, current_hp: currentHp });
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">

      {/* Health section — matches PDF layout */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <SectionTitle>Здоров'я</SectionTitle>
        <p className="-mt-1 mb-3 text-xs italic text-text-dim">Кубик здоров'я — {archetype.healthDie}</p>

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

      {/* Death scale + heroic actions */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <SectionTitle>Рятунки від смерті</SectionTitle>
        <div className="-mt-1 mb-3 flex items-center justify-between">
          <p className="text-xs italic text-text-dim">Кидок — d12</p>
          <RollButton formula="1d12" title="Кинути d12" size={16} />
        </div>
        <div className="mb-2 flex gap-[3px]">
          {[-3, -2, -1, 0, 1, 2, 3].map(v => {
            const isActive = c.death_scale != null && c.death_scale === v;
            const toneClass = v < 0 ? 'text-danger' : v > 0 ? 'text-sage' : 'text-gold';
            const activeClass = v < 0 ? 'border-danger bg-danger/25' : v > 0 ? 'border-sage bg-sage/25' : 'border-gold bg-gold/25';
            return (
              <button key={v}
                className={`flex h-10 flex-1 items-center justify-center rounded border-[1.5px] text-sm font-bold ${toneClass} ${isActive ? activeClass : 'border-border bg-bg'}`}
                onClick={() => is_owner && setDeathScale(isActive ? null : v)}
                disabled={!is_owner}
              >
                {v === -3 ? '☠' : v === 3 ? '✓' : v > 0 ? `+${v}` : v}
              </button>
            );
          })}
        </div>
        <p className="mb-1 text-sm text-text-dim">
          {c.death_scale == null ? ' ' :
           c.death_scale <= -3 ? 'Смерть' :
           c.death_scale < 0  ? `Провалів: ${Math.abs(c.death_scale)}` :
           c.death_scale === 0 ? 'Непритомний' :
           `Успіхів: ${c.death_scale}`}
        </p>

        <SectionTitle className="mt-5">Героїчні дії</SectionTitle>
        <div className="flex items-center gap-2">
          {is_owner && (
            <button className="flex h-9 w-9 items-center justify-center rounded border border-border bg-surface-hover text-text"
              onClick={() => patchCharacter({ heroic_actions_used: Math.min(heroicTotal, c.heroic_actions_used + 1) })}
              disabled={c.heroic_actions_used >= heroicTotal}
            >−</button>
          )}
          <span className="text-2xl font-bold text-gold">{heroicTotal - c.heroic_actions_used}</span>
          <span className="text-sm text-text-dim">/ {heroicTotal}</span>
          {is_owner && (
            <button className="flex h-9 w-9 items-center justify-center rounded border border-border bg-surface-hover text-text"
              onClick={() => patchCharacter({ heroic_actions_used: Math.max(0, c.heroic_actions_used - 1) })}
              disabled={c.heroic_actions_used <= 0}
            >+</button>
          )}
        </div>
      </div>

      {/* Conditions */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <SectionTitle>Стани та ефекти</SectionTitle>
        {CONDITIONS.map(cond => {
          const current = c.conditions?.find(x => x.type === cond.key);
          const level   = current?.level ?? 0;
          return (
            <div key={cond.key} className="flex items-center justify-between border-b border-bg py-2">
              <div>
                <span className="text-sm text-text-muted">{cond.label}</span>
                {cond.maxLevel && (
                  <span className="ml-1 text-xs text-text-dim">
                    (макс {cond.maxLevel})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {is_owner && (
                  <button className="flex h-9 w-9 items-center justify-center rounded border border-border bg-surface-hover text-text disabled:opacity-40" onClick={() => setConditionLevel(cond.key, Math.max(0, level - 1))} disabled={level === 0}>−</button>
                )}
                <span className={`w-6 text-center text-sm font-bold ${level > 0 ? 'text-danger' : 'text-text-dim'}`}>
                  {level > 0 ? level : '—'}
                </span>
                {is_owner && (
                  <button className="flex h-9 w-9 items-center justify-center rounded border border-border bg-surface-hover text-text disabled:opacity-40" onClick={() => setConditionLevel(cond.key, level + 1)}
                    disabled={cond.maxLevel !== null && level >= cond.maxLevel}>+</button>
                )}
              </div>
            </div>
          );
        })}

        <p className="mt-4 text-xs italic text-text-dim">
          Передсмертний героїзм: 2 провали + 6 рів. втоми = 1 хід без штрафів з подвоєною шкодою
        </p>
      </div>

    </div>
  );
}

// ── MagicTab ──────────────────────────────────────────────────────────────────

function MagicTab({ c, maxMagic, archetype, maxKnownSpells, mysticismVal, spells, allSpells, is_owner, patchCharacter, onAddSpell, onPatchSpell, onRemoveSpell, unlockedNodeIds }) {
  const [spellSearch, setSpellSearch] = useState('');
  const [spellScope, setSpellScope]   = useState('');
  const [showPicker, setShowPicker]   = useState(false);
  const [editingMaxSpells, setEditingMaxSpells] = useState(false);
  const [maxSpellsDraft, setMaxSpellsDraft] = useState(maxKnownSpells);

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
    patchCharacter({ spell_bonus: desiredMax - mysticismVal });
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
                const met = prereqMet(s, unlockedNodeIds);
                return (
                  <div key={s.id} className="flex items-center justify-between border-b border-bg py-1.5 text-sm text-text-muted">
                    <div className="flex flex-col">
                      <span>{s.name} <em className="text-xs text-text-dim">{s.magic_type}</em>{s.is_canonical && <CanonBadge className="ml-1.5" />}</span>
                      {!met && <span className="text-xs text-text-dim">{missingPrereqLabel(s)}</span>}
                    </div>
                    <button
                      className="min-h-9 rounded border border-border px-2.5 py-1.5 text-sm text-accent disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => { onAddSpell(s.id); setShowPicker(false); }}
                      disabled={atMaxSpells || !met}
                    >+</button>
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
            const met = !spell || prereqMet(spell, unlockedNodeIds);
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
              За замовчуванням дорівнює навичці Містицизм ({mysticismVal}). Тут можна вказати інше число.
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

function SpellEntry({ entry, spell, is_owner, met = true, onPatch, onRemove }) {
  const [showModal, setShowModal] = useState(false);
  return (
    <>
      <div className="flex cursor-pointer items-center justify-between border-b border-bg py-2" onClick={() => setShowModal(true)}>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-sm text-text">{spell?.name ?? '(невідоме)'}</span>
          <span className="text-xs text-text-dim">
            {[spell?.magic_type && (MAGIC_TYPES[spell.magic_type]?.label ?? spell.magic_type), spell?.energy_cost && `${spell.energy_cost} ен.`, spell?.action_time && `${spell.action_time} д.`]
              .filter(Boolean).join(' · ')}
          </span>
          {!met && <span className="text-xs text-danger">⚠ вимоги дерева розвитку більше не виконані</span>}
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
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
      {showModal && spell && (
        <SpellDetailModal spell={spell} spellId={entry.spell_id} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

// ── SpellDetailModal ──────────────────────────────────────────────────────────

function SpellDetailModal({ spell, spellId, onClose }) {
  const type   = MAGIC_TYPES[spell.magic_type] ?? MAGIC_TYPES.arcana;
  const ritual = RITUAL_TYPES[spell.ritual];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative z-10 flex max-h-[85vh] w-full max-w-[540px] flex-col overflow-hidden rounded-t-2xl border-t border-border bg-surface sm:rounded-2xl sm:border"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ background: type.bg, borderBottomColor: type.color + '44' }}>
          <div className="flex items-center gap-2">
            <span className="rounded border px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide" style={{ color: type.color, borderColor: type.color + '66' }}>{type.label}</span>
            <span className="font-display text-base font-bold text-gold">{spell.name}</span>
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
            <p className="mb-3 text-sm italic leading-relaxed text-text-dim">
              <DiceFormulaText text={spell.narrative_desc} />
            </p>
          )}
          {spell.mechanical_desc && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
              <DiceFormulaText text={spell.mechanical_desc} />
            </p>
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

// ── MoneySection ──────────────────────────────────────────────────────────────

function MoneySection({ c, is_owner, patchCharacter }) {
  const money = c.money || {};
  const setDenom = (key, value) => patchCharacter({ money: { ...money, [key]: Math.max(0, value) } });

  // Within a mint, the high denomination is always worth 100 of the low one
  // (e.g. 1 Альґос = 100 Дельґос) — except "Інші", whose two currencies
  // aren't a fixed-rate coinage.
  const convertUp = (cur) => {
    const lowVal = money[cur.low.key] ?? 0;
    const count = Math.floor(lowVal / 100);
    if (count <= 0) return;
    patchCharacter({ money: {
      ...money,
      [cur.high.key]: (money[cur.high.key] ?? 0) + count,
      [cur.low.key]: lowVal - count * 100,
    } });
  };
  const convertDown = (cur) => {
    const highVal = money[cur.high.key] ?? 0;
    if (highVal <= 0) return;
    patchCharacter({ money: {
      ...money,
      [cur.high.key]: highVal - 1,
      [cur.low.key]: (money[cur.low.key] ?? 0) + 100,
    } });
  };

  if (!is_owner) {
    const nonzero = CURRENCIES.flatMap(cur => [cur.high, cur.low])
      .filter(denom => (money[denom.key] ?? 0) > 0)
      .map(denom => `${denom.name}: ${money[denom.key]}`);
    if (nonzero.length === 0) return null;
    return (
      <div className="mb-6">
        <div className="mb-2 border-b border-border pb-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-gold">Гроші</span>
        </div>
        <p className="text-sm text-text-muted">{nonzero.join(' · ')}</p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="mb-2 border-b border-border pb-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-gold">Гроші</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {CURRENCIES.map(cur => (
          <div key={cur.region} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded border border-border bg-bg px-2.5 py-1.5">
            <span className="w-full text-xs text-text-dim sm:w-[130px] sm:shrink-0">{cur.region}</span>
            {[cur.high, cur.low].map(denom => (
              <div key={denom.key} className="flex items-center gap-1.5">
                <span className="text-xs text-text-dim">{denom.name}{denom.metal ? ` (${denom.metal})` : ''}</span>
                <IntInput
                  className="w-16 rounded border border-border bg-surface px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
                  value={money[denom.key] ?? 0}
                  onChange={v => setDenom(denom.key, v)}
                />
              </div>
            ))}
            {cur.convertible && (
              <div className="flex items-center gap-1 border-l border-border pl-2.5">
                <button
                  type="button"
                  title={`Обміняти 100 ${cur.low.name} → 1 ${cur.high.name}`}
                  className="flex h-7 w-7 items-center justify-center rounded border border-border text-text-dim hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => convertUp(cur)}
                  disabled={(money[cur.low.key] ?? 0) < 100}
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  title={`Обміняти 1 ${cur.high.name} → 100 ${cur.low.name}`}
                  className="flex h-7 w-7 items-center justify-center rounded border border-border text-text-dim hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => convertDown(cur)}
                  disabled={(money[cur.high.key] ?? 0) < 1}
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── EquipmentTab ──────────────────────────────────────────────────────────────

function EquipmentTab({ c, patchCharacter, equipment, allEquipment, is_owner, onAdd, onPatch, onRemove }) {
  const [search, setSearch]         = useState('');
  const [scope, setScope]           = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const knownIds    = new Set(equipment.map(e => e.equipment_id));
  const filteredAll = allEquipment.filter(item =>
    !knownIds.has(item.id) &&
    matchesScope(item, scope) &&
    item.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <MoneySection c={c} is_owner={is_owner} patchCharacter={patchCharacter} />

      {is_owner && (
        <div className="mb-5 flex items-center justify-between">
          <button className="min-h-9 rounded border border-border px-4 py-1.5 text-sm text-accent" onClick={() => setShowPicker(!showPicker)}>
            {showPicker ? '✕ Закрити' : '+ Додати предмет'}
          </button>
          <div className="flex gap-3">
            <Link to="/equipment" className="text-sm text-accent">Спорядження →</Link>
            <Link to="/artifacts" className="text-sm text-accent">Артефакти →</Link>
          </div>
        </div>
      )}

      {showPicker && (
        <div className="mb-4 rounded-md border border-border bg-bg p-3">
          <input className={`${inputClass} mb-2 text-sm`} placeholder="Пошук..." value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <ScopeFilter scope={scope} onChange={setScope} size="sm" className="mb-2" />
          <div className="max-h-[220px] overflow-y-auto">
            {filteredAll.length === 0 && <p className="my-2 text-sm text-text-dim">Немає доступних предметів</p>}
            {filteredAll.map(item => (
              <div key={item.id} className="flex items-center justify-between border-b border-bg py-1.5 text-sm text-text-muted">
                <span>{item.name} <em className="text-xs text-text-dim">{CATALOG_TYPES[item.type]?.label ?? item.type}</em>{item.is_canonical && <CanonBadge className="ml-1.5" />}</span>
                <button className="min-h-9 rounded border border-border px-2.5 py-1.5 text-sm text-accent" onClick={() => { onAdd(item.id); setShowPicker(false); }}>+</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {['weapon', 'armor', 'artifact', 'item'].map(type => {
        const items = equipment.filter(e => (e.item || allEquipment.find(a => a.id === e.equipment_id))?.type === type);
        if (!items.length) return null;
        return (
          <div key={type} className="mb-6">
            <div className="mb-2.5 border-b border-border pb-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-gold">{CATALOG_TYPES[type].label}</span>
            </div>
            {items.map(entry => (
              <EquipmentItem key={entry.equipment_id} entry={entry}
                item={entry.item || allEquipment.find(a => a.id === entry.equipment_id)}
                is_owner={is_owner}
                onRemove={() => onRemove(entry.equipment_id)}
                onPatch={patch => onPatch(entry.equipment_id, patch)}
              />
            ))}
          </div>
        );
      })}

      {equipment.length === 0 && !showPicker && (
        <p className="my-2 text-sm text-text-dim">Спорядження відсутнє</p>
      )}
    </div>
  );
}

function EquipmentItem({ entry, item, is_owner, onRemove, onPatch }) {
  return (
    <div className="mb-1.5 flex items-center gap-3 rounded-md border border-border bg-bg px-3 py-2.5">
      <Link to={item ? `${item.type === 'artifact' ? '/artifacts' : '/equipment'}/${item.id}` : '#'} className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm text-text">{item?.name ?? '(невідоме)'}</span>
        <span className="text-xs text-text-dim">
          {[item?.damage_die && `Шкода: ${item.damage_die}`, item?.defense_value != null && `Захист: ${item.defense_value}`].filter(Boolean).join(' · ')}
        </span>
      </Link>

      {item?.type === 'weapon' && item.damage_die && (
        <RollButton formula={`1${item.damage_die}`} title={`Кинути ${item.damage_die}`} />
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

// ── ManeuversTab (fighter) ──────────────────────────────────────────────────

function ManeuversTab({ maneuvers, allManeuvers, is_owner, onAdd, onRemove, unlockedNodeIds }) {
  const [search, setSearch]         = useState('');
  const [scope, setScope]           = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const knownIds    = new Set(maneuvers.map(m => m.maneuver_id));
  const filteredAll = allManeuvers.filter(m =>
    !knownIds.has(m.id) &&
    matchesScope(m, scope) &&
    m.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {is_owner && (
        <div className="mb-5 flex items-center justify-between">
          <button className="min-h-9 rounded border border-border px-4 py-1.5 text-sm text-accent" onClick={() => setShowPicker(!showPicker)}>
            {showPicker ? '✕ Закрити' : '+ Додати маневр'}
          </button>
          <Link to="/maneuvers" className="text-sm text-accent">Увесь каталог →</Link>
        </div>
      )}

      {showPicker && (
        <div className="mb-4 rounded-md border border-border bg-bg p-3">
          <input className={`${inputClass} mb-2 text-sm`} placeholder="Пошук..." value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <ScopeFilter scope={scope} onChange={setScope} size="sm" className="mb-2" />
          <div className="max-h-[220px] overflow-y-auto">
            {filteredAll.length === 0 && <p className="my-2 text-sm text-text-dim">Немає доступних маневрів</p>}
            {filteredAll.map(m => {
              const met = prereqMet(m, unlockedNodeIds);
              return (
                <div key={m.id} className="flex items-center justify-between border-b border-bg py-1.5 text-sm text-text-muted">
                  <div className="flex flex-col">
                    <span>{m.name} <em className="text-xs text-text-dim">{m.duration_actions} {m.duration_actions === 1 ? 'дія' : 'дії'}</em>{m.is_canonical && <CanonBadge className="ml-1.5" />}</span>
                    {!met && <span className="text-xs text-text-dim">{missingPrereqLabel(m)}</span>}
                  </div>
                  <button
                    className="min-h-9 rounded border border-border px-2.5 py-1.5 text-sm text-accent disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!met}
                    onClick={() => { onAdd(m.id); setShowPicker(false); }}
                  >+</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {maneuvers.length === 0 && !showPicker && <p className="text-sm text-text-dim">Маневрів ще немає</p>}
      {maneuvers.map(entry => {
        const m = entry.maneuver || allManeuvers.find(x => x.id === entry.maneuver_id);
        const met = !m || prereqMet(m, unlockedNodeIds);
        return (
          <div key={entry.maneuver_id} className="mb-1.5 flex items-start gap-3 rounded-md border border-border bg-bg px-3 py-2.5">
            <Link to={m ? `/maneuvers/${m.id}` : '#'} className="flex flex-1 flex-col gap-0.5">
              <span className="text-sm text-text">
                {m?.name ?? '(невідоме)'}
                {m && <span className="text-xs text-text-dim"> — {m.duration_actions} {m.duration_actions === 1 ? 'дія' : 'дії'}</span>}
              </span>
              {m?.description && <span className="text-xs text-text-dim">{m.description}</span>}
              {!met && <span className="text-xs text-danger">⚠ вимоги дерева розвитку більше не виконані</span>}
            </Link>
            {is_owner && (
              <button className="flex h-9 w-9 items-center justify-center text-sm text-danger" onClick={() => onRemove(entry.maneuver_id)}>✕</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── AbilitiesTab (вміння, all archetypes) ───────────────────────────────────
// Same reference-table pattern as maneuvers/equipment, but the picker is
// scoped to catalog entries whose `archetypes` checkboxes include this
// character's archetype, enforcing the per-archetype restriction set when
// the ability was created.
function AbilitiesTab({ abilities, allAbilities, archetype, is_owner, onAdd, onRemove, unlockedNodeIds }) {
  const [search, setSearch]         = useState('');
  const [scope, setScope]           = useState('');
  const [showPicker, setShowPicker] = useState(false);

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
              return (
                <div key={a.id} className="flex items-center justify-between border-b border-bg py-1.5 text-sm text-text-muted">
                  <div className="flex flex-col">
                    <span>{a.name}{a.is_canonical && <CanonBadge className="ml-1.5" />}</span>
                    {!met && <span className="text-xs text-text-dim">{missingPrereqLabel(a)}</span>}
                  </div>
                  <button
                    className="min-h-9 rounded border border-border px-2.5 py-1.5 text-sm text-accent disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!met}
                    onClick={() => { onAdd(a.id); setShowPicker(false); }}
                  >+</button>
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
          <div key={entry.ability_id} className="mb-1.5 flex items-start gap-3 rounded-md border border-border bg-bg px-3 py-2.5">
            <Link to={a ? `/abilities/${a.id}` : '#'} className="flex flex-1 flex-col gap-0.5">
              <span className="text-sm text-text">{a?.name ?? '(невідоме)'}</span>
              {a?.description && <span className="text-xs text-text-dim">{a.description}</span>}
              {!met && <span className="text-xs text-danger">⚠ вимоги дерева розвитку більше не виконані</span>}
            </Link>
            {is_owner && (
              <button className="flex h-9 w-9 items-center justify-center text-sm text-danger" onClick={() => onRemove(entry.ability_id)}>✕</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── RitualsTab (spellcaster) ────────────────────────────────────────────────

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

// ── TreeTab ───────────────────────────────────────────────────────────────────

const TREE_NODE_R = 28;

function getEffectiveRace(c) {
  return c.race === 'sangvi' ? (c.race_ancestry || 'human') : c.race;
}

function TreeTab({ c, tree, nephilimBreakthroughs, is_owner, patchCharacter, onUnlock, onLock, onUseBreakthrough, allAbilities, allSpells, allManeuvers }) {
  const [nodes, setNodes]               = useState([]);
  const [edges, setEdges]               = useState([]);
  const [treeLoading, setTreeLoading]   = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const panZoom = useSvgPanZoom({ initial: { x: 80, y: 80, k: 0.85 }, maxK: 3 });
  const { transform, setTransform } = panZoom;
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft]   = useState('');
  const svgRef   = useRef(null);
  const pendingCenterRef = useRef(false); // armed on load so the next render centers on the root node

  useEffect(() => {
    pendingCenterRef.current = true;
    Promise.all([
      skillTreeApi.getNodes({ archetype: c.archetype }),
      skillTreeApi.getEdges({ archetype: c.archetype }),
    ])
      .then(([n, e]) => { setNodes(n); setEdges(e); })
      .catch(() => {})
      .finally(() => setTreeLoading(false));
  }, []);

  // Centers the camera on the root node once the tree loads, so opening this
  // tab never leaves the player staring at empty canvas because the node
  // graph sits away from the fixed default {x:80,y:80} origin.
  useEffect(() => {
    if (!pendingCenterRef.current || treeLoading || !svgRef.current || nodes.length === 0) return;
    const root = nodes.find((n) => n.is_root) || nodes[0];
    const rect = svgRef.current.getBoundingClientRect();
    setTransform((t) => ({
      ...t,
      x: rect.width / 2 - root.pos_x * t.k,
      y: rect.height / 2 - root.pos_y * t.k,
    }));
    pendingCenterRef.current = false;
  }, [nodes, treeLoading, setTransform]);

  const effectiveRace  = getEffectiveRace(c);
  const isNephilimRace = effectiveRace === 'nephilim';
  const canSeeBridges  = effectiveRace === 'gnome' || effectiveRace === 'dwarf';

  // ── Node visibility by race ──
  let visibleNodes;
  if (effectiveRace === 'elf') {
    visibleNodes = nodes.filter(n => !n.races?.length || n.races.includes('elf'));
  } else if (effectiveRace === 'other') {
    const replacedIds = new Set(
      nodes.filter(n => n.races?.includes('other') && n.replaces_node_id).map(n => n.replaces_node_id)
    );
    visibleNodes = nodes.filter(n => n.races?.includes('other') || (!n.races?.length && !replacedIds.has(n.id)));
  } else {
    visibleNodes = nodes.filter(n => !n.races?.length || n.races.includes(effectiveRace));
  }
  const visibleIdSet = new Set(visibleNodes.map(n => n.id));

  // ── Edge visibility ──
  const visibleEdges = edges.filter(e => {
    if (!visibleIdSet.has(e.source_id) || !visibleIdSet.has(e.target_id)) return false;
    if (e.edge_type === 'bridge' && !canSeeBridges) return false;
    return true;
  });

  // ── Unlocked set (root nodes auto-included) ──
  const rootNodeIds = new Set(visibleNodes.filter(n => n.is_root).map(n => n.id));
  const unlockedIds = new Set([...(tree || []).map(t => t.node_id), ...rootNodeIds]);

  // ── Nephilim breakthroughs (skipped nodes — purely visual, not treated as unlocked) ──
  const breakthroughSet        = new Set(nephilimBreakthroughs || []);
  const earnedBreakthroughs = isNephilimRace
    ? Math.max(0, Math.floor((-9 + Math.sqrt(81 + 8 * unlockedIds.size)) / 2))
    : 0;
  const availableBreakthroughs = isNephilimRace
    ? Math.max(0, earnedBreakthroughs - breakthroughSet.size)
    : 0;
  const nextBreakthroughThreshold = isNephilimRace
    ? (earnedBreakthroughs + 1) * (earnedBreakthroughs + 10) / 2
    : 0;
  const nodesUntilNextBreakthrough = isNephilimRace
    ? nextBreakthroughThreshold - unlockedIds.size
    : 0;

  const budget    = c.dev_points || 0;
  const spent     = visibleNodes.filter(n => unlockedIds.has(n.id) && !n.is_root).reduce((s, n) => s + (n.cost || 0), 0);
  const remaining = budget - spent;

  const checkCanUnlock = (node) => {
    if (unlockedIds.has(node.id)) return { unlocked: true };

    const prereqEdges = edges.filter(e => e.target_id === node.id && e.edge_type !== 'bridge');
    let prereqsMet = true;
    if (prereqEdges.length > 0) {
      const required = prereqEdges.filter(e => e.edge_type === 'required');
      const optional = prereqEdges.filter(e => e.edge_type === 'optional');
      prereqsMet =
        required.every(e => unlockedIds.has(e.source_id)) &&
        (optional.length === 0 || optional.some(e => unlockedIds.has(e.source_id)));
    }

    // Breakthrough: skip exactly one unmet required prereq (nephilim only, own archetype)
    let breakthrough = null;
    if (isNephilimRace && availableBreakthroughs > 0 && !prereqsMet) {
      const required = prereqEdges.filter(e => e.edge_type === 'required');
      const unmet    = required.filter(e => !unlockedIds.has(e.source_id));
      if (unmet.length === 1) {
        const skippedId   = unmet[0].source_id;
        if (!breakthroughSet.has(skippedId)) {
          const skippedReqs = edges.filter(e => e.target_id === skippedId && e.edge_type === 'required');
          if (skippedReqs.every(e => unlockedIds.has(e.source_id))) {
            breakthrough = { skippedNodeId: skippedId };
          }
        }
      }
    }

    const hasPoints    = node.cost > 0;
    const hasNarrative = !!node.narrative_condition;
    const requireBoth  = !!node.require_both;

    let points = false, narrative = false, bothAvail = false;
    if (prereqsMet) {
      if (requireBoth && hasPoints && hasNarrative) {
        bothAvail = node.cost <= remaining;
      } else {
        points    = hasPoints    && node.cost <= remaining;
        narrative = hasNarrative;
      }
    }

    return { unlocked: false, prereqsMet, points, narrative, bothAvail, breakthrough };
  };

  // Human redistribution: can manually revoke any terminal (leaf) unlocked node
  const selectedIsTerminal = selectedNode &&
    unlockedIds.has(selectedNode.id) &&
    !selectedNode.is_root &&
    edges.filter(e => e.source_id === selectedNode.id && e.edge_type !== 'bridge')
         .every(e => !unlockedIds.has(e.target_id));
  const canRevoke = is_owner && effectiveRace === 'human' && !!selectedIsTerminal;

  // ── Handlers ──
  const handleUnlock = async (nodeId) => {
    await onUnlock(nodeId);
    setSelectedNode(null);
  };

  const handleBreakthrough = async (targetNodeId, skippedNodeId) => {
    await onUseBreakthrough(skippedNodeId);
    await onUnlock(skippedNodeId);
    await onUnlock(targetNodeId);
    setSelectedNode(null);
  };

  // ── Pan/zoom (mouse-drag/wheel or touch-drag/pinch) ──
  const handleSvgPointerDown = (e) => {
    if (e.button !== 0) return;
    const tag = e.target.tagName;
    if (tag === 'circle' || tag === 'text') return;
    panZoom.bind.onPointerDown(e);
  };

  const edgePoints = (srcId, dstId) => {
    const s = visibleNodes.find(n => n.id === srcId);
    const d = visibleNodes.find(n => n.id === dstId);
    if (!s || !d) return null;
    const dx = d.pos_x - s.pos_x, dy = d.pos_y - s.pos_y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return null;
    const nx = dx / dist, ny = dy / dist;
    return {
      x1: s.pos_x + nx * TREE_NODE_R, y1: s.pos_y + ny * TREE_NODE_R,
      x2: d.pos_x - nx * (TREE_NODE_R + 5), y2: d.pos_y - ny * (TREE_NODE_R + 5),
    };
  };

  const commitBudget = () => {
    const val = Math.max(0, parseInt(budgetDraft) || 0);
    patchCharacter({ dev_points: val });
    setEditingBudget(false);
  };

  if (treeLoading) return <p className="py-4 text-text-dim">Завантаження дерева...</p>;

  return (
    <div className="flex flex-col gap-3">

      {/* Budget bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm uppercase tracking-wide text-text-dim">Очки розвитку:</span>
            {is_owner && editingBudget ? (
              <input
                autoFocus
                type="number" min={0} value={budgetDraft}
                className="w-[60px] border-0 border-b-2 border-gold bg-transparent text-center text-base font-bold text-gold outline-none"
                onChange={e => setBudgetDraft(e.target.value)}
                onBlur={commitBudget}
                onKeyDown={e => { if (e.key === 'Enter') commitBudget(); if (e.key === 'Escape') setEditingBudget(false); }}
              />
            ) : (
              <span
                className={`text-lg font-bold text-gold ${is_owner ? 'cursor-pointer underline decoration-dotted' : 'cursor-default'}`}
                onClick={() => { if (!is_owner) return; setBudgetDraft(String(budget)); setEditingBudget(true); }}
                title={is_owner ? 'Натисни щоб змінити' : undefined}
              >
                {budget}
              </span>
            )}
            <span className="text-sm text-border">·</span>
            <span className="text-sm text-text-dim">Витрачено: <strong className="text-danger">{spent}</strong></span>
            <span className="text-sm text-border">·</span>
            <span className="text-sm text-text-dim">
              Залишилось: <strong className={remaining >= 0 ? 'text-sage' : 'text-danger'}>{remaining}</strong>
            </span>
            {isNephilimRace && (
              <>
                <span className="text-sm text-border">·</span>
                <span className="text-sm text-text-dim">
                  Прориви: <strong className={availableBreakthroughs > 0 ? 'text-accent' : 'text-text-dim'}>{availableBreakthroughs}</strong>
                </span>
                <span className="text-sm text-border">·</span>
                <span className="text-sm text-text-dim">
                  До прориву: <strong className="text-accent">{nodesUntilNextBreakthrough}</strong>
                </span>
              </>
            )}
          </div>
          {RACES[c.race] && (
            <span className="rounded border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs text-accent">{RACES[c.race].ability}</span>
          )}
        </div>

      {/* Canvas */}
      <div className="relative h-[520px] overflow-hidden rounded-lg border border-border bg-surface">
        <svg
          ref={svgRef}
          className="block h-full w-full select-none touch-none"
          style={{ cursor: 'grab' }}
          onPointerDown={handleSvgPointerDown}
          onPointerMove={panZoom.bind.onPointerMove}
          onPointerUp={panZoom.bind.onPointerUp}
          onPointerCancel={panZoom.bind.onPointerCancel}
          onWheel={panZoom.bind.onWheel}
          onClick={() => setSelectedNode(null)}
        >
          <defs>
            <marker id="tree-tab-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill="#8a6a3e" />
            </marker>
            <marker id="tree-tab-arrow-bridge" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill="#3d2350" />
            </marker>
          </defs>
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {visibleEdges.map(edge => {
              const pts = edgePoints(edge.source_id, edge.target_id);
              if (!pts) return null;
              const srcUnlocked = unlockedIds.has(edge.source_id);
              const dstUnlocked = unlockedIds.has(edge.target_id);
              const bothUnlocked = srcUnlocked && dstUnlocked;
              const isBridge   = edge.edge_type === 'bridge';
              const isOptional = edge.edge_type === 'optional';
              const stroke = bothUnlocked ? '#3f5b3a'
                : isBridge   ? '#3d2350'
                : isOptional ? '#a68a55'
                : '#8a6a3e';
              return (
                <line key={edge.id}
                  x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}
                  stroke={stroke}
                  strokeWidth={isBridge || isOptional ? 1.5 : 2}
                  strokeDasharray={isBridge ? '8,3' : isOptional ? '5,4' : undefined}
                  markerEnd={isBridge ? 'url(#tree-tab-arrow-bridge)' : 'url(#tree-tab-arrow)'}
                  style={{ pointerEvents: 'none' }}
                />
              );
            })}

            {visibleNodes.map(node => {
              const unlocked   = unlockedIds.has(node.id);
              const skipped    = !unlocked && breakthroughSet.has(node.id);
              const selected   = selectedNode?.id === node.id;
              const avail      = checkCanUnlock(node);
              const stroke = selected   ? '#5b440a'
                : unlocked  ? '#3f5b3a'
                : skipped   ? '#5a3a6a'
                : avail.points      ? '#8a5a2b'
                : avail.narrative   ? '#5a3a6a'
                : avail.breakthrough ? '#3d2350'
                : '#b5ab91';
              const fill      = unlocked ? '#dce8d6' : skipped ? '#e3d6e8' : '#f4efe4';
              const textColor = unlocked ? '#3f5b3a' : skipped ? '#5a3a6a' : '#5b440a';

              return (
                <g key={node.id}
                  transform={`translate(${node.pos_x},${node.pos_y})`}
                  style={{ cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); setSelectedNode(prev => prev?.id === node.id ? null : node); }}
                >
                  <circle r={TREE_NODE_R} fill={fill}
                    stroke={stroke} strokeWidth={selected || unlocked || skipped ? 2.5 : 1.5} />
                  {unlocked && !node.is_root && (
                    <circle r={TREE_NODE_R + 4} fill="none" stroke="#3f5b3a"
                      strokeWidth={1} opacity={0.25} style={{ pointerEvents: 'none' }} />
                  )}
                  {node.is_root && (
                    <circle r={TREE_NODE_R + 4} fill="none" stroke="#8a5a2b"
                      strokeWidth={1} opacity={0.35} style={{ pointerEvents: 'none' }} />
                  )}
                  <text x={0} y={node.icon ? 9 : 6} textAnchor="middle"
                    fontSize={node.icon ? 20 : 13} fill={textColor}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {node.icon || node.title.substring(0, 2)}
                  </text>
                  <text x={TREE_NODE_R + 8} y={4} textAnchor="start" fontSize={12}
                    fill={textColor} fontWeight={selected || unlocked ? 700 : 400}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {node.title.length > 18 ? node.title.slice(0, 16) + '…' : node.title}
                  </text>
                  <text x={TREE_NODE_R + 8} y={18} textAnchor="start" fontSize={9}
                    fill={unlocked ? '#3f5b3a' : skipped ? '#5a3a6a' : '#8a6a3e'}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {unlocked ? (node.is_root ? '★ корінь' : '✓ відкрито')
                      : skipped ? '↷ пропущено'
                      : node.cost > 0 && node.narrative_condition ? `${node.cost} оч. або наратив`
                      : node.cost > 0 ? `${node.cost} ${node.cost === 1 ? 'очко' : 'очків'}`
                      : 'наратив'}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {visibleNodes.length === 0 && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-text-dim">
            {nodes.length === 0 ? 'Дерево розвитку ще порожнє' : 'Немає вузлів для цього архетипу'}
          </div>
        )}

        {selectedNode && (
          <TreeNodePanel
            node={selectedNode}
            nodes={visibleNodes}
            edges={edges}
            unlocked={unlockedIds.has(selectedNode.id)}
            skipped={breakthroughSet.has(selectedNode.id)}
            canUnlock={checkCanUnlock(selectedNode)}
            availableBreakthroughs={availableBreakthroughs}
            is_owner={is_owner}
            canRevoke={canRevoke}
            onUnlock={() => handleUnlock(selectedNode.id)}
            onLock={() => { onLock(selectedNode.id); setSelectedNode(null); }}
            onBreakthrough={(skippedNodeId) => handleBreakthrough(selectedNode.id, skippedNodeId)}
            onClose={() => setSelectedNode(null)}
            allAbilities={allAbilities}
            allSpells={allSpells}
            allManeuvers={allManeuvers}
          />
        )}
      </div>
    </div>
  );
}

function TreeNodePanel({ node, nodes, edges, unlocked, skipped, canUnlock, availableBreakthroughs, is_owner, canRevoke, onUnlock, onLock, onBreakthrough, onClose, allAbilities, allSpells, allManeuvers }) {
  const prereqEdges = edges.filter(e => e.target_id === node.id && e.edge_type !== 'bridge');
  const prereqs = prereqEdges
    .map(e => ({ node: nodes.find(n => n.id === e.source_id), type: e.edge_type }))
    .filter(x => x.node);

  const unlockedAbilities = (allAbilities || []).filter(a => (a.prerequisite_node_ids || []).includes(node.id));
  const unlockedSpells    = (allSpells || []).filter(s => (s.prerequisite_node_ids || []).includes(node.id));
  const unlockedManeuvers = (allManeuvers || []).filter(m => (m.prerequisite_node_ids || []).includes(node.id));

  return (
    <Sheet open onClose={onClose} title={node.icon ? `${node.icon} ${node.title}` : node.title}>
      {node.is_root && <span className="mb-2 block text-xs text-gold">★ Кореневий вузол</span>}

      {node.description && <p className="mb-1 text-sm leading-relaxed text-text-muted">{node.description}</p>}

      {node.effect && (
        <div className="mt-2 rounded-md border border-border bg-bg p-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-text-dim">Ефект</p>
          <p className="text-sm leading-relaxed text-text-muted">{node.effect}</p>
        </div>
      )}

      {unlockedAbilities.length > 0 && (
        <div className="mt-2 rounded-md border border-border bg-bg p-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-text-dim">Відкриває наступні вміння</p>
          <ul className="mt-1 list-inside list-disc text-sm leading-relaxed text-text-muted">
            {unlockedAbilities.map(a => <li key={a.id}>{a.name}</li>)}
          </ul>
        </div>
      )}

      {unlockedSpells.length > 0 && (
        <div className="mt-2 rounded-md border border-border bg-bg p-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-text-dim">Відкриває наступні заклинання</p>
          <ul className="mt-1 list-inside list-disc text-sm leading-relaxed text-text-muted">
            {unlockedSpells.map(s => <li key={s.id}>{s.name}</li>)}
          </ul>
        </div>
      )}

      {unlockedManeuvers.length > 0 && (
        <div className="mt-2 rounded-md border border-border bg-bg p-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-text-dim">Відкриває наступні маневри</p>
          <ul className="mt-1 list-inside list-disc text-sm leading-relaxed text-text-muted">
            {unlockedManeuvers.map(m => <li key={m.id}>{m.name}</li>)}
          </ul>
        </div>
      )}

      {node.narrative_condition && (
        <div className="mt-2 rounded-md border border-accent/30 bg-bg p-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-text-dim">Наративна умова</p>
          <p className="text-sm leading-relaxed text-text-muted">{node.narrative_condition}</p>
        </div>
      )}

      {prereqs.length > 0 && (
        <div className="mt-2 rounded-md border border-border bg-bg p-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-text-dim">Вимоги</p>
          <div className="mt-1 flex flex-col gap-1.5">
            {prereqs.map(({ node: n, type }) => (
              <span key={n.id} className="flex items-center gap-1.5 text-sm">
                <span className={`shrink-0 rounded px-1 text-[0.65rem] ${type === 'optional' ? 'bg-accent/15 text-accent' : 'bg-sage/15 text-sage'}`}>
                  {type === 'optional' ? 'АБО' : 'І'}
                </span>
                <span className="text-text-dim">{n.title}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="my-3 flex flex-wrap gap-1.5">
        {node.cost > 0 && node.narrative_condition && node.require_both ? (
          <span className="rounded border border-border bg-surface-hover px-2 py-1 text-sm text-text-dim">💰+📖 {node.cost} {node.cost === 1 ? 'очко' : 'очків'} + наратив</span>
        ) : (
          <>
            {node.cost > 0 && (
              <span className="rounded border border-border bg-surface-hover px-2 py-1 text-sm text-text-dim">💰 {node.cost} {node.cost === 1 ? 'очко' : 'очків'}</span>
            )}
            {node.narrative_condition && (
              <span className="rounded border border-accent/30 bg-accent/10 px-2 py-1 text-sm text-accent">📖 наратив</span>
            )}
          </>
        )}
        {unlocked && <span className="rounded border border-sage/30 bg-sage/10 px-2 py-1 text-sm text-sage">✓ відкрито</span>}
        {skipped  && <span className="rounded border border-accent/30 bg-accent/10 px-2 py-1 text-sm text-accent">↷ пропущено</span>}
      </div>

      {is_owner && (
        <div className="mt-1 flex flex-wrap gap-2">
          {!unlocked && !skipped && canUnlock.bothAvail && (
            <button className="min-h-9 rounded border border-sage/40 bg-sage/15 px-3 py-1.5 text-sm font-semibold text-sage" onClick={onUnlock}>
              Витратити {node.cost} {node.cost === 1 ? 'очко' : 'очків'} + наратив
            </button>
          )}
          {!unlocked && !skipped && canUnlock.points && (
            <button className="min-h-9 rounded border border-sage/40 bg-sage/15 px-3 py-1.5 text-sm font-semibold text-sage" onClick={onUnlock}>
              Витратити {node.cost} {node.cost === 1 ? 'очко' : 'очків'}
            </button>
          )}
          {!unlocked && !skipped && canUnlock.narrative && (
            <button className="min-h-9 rounded border border-accent/40 bg-accent/15 px-3 py-1.5 text-sm font-semibold text-accent" onClick={onUnlock}>
              Відкрити наративно
            </button>
          )}
          {!unlocked && !skipped && canUnlock.breakthrough && (
            <button className="min-h-9 rounded border border-accent/60 bg-accent/20 px-3 py-1.5 text-sm font-semibold text-accent" onClick={() => onBreakthrough(canUnlock.breakthrough.skippedNodeId)}>
              Прорив ({availableBreakthroughs})
            </button>
          )}
          {!unlocked && !skipped && !canUnlock.points && !canUnlock.narrative && !canUnlock.bothAvail && !canUnlock.breakthrough && (
            <span className="self-center text-sm italic text-text-dim">
              {!canUnlock.prereqsMet ? 'Вимоги не виконані' : 'Недостатньо очок'}
            </span>
          )}
          {canRevoke && (
            <button className="min-h-9 rounded border border-border px-3 py-1.5 text-sm text-text-dim" onClick={onLock}>Відкликати</button>
          )}
        </div>
      )}
    </Sheet>
  );
}

// ── NotesTab ──────────────────────────────────────────────────────────────────

function NotesTab({ c, is_owner, patchCharacter }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_1fr]">
      <div>
        <label className="mb-1 block text-xs text-text-dim">Передісторія</label>
        <textarea className={`${inputClass} w-full resize-y`} rows={10}
          value={c.backstory ?? ''}
          onChange={e => patchCharacter({ backstory: e.target.value })}
          placeholder="Розкажіть про минуле персонажа..."
          disabled={!is_owner}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-dim">Нотатки гравця</label>
        <textarea className={`${inputClass} w-full resize-y`} rows={10}
          value={c.notes ?? ''}
          onChange={e => patchCharacter({ notes: e.target.value })}
          placeholder="Квести, контакти, важливі деталі..."
          disabled={!is_owner}
        />
      </div>
    </div>
  );
}

// ── SectionTitle ──────────────────────────────────────────────────────────────

function SectionTitle({ children, className = '' }) {
  return (
    <h3 className={`m-0 mb-2.5 text-[0.78rem] font-bold uppercase tracking-wide text-gold ${className}`}>
      {children}
    </h3>
  );
}
