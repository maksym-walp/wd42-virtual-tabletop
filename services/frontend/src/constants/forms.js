// Форми записів каталогу — однакова модель у заклинань і вмінь. Основна
// форма — поля самого запису, додаткові лежать у entry.forms як повні
// знімки полів форми (свої для кожного каталогу — `fields`) + { kind, id, name }:
// рівневі 'primitive'/'perfected' (id = kind) або альтернативні
// 'alternative' (id — uuid, власна назва). Разом не змішуються.
//
// Ключ форми (key) — стабільний: 'main', 'primitive', 'perfected' або uuid
// альтернативної. Ті самі ключі пише вузол дерева розвитку
// (node_grants.form_key) і лист персонажа (primary_form/mastered_forms).

// Рівневі форми по зростанню. 'full' — це основна форма запису, коли в
// нього є хоч одна інша рівнева (primitive/perfected у entry.forms).
export const FORM_TIERS = {
  primitive: { label: 'Примітивна форма' },
  full:      { label: 'Повноцінна форма' },
  perfected: { label: 'Довершена форма' },
};

export const DEFAULT_MAIN_FORM_NAME = 'Основна форма';

export function pickFields(fields, source) {
  return Object.fromEntries(fields.map((f) => [f, source[f]]));
}

export function hasTierForms(entry) {
  return (entry?.forms || []).some((f) => f.kind === 'primitive' || f.kind === 'perfected');
}

// 'tiered' або 'alternative' — запис має або рівневі форми, або основну +
// альтернативні (сервер відхиляє змішування).
export function formModeOf(entry) {
  return hasTierForms(entry) ? 'tiered' : 'alternative';
}

export function mainFormLabel(entry) {
  return hasTierForms(entry) ? FORM_TIERS.full.label : (entry?.main_form_name?.trim() || DEFAULT_MAIN_FORM_NAME);
}

// Наявні рівневі форми по зростанню: ['primitive', 'full', ...];
// [] — якщо рівневих форм немає.
export function entryTiers(entry) {
  if (!hasTierForms(entry)) return [];
  const kinds = (entry.forms || []).map((f) => f.kind);
  return Object.keys(FORM_TIERS).filter((t) => t === 'full' || kinds.includes(t));
}

// Усі форми одним списком у порядку показу: рівневі (примітивна,
// основна/повноцінна, довершена), далі альтернативні.
export function entryForms(entry, fields) {
  const extra = entry.forms || [];
  const tier = (kind) => extra.filter((f) => f.kind === kind)
    .map((f) => ({ ...f, key: f.kind, label: FORM_TIERS[f.kind].label }));
  return [
    ...tier('primitive'),
    { ...pickFields(fields, entry), key: 'main', kind: 'main', label: mainFormLabel(entry) },
    ...tier('perfected'),
    ...extra.filter((f) => f.kind === 'alternative').map((f) => ({ ...f, key: f.id, label: f.name })),
  ];
}

// Альтернативні форми для вибору персонажем: основна + альтернативні.
export function entryVariantForms(entry, fields) {
  return entryForms(entry, fields).filter((f) => f.kind === 'main' || f.kind === 'alternative');
}

// Запис з полями форми, якою персонаж користується: обрана основна
// (primary_form); для основної форми запису з рівневими формами — рівнева
// форма, до якої персонаж дійшов (form_tier).
export function entryForCharacter(entry, fields, { primary_form = 'main', form_tier } = {}) {
  const forms = entryForms(entry, fields);
  let key = forms.some((f) => f.key === primary_form) ? primary_form : 'main';
  if (key === 'main' && form_tier && form_tier !== 'full' && forms.some((f) => f.key === form_tier)) key = form_tier;
  const form = forms.find((f) => f.key === key);
  return { ...entry, ...pickFields(fields, form), form_label: form.label, form_key: form.key };
}

// Запис з полями однієї форми (за ключем); невідомий ключ — основна.
export function entryWithForm(entry, fields, key) {
  const forms = entryForms(entry, fields);
  const form = forms.find((f) => f.key === key) ?? forms.find((f) => f.key === 'main');
  return { ...entry, ...pickFields(fields, form), form_label: form.label, form_key: form.key };
}
