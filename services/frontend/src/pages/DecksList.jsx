import { Link } from 'react-router-dom';
import { decksApi } from '../api/tools';
import ToolsList from '../components/tools/ToolsList';
import DeckCard from '../components/tools/DeckCard';
import { buildDeckImportTemplate } from '../utils/toolsImportTemplates';

function DeckListCard({ item }) {
  return (
    <Link
      to={`/tools/decks/${item.id}`}
      className="flex gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-hover"
    >
      <DeckCard card={{ id: 'back' }} suitsById={new Map()} faceUp={false} backUrl={item.back_image_url} className="w-20 shrink-0" />
      <div className="min-w-0">
        <h3 className="font-display text-lg text-accent">{item.name}</h3>
        {item.description && <p className="line-clamp-2 text-sm italic text-text-muted">{item.description}</p>}
        <p className="mt-1.5 text-xs text-text-dim">
          Карт: {item.cards_count} · мастей: {item.suits_count}
          {item.is_public && ' · публічна'}
          {!item.is_owner && item.owner_username && ` · @${item.owner_username}`}
        </p>
      </div>
    </Link>
  );
}

export default function DecksList() {
  return (
    <ToolsList
      title="🃏 Колоди карт"
      subtitle="Таро та будь-які власні колоди"
      api={decksApi}
      newTo="/tools/decks/new"
      newLabel="Нова колода"
      emptyIcon="🃏"
      emptyText="Створіть першу колоду або імпортуйте готову"
      noun="колоду"
      template={buildDeckImportTemplate}
      renderCard={(item) => <DeckListCard key={item.id} item={item} />}
    />
  );
}
