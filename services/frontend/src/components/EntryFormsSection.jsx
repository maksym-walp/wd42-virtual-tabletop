import { Plus, Trash2 } from 'lucide-react';
import { FORM_TIERS, DEFAULT_MAIN_FORM_NAME } from '../constants/forms';
import Field, { inputClass } from './ui/Field';
import Button from './ui/Button';

// Вміст секції «Форми» редактора заклинання / вміння: тип форм, перемикач
// активної форми, додавання / видалення, назви. `forms` — результат
// useEntryForms; `fieldsHint` — які поля нижче редагуються для обраної форми.
export default function EntryFormsSection({ forms, mainFormName, onMainFormNameChange, fieldsHint, altNamePlaceholder }) {
  const {
    allForms, activeEntry, current, patchForm, addForm, removeActiveForm, hasForm, formMode, changeFormMode, setActiveForm,
  } = forms;

  return (
    <>
      <p className="mb-3 text-xs text-text-dim">
        Спершу обери тип форм — разом їх поєднувати не можна. {fieldsHint} редагуються для обраної
        форми; нова форма починається як копія основної.
      </p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[
          ['alternative', 'Основна + альтернативні'],
          ['tiered', 'Рівневі: примітивна · повноцінна · довершена'],
        ].map(([mode, label]) => (
          <button
            key={mode} type="button"
            onClick={() => changeFormMode(mode)}
            className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
              formMode === mode ? 'border-gold bg-gold/10 text-gold' : 'border-border text-text-dim'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {allForms.map((f) => (
          <button
            key={f.key} type="button"
            onClick={() => setActiveForm(f.key)}
            className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
              activeEntry.key === f.key ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-dim'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {formMode === 'tiered' && !hasForm('primitive') && (
          <Button type="button" variant="ghost" size="sm" onClick={() => addForm('primitive')}>
            <Plus size={14} /> {FORM_TIERS.primitive.label}
          </Button>
        )}
        {formMode === 'tiered' && !hasForm('perfected') && (
          <Button type="button" variant="ghost" size="sm" onClick={() => addForm('perfected')}>
            <Plus size={14} /> {FORM_TIERS.perfected.label}
          </Button>
        )}
        {formMode === 'alternative' && (
          <Button type="button" variant="ghost" size="sm" onClick={() => addForm('alternative')}>
            <Plus size={14} /> Альтернативна форма
          </Button>
        )}
        {activeEntry.key !== 'main' && (
          <Button type="button" variant="danger" size="sm" onClick={removeActiveForm}>
            <Trash2 size={14} /> Видалити «{activeEntry.label}»
          </Button>
        )}
      </div>
      {activeEntry.key === 'main' && formMode === 'alternative' && (
        <Field label="Назва форми" className="mt-4">
          <input
            type="text" className={inputClass} value={mainFormName}
            onChange={onMainFormNameChange}
            maxLength={100} placeholder={DEFAULT_MAIN_FORM_NAME}
          />
        </Field>
      )}
      {activeEntry.kind === 'alternative' && (
        <Field label="Назва форми" className="mt-4">
          <input
            type="text" className={inputClass} value={current.name}
            onChange={(e) => patchForm({ name: e.target.value })}
            maxLength={100} placeholder={altNamePlaceholder}
          />
        </Field>
      )}
    </>
  );
}
