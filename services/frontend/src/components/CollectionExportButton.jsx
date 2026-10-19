import { useState } from 'react';
import { Download } from 'lucide-react';
import CardOverlayButton from './ui/CardOverlayButton';
import { downloadJsonFile } from '../utils/downloadJson';

// Експорт колекції з картки у списку: назва, опис і всі записи колекції з усіма
// полями — той самий файл, що й кнопка «Експорт» на сторінці колекції. Лежить
// поверх картки-посилання, тож клік не має відкривати саму колекцію.
// collectionsApi — createCollectionsApi(...) домену, domainKey — для імені файлу.
export default function CollectionExportButton({ collectionsApi, domainKey, collection }) {
  const [busy, setBusy] = useState(false);

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      downloadJsonFile(await collectionsApi.exportOne(collection.id), `${domainKey}_collection_${collection.id}_export.json`);
    } catch {
      alert('Не вдалося експортувати колекцію');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="absolute right-2 top-2 z-10">
      <CardOverlayButton label="Експорт колекції разом із записами (JSON)" onClick={handleClick}>
        <Download size={15} className={busy ? 'opacity-50' : ''} />
      </CardOverlayButton>
    </span>
  );
}
