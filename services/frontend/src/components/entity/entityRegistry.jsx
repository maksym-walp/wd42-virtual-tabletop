import { BookOpen, Star, Swords, Skull, UserRound } from 'lucide-react';
import api from '../../api/client';
import npcsApi from '../../api/npcs';
import bestiaryApi from '../../api/bestiary';
import { COLLECTION_DOMAINS } from '../../collectionsDomains';
import { spellWithForm } from '../../constants/spellbook';
import { abilityWithForm } from '../../constants/abilities';
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
};

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
  spell_collection: collectionKind('spellbook', 'заклинання'),
  equipment_collection: collectionKind('equipment', 'спорядження'),
  ability_collection: collectionKind('abilities', 'вміння'),
  creature_collection: collectionKind('bestiary', 'бестіарій'),
  npc_collection: collectionKind('npcs', 'НІПи'),
};

for (const def of Object.values(ENTITY_KINDS)) {
  def.icon = SERVICE_ICONS[def.service];
  def.pattern = new RegExp(`^${def.basePath}/(${UUID})$`, 'i');
}

// form — ключ форми запису (?form=…), якщо посилання веде на конкретну.
export function entityHref(kind, id, form) {
  const def = ENTITY_KINDS[kind];
  if (!def) return '#';
  return `${def.basePath}/${id}${form ? `?form=${encodeURIComponent(form)}` : ''}`;
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
    const m = def.pattern.exec(path);
    if (m) {
      const form = url.searchParams.get('form');
      return { kind, id: m[1].toLowerCase(), form: form && form !== 'main' ? form : null };
    }
  }
  return null;
}
