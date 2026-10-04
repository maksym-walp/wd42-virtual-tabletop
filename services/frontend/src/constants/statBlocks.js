import npcsApi from '../api/npcs';
import bestiaryApi from '../api/bestiary';

// The two stat-block record kinds — NPCs (npcs service) and creatures
// (bestiary service). They share one shape (attributes, derived skills,
// health dice, equipment/spells/abilities loadout), so the list/form/view
// pages are shared too and parameterized by one of these configs. Each kind
// talks to its own service through `api` (same method names on both:
// list/get/create/update/remove/setOwner + the loadout calls).
export const STAT_BLOCK_KINDS = {
  npc: {
    key: 'npc',
    label: 'НІП',
    listTitle: 'НІПи',
    newLabel: 'Новий НІП',
    countForms: ['НІП', 'НІПи', 'НІПів'],
    basePath: '/npcs',
    domainKey: 'npcs',
    api: npcsApi,
  },
  creature: {
    key: 'creature',
    label: 'Істота',
    listTitle: 'Бестіарій',
    newLabel: 'Нова істота',
    countForms: ['істота', 'істоти', 'істот'],
    basePath: '/bestiary',
    domainKey: 'bestiary',
    api: bestiaryApi,
  },
};

export const statBlockHref = (kind, id) => `${STAT_BLOCK_KINDS[kind].basePath}/${id}`;
