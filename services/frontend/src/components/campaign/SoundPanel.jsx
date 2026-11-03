import { useState } from 'react';
import { Music, ExternalLink, Trash2, Plus } from 'lucide-react';
import campaignApi from '../../api/campaigns';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { inputClass } from '../ui/Field';

// Звукова панель Ширми: поки без відтворення звуку в самому додатку —
// лише майстерський список посилань на плейлисти (назва + url).
export default function SoundPanel({ campaign, onChange }) {
  const links = campaign.sound_links ?? [];
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (next) => {
    setSaving(true);
    try {
      const updated = await campaignApi.updateSoundLinks(campaign.id, next);
      onChange((prev) => ({ ...prev, sound_links: updated.sound_links }));
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    if (!label.trim() || !url.trim()) return;
    save([...links, { label: label.trim(), url: url.trim() }]);
    setLabel('');
    setUrl('');
    setAdding(false);
  };

  const handleRemove = (index) => {
    save(links.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="m-0 flex items-center gap-1.5 font-display text-lg text-text">
          <Music size={18} /> Звукова панель
        </h3>
        {saving && <span className="text-xs text-text-dim">• Збереження...</span>}
      </div>

      {links.length === 0 && !adding && (
        <p className="text-sm text-text-dim">Ще немає посилань на плейлисти.</p>
      )}

      {links.length > 0 && (
        <ul className="flex flex-col gap-2">
          {links.map((link, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text">{link.label}</p>
                <p className="truncate text-xs text-text-dim">{link.url}</p>
              </div>
              <a href={link.url} target="_blank" rel="noreferrer"
                className="shrink-0 text-text-dim hover:text-accent" aria-label="Відкрити плейлист" title="Відкрити плейлист">
                <ExternalLink size={16} />
              </a>
              <button type="button" onClick={() => handleRemove(i)}
                className="shrink-0 text-text-dim hover:text-danger" aria-label="Видалити посилання" title="Видалити посилання">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="mt-3 flex flex-col gap-2">
          <input className={inputClass} placeholder="Назва плейлиста" value={label}
            onChange={(e) => setLabel(e.target.value)} autoFocus />
          <input className={inputClass} placeholder="https://..." value={url}
            onChange={(e) => setUrl(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!label.trim() || !url.trim()}>Додати</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setLabel(''); setUrl(''); }}>
              Скасувати
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="ghost" className="mt-3" onClick={() => setAdding(true)}>
          <Plus size={14} /> Додати посилання
        </Button>
      )}
    </Card>
  );
}
