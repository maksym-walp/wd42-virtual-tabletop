import { useState } from 'react';
import { entryForms } from '../constants/forms';

// Ключ форми в редакторі: 'main' — основна, рівневі — за kind, альтернативні — id.
export const editorFormKey = (f) => (f.kind === 'alternative' ? f.id : f.kind);

// Стан редактора форм запису (заклинання / вміння): яка форма зараз
// редагується, тип форм і операції над ними. Поля, що відрізняються між
// формами (`fields`), сторінка читає з `current` і пише через `patchForm`;
// для основної форми це поля самого `form`, для решти — елемент form.forms.
// newForm(kind, form) — нова додаткова форма (зазвичай копія основної).
export default function useEntryForms({ form, setForm, fields, newForm }) {
  const [activeForm, setActiveForm] = useState('main');
  // 'alternative' (основна + альтернативні) або 'tiered' (примітивна /
  // повноцінна / довершена). Разом — не можна.
  const [formMode, setFormMode] = useState('alternative');

  const allForms = entryForms(form, fields);
  const activeEntry = allForms.find((f) => f.key === activeForm) ?? allForms.find((f) => f.key === 'main');
  const current = activeEntry.key === 'main' ? form : form.forms.find((f) => editorFormKey(f) === activeEntry.key);

  const patchForm = (patch) => setForm((f) => (activeEntry.key === 'main'
    ? { ...f, ...patch }
    : { ...f, forms: f.forms.map((x) => (editorFormKey(x) === activeEntry.key ? { ...x, ...patch } : x)) }));

  const addForm = (kind) => {
    const created = newForm(kind, form);
    setForm((f) => ({ ...f, forms: [...f.forms, created] }));
    setActiveForm(editorFormKey(created));
  };

  const removeActiveForm = () => {
    if (activeEntry.key === 'main') return;
    if (!confirm(`Видалити «${activeEntry.label}»?`)) return;
    setForm((f) => ({ ...f, forms: f.forms.filter((x) => editorFormKey(x) !== activeEntry.key) }));
    setActiveForm('main');
  };

  const hasForm = (kind) => form.forms.some((f) => f.kind === kind);

  const changeFormMode = (mode) => {
    if (mode === formMode) return;
    const keep = (f) => (mode === 'tiered' ? f.kind !== 'alternative' : f.kind === 'alternative');
    const dropped = form.forms.filter((f) => !keep(f));
    if (dropped.length && !confirm(`Змінити тип форм? Буде видалено форм: ${dropped.length}.`)) return;
    setForm((f) => ({ ...f, forms: f.forms.filter(keep) }));
    setFormMode(mode);
    setActiveForm('main');
  };

  return {
    allForms, activeEntry, current, patchForm, addForm, removeActiveForm, hasForm,
    formMode, setFormMode, changeFormMode, setActiveForm,
  };
}

// Тимчасовий id нової альтернативної форми. randomUUID є лише в безпечному
// контексті (https/localhost); інакше тимчасовий ключ — сервер замінить
// його справжнім uuid при збереженні.
export const newAlternativeFormId = () => crypto.randomUUID?.() ?? `tmp-${Date.now()}-${Math.random()}`;
