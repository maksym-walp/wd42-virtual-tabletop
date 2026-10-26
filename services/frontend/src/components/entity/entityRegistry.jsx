import { BookOpen, Star, Swords, Skull, UserRound, Users, CalendarDays, Map } from 'lucide-react';
import api from '../../api/client';
import npcsApi from '../../api/npcs';
import bestiaryApi from '../../api/bestiary';
import characterApi from '../../api/characterSheet';
import chronologyApi from '../../api/chronology';
import mapsApi from '../../api/maps';
import { COLLECTION_DOMAINS } from '../../collectionsDomains';
import { spellWithForm } from '../../constants/spellbook';
import { abilityWithForm } from '../../constants/abilities';
import { ARCHETYPES } from '../../constants/characterSheet';
import { raceLabel } from '../../utils/characterRace';
import { resolveLocationVersion } from '../../constants/maps';
import { eventDateRangeLabel } from '../../utils/chronologyEvent';
import { cached } from './memoCache';
import {
  SpellPreview, EquipmentPreview, AbilityPreview, StatBlockPreview, SimplePreview,
} from '../catalog/previews';

// Реєстр записів сайту, на які можна посилатися з rich-text полів: для
// кожного виду — сервіс (іконка), шлях сторінки, як завантажити запис і яке
// прев'ю показати при наведенні. Усе, що стосується внутрішніх посилань
// (парсинг href, чіп, картка, пошук для пікера й «@»), спирається на цей файл —
// новий вид записів додається тут одним рядком.

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

// Іконки сервісів — ті самі, що в навігації (constants/navigation.js).
export const SERVICE_ICONS = {
  spellbook: BookOpen,
  equipment: Swords,
  abilities: Star,
  bestiary: Skull,
  npcs: UserRound,
  characters: Users,
  chronology: CalendarDays,
  maps: Map,
};

// Дані календаря, спільні для події-прев'ю й пошуку подій (один кеш на обох).
export const calendarEvents = (calId, campaignId) => cached(
  `cal:${calId}:events:${campaignId || ''}`,
  () => chronologyApi.listEvents(calId, campaignId || undefined),
);

const notFound = () => Object.assign(new Error('Не знайдено'), { response: { status: 404 } });
const isUuid = (v) => !!v && new RegExp(`^${UUID}$`, 'i').test(v);

const collectionKind = (domainKey, label) => {
  const domain = COLLECTION_DOMAINS[domainKey];
  return {
    service: domainKey,
    label: `Колекція · ${label}`,
    basePath: `${domain.basePath}/collections`,
    fetch: (id) => domain.collectionsApi.getOne(id),
    Preview: ({ data }) => (
      <SimplePreview
        image={data.image_url}
        imageCrop={data.image_crop}
        badges={['Колекція', domain.title]}
        title={data.name}
        subtitle={data.owner_username ? `@${data.owner_username}` : null}
        description={data.description}
      />
    ),
  };
};

export const ENTITY_KINDS = {
  spell: {
    service: 'spellbook',
    label: 'Заклинання',
    basePath: '/spellbook',
    fetch: (id) => api.get(`/api/spellbook/${id}`).then(({ data }) => data.spell),
    withForm: spellWithForm,
    Preview: ({ data }) => <SpellPreview spell={data} />,
  },
  equipment: {
    service: 'equipment',
    label: 'Спорядження',
    basePath: '/equipment',
    fetch: (id) => api.get(`/api/equipment/${id}`).then(({ data }) => data.item),
    Preview: ({ data }) => <EquipmentPreview item={data} />,
  },
  artifact: {
    service: 'equipment',
    label: 'Артефакт',
    basePath: '/equipment/artifacts',
    fetch: (id) => api.get(`/api/equipment/artifacts/${id}`).then(({ data }) => data.item),
    Preview: ({ data }) => <EquipmentPreview item={data} artifact />,
  },
  ability: {
    service: 'abilities',
    label: 'Вміння',
    basePath: '/abilities',
    fetch: (id) => api.get(`/api/abilities/${id}`).then(({ data }) => data.ability),
    withForm: abilityWithForm,
    Preview: ({ data }) => <AbilityPreview ability={data} />,
  },
  npc: {
    service: 'npcs',
    label: 'НІП',
    basePath: '/npcs',
    fetch: (id) => npcsApi.get(id),
    Preview: ({ data }) => <StatBlockPreview kind="npc" entry={data} />,
  },
  creature: {
    service: 'bestiary',
    label: 'Істота',
    basePath: '/bestiary',
    fetch: (id) => bestiaryApi.get(id),
    Preview: ({ data }) => <StatBlockPreview kind="creature" entry={data} />,
  },
  character: {
    service: 'characters',
    label: 'Персонаж',
    basePath: '/characters',
    fetch: (id) => characterApi.getSheet(id).then((sheet) => sheet.character),
    Preview: ({ data }) => (
      <SimplePreview
        badges={['Персонаж', ARCHETYPES[data.archetype]?.label, raceLabel(data) || undefined]}
        title={data.name}
        subtitle={data.owner_username ? `@${data.owner_username}` : null}
      />
    ),
  },
  faction: {
    service: 'npcs',
    label: 'Фракція',
    basePath: '/npcs/factions',
    fetch: (id) => npcsApi.getFaction(id),
    Preview: ({ data }) => (
      <SimplePreview
        image={data.symbol_url}
        badges={['Фракція']}
        title={data.name}
        subtitle={data.owner_username ? `@${data.owner_username}` : null}
        description={data.description}
      />
    ),
  },
  location: {
    service: 'maps',
    label: 'Локація',
    basePath: '/locations',
    // Назва/опис/типи — з базової версії (без «поточного року» мапи).
    fetch: async (id) => {
      const loc = await mapsApi.getLocation(id);
      const version = resolveLocationVersion(loc.versions, null);
      const types = version && version.types != null ? version.types : (loc.types || []);
      return { ...loc, name: version?.name || loc.name, version, types };
    },
    Preview: ({ data }) => (
      <SimplePreview
        image={data.version?.image_url}
        badges={['Локація', ...data.types]}
        title={data.name}
        description={data.version?.description}
      />
    ),
  },
  // Подія хронології: id тут складений — `календар:подія[:кампанія]` (так він
  // зберігається в посиланнях у текстах), а посилання веде на сторінку події
  // /chronology/<календар>/events/<подія>. Старі посилання на вкладку «Події»
  // календаря з ?event=… теж розпізнаються. Кампанія потрібна лише подіям кампанії.
  event: {
    service: 'chronology',
    label: 'Подія',
    parse(url, path) {
      const page = new RegExp(`^/chronology/(${UUID})/events/(${UUID})$`, 'i').exec(path);
      const m = page || new RegExp(`^/chronology/(${UUID})/events$`, 'i').exec(path);
      const eventId = page ? page[2] : url.searchParams.get('event');
      if (!m || !isUuid(eventId)) return null;
      const campaign = url.searchParams.get('campaign_id');
      return { id: [m[1], eventId, isUuid(campaign) ? campaign : null].filter(Boolean).join(':').toLowerCase(), form: null };
    },
    href(id) {
      const [calId, eventId, campaignId] = id.split(':');
      return `/chronology/${calId}/events/${eventId}${campaignId ? `?campaign_id=${campaignId}` : ''}`;
    },
    async fetch(id) {
      const [calId, eventId, campaignId] = id.split(':');
      const [calendar, months, events] = await Promise.all([
        cached(`cal:${calId}`, () => chronologyApi.getOne(calId)),
        cached(`cal:${calId}:months`, () => chronologyApi.listMonths(calId)),
        calendarEvents(calId, campaignId),
      ]);
      const event = events.find((e) => e.id === eventId);
      if (!event) throw notFound();
      let place = event.region || null;
      if (!place && event.location_id) {
        place = await cached(`raw:location:${event.location_id}`, () => mapsApi.getLocation(event.location_id))
          .then((l) => l.name).catch(() => null);
      }
      return { ...event, calendar, months, place };
    },
    Preview: ({ data }) => {
      const when = eventDateRangeLabel(data, data.months, data.calendar.current_era_name, data.calendar.previous_era_name);
      return (
        <SimplePreview
          badges={['Подія', data.calendar.name]}
          title={data.name}
          subtitle={[when, data.place].filter(Boolean).join(' · ')}
          description={data.description}
        />
      );
    },
  },
  spell_collection: collectionKind('spellbook', 'заклинання'),
  equipment_collection: collectionKind('equipment', 'спорядження'),
  ability_collection: collectionKind('abilities', 'вміння'),
  creature_collection: collectionKind('bestiary', 'бестіарій'),
  npc_collection: collectionKind('npcs', 'НІПи'),
};

// Типовий вид — одна сторінка `${basePath}/<uuid>` (+ ?form=…); подія задає
// parse/href сама.
for (const def of Object.values(ENTITY_KINDS)) {
  def.icon = SERVICE_ICONS[def.service];
  if (!def.basePath) continue;
  def.pattern = new RegExp(`^${def.basePath}/(${UUID})$`, 'i');
  def.parse = (url, path) => {
    const m = def.pattern.exec(path);
    if (!m) return null;
    const form = url.searchParams.get('form');
    return { id: m[1].toLowerCase(), form: form && form !== 'main' ? form : null };
  };
  def.href = (id, form) => `${def.basePath}/${id}${form ? `?form=${encodeURIComponent(form)}` : ''}`;
}

// form — ключ форми запису (?form=…), якщо посилання веде на конкретну.
export function entityHref(kind, id, form) {
  const def = ENTITY_KINDS[kind];
  return def ? def.href(id, form) : '#';
}

// href → { kind, id, form } або null, якщо це не сторінка запису нашого
// сайту (чужий домен, список, форма редагування, публічна колекція тощо).
export function parseEntityHref(href) {
  if (!href || typeof href !== 'string') return null;
  let url;
  try {
    url = new URL(href.trim(), window.location.origin);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  const path = url.pathname.replace(/\/+$/, '');
  for (const [kind, def] of Object.entries(ENTITY_KINDS)) {
    const parsed = def.parse(url, path);
    if (parsed) return { kind, ...parsed };
  }
  return null;
}
