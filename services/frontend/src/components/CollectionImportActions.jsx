import { COLLECTION_DOMAINS } from '../collectionsDomains';
import ExportImportActions from './ExportImportActions';
import useSpellKinds from '../hooks/useSpellKinds';
import useWeaponOptions from '../hooks/useWeaponOptions';
import { buildCollectionImportTemplate } from '../utils/collectionImportTemplate';
import { buildAbilitiesImportTemplate } from '../utils/abilitiesImportTemplate';
import { buildSpellbookImportTemplate } from '../utils/spellbookImportTemplate';
import { buildEquipmentImportTemplate } from '../utils/equipmentImportTemplate';
import { buildNpcsImportTemplate } from '../utils/npcsImportTemplate';
import { buildBestiaryImportTemplate } from '../utils/bestiaryImportTemplate';

// Імпорт колекцій у списку колекцій кожного каталогу: кнопка «Імпорт» з тим
// самим меню, що й у каталогах (шаблон / файл / вставити код). Шаблон
// будується з шаблону імпорту записів цього каталогу (див.
// utils/collectionImportTemplate.js).
const DOMAIN_TEXT = {
  abilities: {
    endpoint: '/api/abilities/collections/import', collectionsLabel: 'вміння', recordsLabel: 'вмінь',
    example: { name: 'Приклад: Набір бійця', description: 'Вміння для початківців-бійців' },
  },
  spellbook: {
    endpoint: '/api/spellbook/collections/import', collectionsLabel: 'заклинання', recordsLabel: 'заклинань',
    example: { name: 'Приклад: Вогняні чари', description: 'Добірка бойових заклинань вогню' },
  },
  equipment: {
    endpoint: '/api/equipment/collections/import', collectionsLabel: 'спорядження', recordsLabel: 'спорядження',
    example: { name: 'Приклад: Стартове спорядження', description: 'Набір для нового авантюриста' },
  },
  npcs: {
    endpoint: '/api/npcs/collections/import', collectionsLabel: 'НІПи', recordsLabel: 'НІПів',
    example: { name: 'Приклад: Мешканці корчми', description: 'Постійні відвідувачі й персонал' },
  },
  bestiary: {
    endpoint: '/api/bestiary/collections/import', collectionsLabel: 'бестіарій', recordsLabel: 'істот',
    example: { name: 'Приклад: Зграя вовків', description: 'Мисливці східного тракту' },
  },
};

function ImportButtons({ domainKey, recordTemplate, onImported }) {
  const domain = COLLECTION_DOMAINS[domainKey];

  const handleTemplate = () => buildCollectionImportTemplate({
    ...DOMAIN_TEXT[domainKey],
    recordTemplate: recordTemplate(),
  });

  const handleImport = async (data) => {
    if (!data || typeof data !== 'object') {
      alert('Файл має містити обʼєкт колекції або масив колекцій');
      return;
    }
    try {
      const result = await domain.collectionsApi.importMany(data);
      const parts = [`Імпортовано колекцій: ${result.collections.length}`];
      if (result.imported_items) parts.push(`записів у них: ${result.imported_items}`);
      let message = parts.join(', ');
      if (result.items_skipped) {
        message += `\nВкладені записи (${result.items_skipped}) пропущено — їх імпортує лише майстер гри чи адміністратор.`;
      }
      alert(message);
      onImported();
    } catch (err) {
      alert(err.response?.data?.message || 'Не вдалося імпортувати колекцію');
    }
  };

  return <ExportImportActions hideExport onImport={handleImport} onTemplate={handleTemplate} />;
}

// Шаблони деяких каталогів залежать від налаштувань з адмін-панелі, тож для
// них окремі обгортки з потрібним хуком (хуки не можна викликати умовно).
function SpellbookImport(props) {
  const { spellKinds } = useSpellKinds();
  return <ImportButtons {...props} recordTemplate={() => buildSpellbookImportTemplate(spellKinds)} />;
}

function EquipmentImport(props) {
  const { weaponTypes, weaponGrips } = useWeaponOptions();
  return <ImportButtons {...props} recordTemplate={() => buildEquipmentImportTemplate(weaponTypes, weaponGrips)} />;
}

const STATIC_TEMPLATES = {
  abilities: buildAbilitiesImportTemplate,
  npcs: buildNpcsImportTemplate,
  bestiary: buildBestiaryImportTemplate,
};

export default function CollectionImportActions({ domainKey, onImported }) {
  if (domainKey === 'spellbook') return <SpellbookImport domainKey={domainKey} onImported={onImported} />;
  if (domainKey === 'equipment') return <EquipmentImport domainKey={domainKey} onImported={onImported} />;
  if (!STATIC_TEMPLATES[domainKey]) return null;
  return <ImportButtons domainKey={domainKey} recordTemplate={STATIC_TEMPLATES[domainKey]} onImported={onImported} />;
}
