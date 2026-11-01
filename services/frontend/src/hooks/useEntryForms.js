import { useState } from 'react';
import { entryForms } from '../constants/forms';

// Стан редактора форм запису (заклинання / вміння): яка рівнева форма зараз
// редагується (ключ — kind, бо id завжди дорівнює kind) і операції над
// ними. Поля, що відрізняються між формами (`fields`), сторінка читає з
// `current` і пише через `patchForm`; для основної форми це поля самого
// `form`, для решти — елемент form.forms. newForm(kind, form) — нова
// додаткова форма (зазвичай копія основної).
export default function useEntryForms({ form, setForm, fields, newForm }) {
  const [activeForm, setActiveForm] = useState('main');

  const allForms = entryForms(form, fields);
  const activeEntry = allForms.find((f) => f.key === activeForm) ?? allForms.find((f) => f.key === 'main');
  const current = activeEntry.key === 'main' ? form : form.forms.find((f) => f.kind === activeEntry.key);

  // key-параметризована версія — патчить ТУ форму, що передана, незалежно
  // від того, яка зараз активна. Потрібна для десктопної сітки (Part 6),
  // де кожна колонка — окрема форма, редагована одночасно з іншими.
  const patchFormAt = (key, patch) => setForm((f) => (key === 'main'
    ? { ...f, ...patch }
    : { ...f, forms: f.forms.map((x) => (x.kind === key ? { ...x, ...patch } : x)) }));

  const patchForm = (patch) => patchFormAt(activeEntry.key, patch);

  // kind — лише 'primitive' чи 'perfected'.
  const addForm = (kind) => {
    const created = newForm(kind, form);
    setForm((f) => ({ ...f, forms: [...f.forms, created] }));
    setActiveForm(kind);
  };

  // Видаляє конкретну рівневу форму (kind — завжди 'primitive'/'perfected',
  // 'main' ігнорується) — працює і з активної вкладки (мобільний), і з
  // окремої колонки десктопної сітки, що не обов'язково активна.
  const removeForm = (kind, label) => {
    if (kind === 'main') return;
    if (!confirm(`Видалити «${label}»?`)) return;
    setForm((f) => ({ ...f, forms: f.forms.filter((x) => x.kind !== kind) }));
    if (activeForm === kind) setActiveForm('main');
  };
  const removeActiveForm = () => removeForm(activeEntry.key, activeEntry.label);

  const hasForm = (kind) => form.forms.some((f) => f.kind === kind);

  return {
    allForms, activeEntry, current, patchForm, patchFormAt, addForm, removeForm, removeActiveForm, hasForm, setActiveForm,
  };
}
