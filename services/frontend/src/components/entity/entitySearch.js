import { useEffect, useState } from 'react';
import api from '../../api/client';
import npcsApi from '../../api/npcs';
import bestiaryApi from '../../api/bestiary';
import { COLLECTION_DOMAINS } from '../../collectionsDomains';
import { natureLabels } from '../../constants/spellbook';
import { EQUIPMENT_TYPES } from '../../constants/equipment';
import { cached } from './entityCache';

// Пошук записів для пікера в тулбарі й автодоповнення «@». Результат —
// { kind, id, name, meta }, де kind — ключ із ENTITY_KINDS.

const filterByName = (items, q, limit) => {
  const needle = q.trim().toLowerCase();
  return (needle ? items.filter((i) => i.name?.toLowerCase().includes(needle)) : items).slice(0, limit);
};

const COLLECTION_KINDS = {
  spellbook: 'spell_collection',
  equipment: 'equipment_collection',
  abilities: 'ability_collection',
  bestiary: 'creature_collection',
  npcs: 'npc_collection',
};

async function searchCollections(q, limit) {
  const groups = await Promise.allSettled(
    Object.entries(COLLECTION_KINDS).map(async ([domainKey, kind]) => {
      const domain = COLLECTION_DOMAINS[domainKey];
      const all = await domain.collectionsApi.getAll({ search: q.trim() || undefined });
      return filterByName(all, '', limit).map((c) => ({ kind, id: c.id, name: c.name, meta: `Колекція · ${domain.title}` }));
    }),
  );
  return groups.flatMap((g) => (g.status === 'fulfilled' ? g.value : []));
}

// key — ключ сервісу (SERVICE_ICONS у entityRegistry); колекції — окрема група.
export const ENTITY_SERVICES = [
  {
    key: 'spellbook',
    label: 'Заклинання',
    async search(q, limit) {
      const { data } = await api.get('/api/spellbook/', { params: { search: q.trim() || undefined, limit } });
      return (data.spells ?? []).map((s) => ({ kind: 'spell', id: s.id, name: s.name, meta: natureLabels(s.nature) }));
    },
  },
  {
    key: 'equipment',
    label: 'Спорядження',
    async search(q, limit) {
      const { data } = await api.get('/api/equipment/', { params: { search: q.trim() || undefined, limit } });
      return (data.items ?? []).map((i) => (i.type === 'artifact'
        ? { kind: 'artifact', id: i.id, name: i.name, meta: 'Артефакт' }
        : { kind: 'equipment', id: i.id, name: i.name, meta: EQUIPMENT_TYPES[i.type]?.label }));
    },
  },
  {
    key: 'abilities',
    label: 'Вміння',
    async search(q, limit) {
      const { data } = await api.get('/api/abilities/', { params: { search: q.trim() || undefined, limit } });
      return (data.abilities ?? []).map((a) => ({
        kind: 'ability', id: a.id, name: a.name, meta: a.is_maneuver ? 'Маневр' : (a.archetypes ?? []).join(', '),
      }));
    },
  },
  {
    key: 'npcs',
    label: 'НІПи',
    // Бекенд не вміє пошук за назвою — беремо весь (кешований) список.
    async search(q, limit) {
      const all = await cached('list:npcs', () => npcsApi.list());
      return filterByName(all, q, limit).map((n) => ({ kind: 'npc', id: n.id, name: n.name, meta: 'НІП' }));
    },
  },
  {
    key: 'bestiary',
    label: 'Бестіарій',
    async search(q, limit) {
      const all = await cached('list:creatures', () => bestiaryApi.list());
      return filterByName(all, q, limit).map((c) => ({ kind: 'creature', id: c.id, name: c.name, meta: 'Істота' }));
    },
  },
  { key: 'collections', label: 'Колекції', search: searchCollections },
];

export async function searchEntities(query, serviceKeys, limit) {
  const services = ENTITY_SERVICES.filter((s) => serviceKeys.includes(s.key));
  const groups = await Promise.allSettled(services.map((s) => s.search(query, limit)));
  return groups.flatMap((g) => (g.status === 'fulfilled' ? g.value : []));
}

const ALL_KEYS = ENTITY_SERVICES.map((s) => s.key);

// Пошук із debounce; застарілі відповіді відкидаються. minLen 0 — порожній
// запит теж шукає (перші записи сервісу).
export function useEntitySearch({
  query, services = ALL_KEYS, limit = 5, minLen = 1, enabled = true,
}) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const servicesKey = services.join(',');

  useEffect(() => {
    if (!enabled || query.trim().length < minLen) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const found = await searchEntities(query, servicesKey.split(','), limit);
      if (cancelled) return;
      setResults(found);
      setLoading(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, servicesKey, limit, minLen, enabled]);

  return { results, loading };
}
