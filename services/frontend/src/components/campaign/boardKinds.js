import {
  User, PawPrint, Sparkles, Sword, Zap, Flag, MapPin, Map as MapIcon, Image as ImageIcon, StickyNote, Scroll,
} from 'lucide-react';
import api from '../../api/client';
import npcsApi from '../../api/npcs';
import bestiaryApi from '../../api/bestiary';
import spellbookApi from '../../api/spellbook';
import equipmentApi from '../../api/equipment';
import abilitiesApi from '../../api/abilities';
import mapsApi from '../../api/maps';
import { EQUIPMENT_TYPES } from '../../constants/equipment';

const EQUIPMENT_SUBTYPE_LABELS = {
  ...Object.fromEntries(Object.entries(EQUIPMENT_TYPES).map(([key, t]) => [key, t.label])),
  artifact: 'Артефакт',
};

// Спорядження в пікері: корінь /api/equipment/ віддає зброю, обладунки й
// предмети разом (з полем type), артефакти — окремий ендпоінт.
async function loadEquipment() {
  const [items, artifacts] = await Promise.all([
    equipmentApi.getAll(),
    api.get('/api/equipment/artifacts/?limit=200').then(({ data }) => data.items ?? []).catch(() => []),
  ]);
  return [
    ...items.map((e) => ({ id: e.id, name: e.name, subtype: e.type, hint: EQUIPMENT_SUBTYPE_LABELS[e.type] })),
    ...artifacts.map((a) => ({ id: a.id, name: a.name, subtype: 'artifact', hint: 'Артефакт' })),
  ];
}

const simple = (list) => list.map((e) => ({ id: e.id, name: e.name }));

// Типи записів Столу/Ширми. source — тип, що читається з каталогу (бекенд
// бере з нього знімок картки); load — список для пікера; href — сторінка
// джерела (бачить лише майстер: гравцеві приватний запис не відкриється).
export const BOARD_KINDS = {
  npc: {
    label: 'НІП', icon: User, source: true,
    load: () => npcsApi.list().then(simple),
    href: (item) => `/npcs/${item.ref_id}`,
  },
  creature: {
    label: 'Істота', icon: PawPrint, source: true,
    load: () => bestiaryApi.list().then(simple),
    href: (item) => `/bestiary/${item.ref_id}`,
  },
  spell: {
    label: 'Заклинання', icon: Sparkles, source: true,
    load: () => spellbookApi.getAll().then(simple),
    href: (item) => `/spellbook/${item.ref_id}`,
  },
  equipment: {
    label: 'Спорядження', icon: Sword, source: true,
    load: loadEquipment,
    href: (item) => (item.ref_subtype === 'artifact'
      ? `/equipment/artifacts/${item.ref_id}`
      : `/equipment/${item.ref_id}`),
  },
  ability: {
    label: 'Вміння', icon: Zap, source: true,
    load: () => abilitiesApi.getAll().then(simple),
    href: (item) => `/abilities/${item.ref_id}`,
  },
  faction: {
    label: 'Фракція', icon: Flag, source: true,
    load: () => npcsApi.listFactions().then(simple),
    href: (item) => `/npcs/factions/${item.ref_id}`,
  },
  location: {
    label: 'Локація', icon: MapPin, source: true,
    load: () => mapsApi.listLocations().then(simple),
    href: (item) => `/locations/${item.ref_id}`,
  },
  map: {
    label: 'Мапа', icon: MapIcon, source: true,
    load: () => mapsApi.list().then((maps) => maps.map((m) => ({
      id: m.id, name: m.name, hint: m.is_public ? null : 'приватна',
    }))),
    href: (item, campaignId) => `/maps/${item.ref_id}?campaign_id=${campaignId}`,
  },
  image: { label: 'Зображення', icon: ImageIcon },
  note: { label: 'Нотатка', icon: StickyNote },
  custom: { label: 'Картка', icon: Scroll },
};

// Порядок кнопок у вікні «Додати запис».
export const BOARD_KIND_ORDER = [
  'note', 'image', 'custom', 'map', 'npc', 'creature', 'spell', 'equipment', 'ability', 'faction', 'location',
];

export function kindLabel(item) {
  if (item.kind === 'equipment' && item.ref_subtype) return EQUIPMENT_SUBTYPE_LABELS[item.ref_subtype] ?? 'Спорядження';
  return BOARD_KINDS[item.kind]?.label ?? item.kind;
}
