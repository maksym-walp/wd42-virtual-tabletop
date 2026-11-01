// Рівневі форми запису каталогу — однакова модель у заклинань і вмінь.
// Основна форма — поля самого запису; додаткові лежать у entry.forms як
// повні знімки полів форми (свої для кожного каталогу — `fields`) +
// { kind, id } — рівневі 'primitive'/'perfected', id = kind. Альтернативних
// форм більше не існує (міграція 117) — рівноцінні/альтернативні записи
// тепер окреме посилання на інший, самостійно заповнений запис (див.
// RelatedEntryPicker), а не вбудована форма.
//
// Ключ форми (key) — стабільний: 'main', 'primitive' або 'perfected'. Ті
// самі ключі пише вузол дерева розвитку (node_grants.form_key) і лист
// персонажа (form_tier).

// Рівневі форми по зростанню. 'full' — це основна форма запису, коли в
// нього є хоч одна інша рівнева (primitive/perfected у entry.forms).
export const FORM_TIERS = {
  primitive: { label: 'Обмежена форма' },
  full:      { label: 'Повноцінна форма' },
  perfected: { label: 'Довершена форма' },
};

export function pickFields(fields, source) {
  return Object.fromEntries(fields.map((f) => [f, source[f]]));
}

export function hasTierForms(entry) {
  return (entry?.forms || []).some((f) => f.kind === 'primitive' || f.kind === 'perfected');
}

// Наявні рівневі форми по зростанню: ['primitive', 'full', ...];
// [] — якщо рівневих форм немає.
export function entryTiers(entry) {
  if (!hasTierForms(entry)) return [];
  const kinds = (entry.forms || []).map((f) => f.kind);
  return Object.keys(FORM_TIERS).filter((t) => t === 'full' || kinds.includes(t));
}

// Усі форми одним списком у порядку показу: обмежена, основна/повноцінна,
// довершена.
export function entryForms(entry, fields) {
  const extra = entry.forms || [];
  const tier = (kind) => extra.filter((f) => f.kind === kind)
    .map((f) => ({ ...f, key: f.kind, label: FORM_TIERS[f.kind].label }));
  return [
    ...tier('primitive'),
    { ...pickFields(fields, entry), key: 'main', kind: 'main', label: FORM_TIERS.full.label },
    ...tier('perfected'),
  ];
}

// Запис з полями форми, якою персонаж користується: рівнева форма, до якої
// персонаж дійшов (form_tier), або основна, якщо рівневих форм немає чи
// form_tier не задано.
export function entryForCharacter(entry, fields, { form_tier } = {}) {
  const forms = entryForms(entry, fields);
  const key = form_tier && form_tier !== 'full' && forms.some((f) => f.key === form_tier) ? form_tier : 'main';
  const form = forms.find((f) => f.key === key);
  return { ...entry, ...pickFields(fields, form), form_label: form.label, form_key: form.key };
}

// Запис з полями однієї форми (за ключем); невідомий ключ — основна.
export function entryWithForm(entry, fields, key) {
  const forms = entryForms(entry, fields);
  const form = forms.find((f) => f.key === key) ?? forms.find((f) => f.key === 'main');
  return { ...entry, ...pickFields(fields, form), form_label: form.label, form_key: form.key };
}
