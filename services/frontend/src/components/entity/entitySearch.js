import { useEffect, useState } from 'react';
import api from '../../api/client';
import npcsApi from '../../api/npcs';
import bestiaryApi from '../../api/bestiary';
import characterApi from '../../api/characterSheet';
import chronologyApi from '../../api/chronology';
import mapsApi from '../../api/maps';
import { COLLECTION_DOMAINS } from '../../collectionsDomains';
import { natureLabels } from '../../constants/spellbook';
import { EQUIPMENT_TYPES } from '../../constants/equipment';
import { ARCHETYPES } from '../../constants/characterSheet';
import { raceLabel } from '../../utils/characterRace';
import { calendarEvents } from './entityRegistry';
import { cached } from './memoCache';

// Пошук записів для пікера в тулбарі й автодоповнення «@». Результат —
// { kind, id, name, meta }, де kind — ключ із ENTITY_KINDS.

// Збіги з початку назви — першими, далі решта входжень.
const filterByName = (items, q, limit) => {
  const needle = q.trim().toLowerCase();
  if (!needle) return items.slice(0, limit);
  const hits = items.filter((i) => i.name?.toLowerCase().includes(needle));
  const starts = (i) => i.name.toLowerCase().startsWith(needle);
  return [...hits.filter(starts), ...hits.filter((i) => !starts(i))].slice(0, limit);
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
    key: 'characters',
    label: 'Персонажі',
    // Власні та з кампаній, де користувач майстер, + публічні персонажі спільноти.
    async search(q, limit) {
      const all = await cached('list:characters', async () => {
        const settled = await Promise.allSettled([
          characterApi.list({ includeGmCampaigns: true }),
          characterApi.listCommunity(),
        ]);
        const byId = new Map();
        for (const r of settled) {
          if (r.status === 'fulfilled') for (const c of r.value) if (!byId.has(c.id)) byId.set(c.id, c);
        }
        return [...byId.values()];
      });
      return filterByName(all, q, limit).map((c) => ({
        kind: 'character',
        id: c.id,
        name: c.name,
        meta: [ARCHETYPES[c.archetype]?.label, raceLabel(c)].filter(Boolean).join(' · '),
      }));
    },
  },
  {
    key: 'npcs',
    label: 'НІПи та фракції',
    // Бекенд не вміє пошук за назвою — беремо весь (кешований) список.
    async search(q, limit) {
      const [npcs, factions] = await Promise.all([
        cached('list:npcs', () => npcsApi.list()),
        cached('list:factions', () => npcsApi.listFactions()),
      ]);
      return [
        ...filterByName(npcs, q, limit).map((n) => ({ kind: 'npc', id: n.id, name: n.name, meta: 'НІП' })),
        ...filterByName(factions, q, limit).map((f) => ({ kind: 'faction', id: f.id, name: f.name, meta: 'Фракція' })),
      ];
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
  {
    key: 'maps',
    label: 'Локації',
    async search(q, limit) {
      const all = await cached('list:locations', () => mapsApi.listLocations());
      return filterByName(all, q, limit).map((l) => ({
        kind: 'location', id: l.id, name: l.name, meta: (l.types || []).join(' · ') || 'Локація',
      }));
    },
  },
  {
    key: 'chronology',
    label: 'Події',
    // Події — по кожному календарю окремо (лише глобальні лор-події; події
    // кампаній сюди не входять — на них можна послатися вставкою URL).
    async search(q, limit) {
      const calendars = await cached('list:calendars', () => chronologyApi.list());
      const groups = await Promise.allSettled(calendars.map(async (cal) => {
        const events = await calendarEvents(cal.id, null);
        return filterByName(events, q, limit).map((e) => ({ kind: 'event', id: `${cal.id}:${e.id}`, name: e.name, meta: cal.name }));
      }));
      return groups.flatMap((g) => (g.status === 'fulfilled' ? g.value : [])).slice(0, limit);
    },
  },
  { key: 'collections', label: 'Колекції', search: searchCollections },
];

export async function searchEntities(query, serviceKeys, limit) {
  const services = ENTITY_SERVICES.filter((s) => serviceKeys.includes(s.key));
  const groups = await Promise.allSettled(services.map((s) => s.search(query, limit)));
  const found = groups.flatMap((g) => (g.status === 'fulfilled' ? g.value : []));
  // Назви, що починаються із запиту, — вперед (інакше «@Ел» тоне в збігах
  // всередині слів із перших сервісів); порядок сервісів зберігається.
  const needle = query.trim().toLowerCase();
  if (!needle) return found;
  const rank = (r) => (r.name?.toLowerCase().startsWith(needle) ? 0 : 1);
  return found.map((r, i) => [r, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([r]) => r);
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
