import equipmentApi from './api/equipment';
import abilitiesApi from './api/abilities';
import maneuversApi from './api/maneuvers';
import spellbookApi from './api/spellbook';
import compendiumApi from './api/compendium';
import { createCollectionsApi } from './api/collections';
import { EQUIPMENT_TYPES } from './constants/equipment';
import { RARITIES } from './constants/artifacts';
import { natureLabels } from './constants/spellbook';
import { ENTITY_TYPES } from './constants/compendium';

// One config per catalog service that owns a `collections` module —
// drives the generic CollectionsList/CollectionForm/CollectionView pages
// so each domain doesn't need its own near-identical copies.
export const COLLECTION_DOMAINS = {
  equipment: {
    title: 'Спорядження',
    basePath: '/equipment',
    itemLabel: 'предметів',
    collectionsApi: createCollectionsApi('/api/equipment/collections/'),
    catalogApi: equipmentApi,
    itemIdField: 'item_id',
    // Артефакти — теж вид спорядження (item.type === 'artifact'), але з
    // власною View/Form-парою (/equipment/artifacts/:id), тож посилання на
    // них іде окремо від решти трьох видів, які веде спільний EquipmentView.
    itemLink: (item) => (item.type === 'artifact' ? `/equipment/artifacts/${item.id}` : `/equipment/${item.id}`),
    itemMeta: (item) => [
      EQUIPMENT_TYPES[item.type]?.label,
      item.damage_die,
      item.defense_value != null ? `захист ${item.defense_value}` : null,
      RARITIES[item.rarity]?.label,
      item.creator,
    ].filter(Boolean).join(' · '),
    // Equipment items have no prerequisite_node_ids concept of their own
    // (unlike abilities/maneuvers/spells), so equipment collections don't
    // carry a skill-tree node dependency either — nothing for it to inherit into.
    supportsPrerequisites: false,
    // Equipment has four browsable lists (one per type-table, artifacts
    // included since 51-merge-artifacts-into-equipment.sql) alongside
    // Колекції, same reason compendium overrides this — see getDomainTabs().
    tabs: [
      { to: '/equipment/weapon', label: 'Зброя' },
      { to: '/equipment/armor', label: 'Обладунки' },
      { to: '/equipment/items', label: 'Предмети' },
      { to: '/equipment/artifacts', label: 'Артефакти' },
      { to: '/equipment/collections', label: 'Колекції' },
    ],
  },
  abilities: {
    title: 'Вміння',
    basePath: '/abilities',
    itemLabel: 'вмінь',
    collectionsApi: createCollectionsApi('/api/abilities/collections/'),
    catalogApi: abilitiesApi,
    itemIdField: 'ability_id',
    itemLink: (item) => `/abilities/${item.id}`,
    itemMeta: (item) => (item.archetypes || []).join(', '),
    supportsPrerequisites: true,
  },
  maneuvers: {
    title: 'Маневри',
    basePath: '/maneuvers',
    itemLabel: 'маневрів',
    collectionsApi: createCollectionsApi('/api/maneuvers/collections/'),
    catalogApi: maneuversApi,
    itemIdField: 'maneuver_id',
    itemLink: (item) => `/maneuvers/${item.id}`,
    itemMeta: (item) => (item.duration_actions ? `${item.duration_actions} ${item.duration_actions === 1 ? 'дія' : 'дії'}` : ''),
    supportsPrerequisites: true,
  },
  spellbook: {
    title: 'Заклинання',
    basePath: '/spellbook',
    itemLabel: 'заклинань',
    collectionsApi: createCollectionsApi('/api/spellbook/collections/'),
    catalogApi: spellbookApi,
    itemIdField: 'spell_id',
    itemLink: (item) => `/spellbook/${item.id}`,
    itemMeta: (item) => natureLabels(item.nature),
    supportsPrerequisites: true,
    // Traditions used to be a plain button off to the side, linking out to
    // what felt like a separate page — now it's a tab alongside Колекції,
    // same reasoning as equipment/compendium's multi-tab override below.
    tabs: [
      { to: '/spellbook', label: 'Заклинання', end: true },
      { to: '/spellbook/traditions', label: 'Традиції' },
      { to: '/spellbook/collections', label: 'Колекції' },
    ],
  },
  compendium: {
    title: 'НІПи та істоти',
    basePath: '/compendium',
    itemLabel: 'записів',
    collectionsApi: createCollectionsApi('/api/compendium/collections/'),
    catalogApi: { getAll: () => compendiumApi.listEntries() },
    itemIdField: 'entry_id',
    itemLink: (item) => `/compendium/entries/${item.id}`,
    itemMeta: (item) => ENTITY_TYPES[item.entity_type]?.label ?? '',
    supportsPrerequisites: false,
    // Compendium has no "official vs community" concept anywhere in its
    // schema (unlike equipment/spellbook/maneuvers/abilities) — no
    // is_canonical column, no /canonical endpoint.
    supportsCanonical: false,
    // Compendium has more than one browsable list (NPCs vs Bestiary vs
    // Species) alongside Колекції, so it needs an explicit tab set instead
    // of the [catalog, Колекції] pair getDomainTabs() derives by default.
    tabs: [
      { to: '/compendium', label: 'НІПи', end: true },
      { to: '/compendium/bestiary', label: 'Бестіарій' },
      { to: '/compendium/species', label: 'Види' },
      { to: '/compendium/collections', label: 'Колекції' },
    ],
  },
};

// The tab bar every catalog service shows (CatalogTabs) — a domain with a
// single browsable list (abilities, maneuvers) just gets [catalog, Колекції];
// equipment/spellbook/compendium override this via their own `tabs` above
// since each has more than one list to switch between.
export function getDomainTabs(domainKey) {
  const domain = COLLECTION_DOMAINS[domainKey];
  return domain.tabs || [
    { to: domain.basePath, label: domain.title, end: true },
    { to: `${domain.basePath}/collections`, label: 'Колекції' },
  ];
}
