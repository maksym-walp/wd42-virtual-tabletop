import { Link } from 'react-router-dom';
import { constellationsApi } from '../api/tools';
import ToolsList from '../components/tools/ToolsList';
import ConstellationPreview from '../components/tools/ConstellationPreview';
import { buildConstellationImportTemplate } from '../utils/toolsImportTemplates';

function ConstellationCard({ item }) {
  return (
    <Link
      key={item.id}
      to={`/tools/constellations/${item.id}`}
      className="block overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:bg-surface-hover"
    >
      <ConstellationPreview stars={item.preview?.stars} lines={item.preview?.lines} className="block h-40 w-full" />
      <div className="px-3.5 py-3">
        <h3 className="font-display text-lg text-accent">{item.name}</h3>
        {item.description && <p className="line-clamp-2 text-sm italic text-text-muted">{item.description}</p>}
        <p className="mt-1.5 text-xs text-text-dim">
          Зірок: {item.stars_count} · ліній: {item.lines_count}
          {item.is_public && ' · публічне'}
          {!item.is_owner && item.owner_username && ` · @${item.owner_username}`}
        </p>
      </div>
    </Link>
  );
}

export default function ConstellationsList() {
  return (
    <ToolsList
      title="✨ Сузір'я"
      subtitle="Візерунки із зірок і ліній"
      api={constellationsApi}
      newTo="/tools/constellations/new"
      newLabel="Нове сузір'я"
      emptyIcon="✨"
      emptyText="Створіть перше сузір'я або імпортуйте готове"
      noun="сузір'я"
      template={buildConstellationImportTemplate}
      renderCard={(item) => <ConstellationCard key={item.id} item={item} />}
    />
  );
}
