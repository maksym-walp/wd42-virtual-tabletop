import equipmentApi from '../api/equipment';
import { emptyComponentRow } from '../components/SpellComponentsField';

// Спільна робота з рядками компонентів у формах заклинань і вмінь: рядок
// редактора ({ key, item_id, name, quantity, unit, createAsNew }) ↔ запис на
// сервері ({ item_id, name, quantity, unit }).

export const componentsToState = (components) => (components || []).map((c) => ({ ...emptyComponentRow(), ...c }));

// Нова форма копіює компоненти основної — рядки отримують нові key, щоб форми
// не ділили стан рядка.
export const cloneComponentRows = (components) => components.map((c) => ({ ...c, key: emptyComponentRow().key }));

// Quick-create: кожен рядок, позначений «створити як новий предмет» і ще не
// привʼязаний до спорядження, створюється першим — завжди публічним, а не
// приватним предметом автора. Форми часто повторюють ті самі компоненти, тож
// один і той самий новий предмет (за назвою) створюється лише раз на всі
// форми. Повертає { 'назва малими': item_id }.
export async function createMissingComponentItems(componentLists) {
  const namesToCreate = [...new Set(
    componentLists.flat()
      .filter((c) => c.createAsNew && !c.item_id && c.name.trim())
      .map((c) => c.name.trim())
  )];
  const created = await Promise.all(
    namesToCreate.map((name) => equipmentApi.create({ name }).then((item) => [name.toLowerCase(), item.id]))
  );
  return Object.fromEntries(created);
}

export const serializeComponentRows = (components, createdIds) => components
  .filter((c) => c.name.trim() !== '')
  .map((c) => ({
    item_id: c.item_id ?? (c.createAsNew ? createdIds[c.name.trim().toLowerCase()] : null) ?? null,
    name: c.name.trim(),
    quantity: c.quantity || 1,
    unit: c.unit || '',
  }));
