import { useState } from 'react';
import { Download } from 'lucide-react';
import api from '../api/client';
import { downloadJsonFile } from '../utils/downloadJson';

// Експорт одного запису в JSON — поруч із ShareButton у заголовку сторінки
// запису. url — ендпоінт, що віддає файл у форматі імпорту цього каталогу
// (масив з одного запису або об'єкт), filename — ім'я завантаженого файлу.
export default function ExportRecordButton({ url, filename, className = '' }) {
  const [busy, setBusy] = useState(false);

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      const { data } = await api.get(url);
      downloadJsonFile(data, filename);
    } catch {
      alert('Не вдалося експортувати запис');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title="Експорт запису в JSON"
      aria-label="Експорт запису в JSON"
      className={`inline-flex shrink-0 items-center rounded-md p-1.5 text-text-dim transition-colors hover:bg-surface-hover hover:text-accent disabled:opacity-60 ${className}`}
    >
      <Download size={16} />
    </button>
  );
}
