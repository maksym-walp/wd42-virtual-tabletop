import { Plus, Trash2 } from 'lucide-react';
import { FORM_TIERS } from '../constants/forms';
import Button from './ui/Button';

// Вміст секції «Форми» редактора заклинання / вміння: перемикач активної
// рівневої форми (для мобільного — на десктопі форми показуються поряд,
// див. сторінку редактора), додавання / видалення. `forms` — результат
// useEntryForms; `fieldsHint` — які поля нижче редагуються для обраної форми.
export default function EntryFormsSection({ forms, fieldsHint }) {
  const { allForms, activeEntry, addForm, removeActiveForm, hasForm, setActiveForm } = forms;

  return (
    <>
      <p className="mb-3 text-xs text-text-dim">
        {fieldsHint} редагуються для обраної форми; нова форма починається як копія основної.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-1.5 lg:hidden">
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
        {!hasForm('primitive') && (
          <Button type="button" variant="ghost" size="sm" onClick={() => addForm('primitive')}>
            <Plus size={14} /> {FORM_TIERS.primitive.label}
          </Button>
        )}
        {!hasForm('perfected') && (
          <Button type="button" variant="ghost" size="sm" onClick={() => addForm('perfected')}>
            <Plus size={14} /> {FORM_TIERS.perfected.label}
          </Button>
        )}
        {activeEntry.key !== 'main' && (
          <Button type="button" variant="danger" size="sm" onClick={removeActiveForm} className="lg:hidden">
            <Trash2 size={14} /> Видалити «{activeEntry.label}»
          </Button>
        )}
      </div>
    </>
  );
}
