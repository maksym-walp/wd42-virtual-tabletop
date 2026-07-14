import equipmentApi from './api/equipment';
import abilitiesApi from './api/abilities';
import maneuversApi from './api/maneuvers';
import spellbookApi from './api/spellbook';
import { createCollectionsApi } from './api/collections';
import { EQUIPMENT_TYPES } from './constants/equipment';
import { MAGIC_TYPES } from './constants/spellbook';

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
    itemLink: (item) => `/equipment/${item.id}`,
    itemMeta: (item) => [
      EQUIPMENT_TYPES[item.type]?.label,
      item.damage_die,
      item.defense_value != null ? `захист ${item.defense_value}` : null,
    ].filter(Boolean).join(' · '),
    // Equipment items have no prerequisite_node_ids concept of their own
    // (unlike abilities/maneuvers/spells), so equipment collections don't
    // carry a skill-tree node dependency either — nothing for it to inherit into.
    supportsPrerequisites: false,
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
    itemMeta: (item) => MAGIC_TYPES[item.magic_type]?.label ?? '',
    supportsPrerequisites: true,
  },
};
