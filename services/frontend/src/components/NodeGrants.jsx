import { useState, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { AbilityPreview, SimplePreview } from './catalog/previews';
import { abilityWithForm } from '../constants/abilities';
import { complexityLabel } from '../utils/spellAccess';

// What a skill-tree node gives — shared by the GM editor (pages/SkillTree.jsx)
// and the player-facing tree (DevelopmentTree.jsx): node.grants (abilities
// and ability collections) plus what it opens for spells — traditions and
// complexity (node.unlocks_traditions / unlocks_complexity). Spells
// themselves are never linked to nodes.

export const GRANT_KIND_LABEL = {
  ability: 'вміння',
  ability_collection: 'колекція вмінь',
};

const formQuery = (formKey) => (formKey ? `?form=${encodeURIComponent(formKey)}` : '');

const GRANT_HREF = {
  ability: (id, formKey) => `/abilities/${id}${formQuery(formKey)}`,
  ability_collection: (id) => `/abilities/collections/${id}`,
};

// catalog: { abilities, abilityCollections, traditions }
export function grantItem(grant, catalog = {}) {
  const pools = {
    ability: catalog.abilities,
    ability_collection: catalog.abilityCollections,
  };
  return (pools[grant.item_kind] || []).find((x) => x.id === grant.item_id) || null;
}

// The catalog entry as this grant gives it: for a form-specific grant
// (form_key set) — with that form's fields and its `form_label`.
export function grantEntry(grant, catalog) {
  const item = grantItem(grant, catalog);
  if (!item || !grant.form_key) return item;
  if (grant.item_kind === 'ability') return abilityWithForm(item, grant.form_key);
  return item;
}

export function grantName(grant, catalog) {
  const entry = grantEntry(grant, catalog);
  if (!entry) return '—';
  return entry.form_label ? `${entry.name} — ${entry.form_label}` : entry.name;
}

// What the node opens for spells, as display lines (traditions by name,
// complexity as a ladder).
export function nodeSpellAccessLines(node, catalog = {}) {
  const lines = [];
  const names = (node.unlocks_traditions || [])
    .map((id) => (catalog.traditions || []).find((t) => t.id === id)?.name)
    .filter(Boolean);
  if (names.length) lines.push(`${names.length > 1 ? 'Традиції' : 'Традиція'}: ${names.join(', ')}`);
  if (node.unlocks_complexity) lines.push(`Складність заклинань: до «${complexityLabel(node.unlocks_complexity)}» включно`);
  return lines;
}

// Compact read-only summary for the node hover tooltip: effects plus
// everything the node grants / makes available, names only.
export function NodeGainsSummary({ node, catalog }) {
  const effect = node.effect || [];
  const grants = node.grants || [];
  const sections = [
    { label: 'Ефект', items: effect.map((line) => ({ text: line })) },
    { label: 'Додає автоматично', items: grants.filter((g) => g.mode === 'grant').map((g) => ({ text: grantName(g, catalog), kind: g.item_kind })) },
    { label: 'Робить доступним', items: grants.filter((g) => g.mode === 'unlock').map((g) => ({ text: grantName(g, catalog), kind: g.item_kind })) },
    { label: 'Відкриває магію', items: nodeSpellAccessLines(node, catalog).map((text) => ({ text })) },
  ].filter((s) => s.items.length > 0);

  return sections.map((s) => (
    <div key={s.label} className="mt-2">
      <span className="mb-0.5 block text-[0.7rem] uppercase tracking-wide text-text-dim">{s.label}</span>
      <ul className="list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-text-muted">
        {s.items.map((item, i) => (
          <li key={i}>
            {item.text}
            {item.kind && <span className="text-text-dim"> ({GRANT_KIND_LABEL[item.kind]})</span>}
          </li>
        ))}
      </ul>
    </div>
  ));
}

// Grants list for the node detail panel: hovering an entry shows its catalog
// card, clicking opens its own page in a new tab (so the tree stays open).
export function GrantList({ grants, catalog }) {
  const [hover, setHover] = useState(null); // { item, kind, rect }

  return (
    <>
      <ul className="mt-1 list-inside list-disc text-sm leading-relaxed text-text-muted">
        {grants.map((g, i) => {
          const item = grantEntry(g, catalog);
          return (
            <li key={i}>
              {item ? (
                <Link
                  to={GRANT_HREF[g.item_kind](g.item_id, g.form_key)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-text underline decoration-dotted underline-offset-2 hover:text-accent"
                  onMouseEnter={(e) => setHover({
                    item,
                    kind: g.item_kind,
                    rect: e.currentTarget.getBoundingClientRect(),
                    panelRect: e.currentTarget.closest('[role=dialog]')?.getBoundingClientRect(),
                  })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setHover(null)}
                >
                  {item.name}
                  {item.form_label && <span className="text-text-dim no-underline"> — {item.form_label}</span>}
                  <ExternalLink size={12} className="shrink-0 opacity-60" />
                </Link>
              ) : '—'}
              {' '}<span className="text-text-dim">({GRANT_KIND_LABEL[g.item_kind]})</span>
            </li>
          );
        })}
      </ul>
      {hover && <GrantHoverCard {...hover} />}
    </>
  );
}

const CARD_W = 300;
const MARGIN = 12;

// Rendered in a portal (the detail panel is a scrolling overlay that would
// clip it) beside the panel at the hovered entry's height — right if there's
// room, else left, else (narrow screens) above/below the entry — then clamped
// into the viewport once its real height is known.
function GrantHoverCard({ item, kind, rect, panelRect }) {
  const elRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const h = elRef.current?.offsetHeight ?? 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const side = panelRect || rect;
    let left;
    let top;
    if (vw - side.right >= CARD_W + MARGIN * 2) {
      left = side.right + MARGIN;
      top = rect.top;
    } else if (side.left >= CARD_W + MARGIN * 2) {
      left = side.left - CARD_W - MARGIN;
      top = rect.top;
    } else {
      left = (vw - CARD_W) / 2;
      top = rect.top - h - MARGIN >= MARGIN ? rect.top - h - MARGIN : rect.bottom + MARGIN;
    }
    top = Math.max(MARGIN, Math.min(top, vh - h - MARGIN));
    left = Math.max(MARGIN, Math.min(left, vw - CARD_W - MARGIN));
    setPos({ left, top });
  }, [item, rect, panelRect]);

  let content;
  if (kind === 'ability') content = <AbilityPreview ability={item} />;
  else {
    content = (
      <SimplePreview
        image={item.image_url}
        imageCrop={item.image_crop}
        badges={[GRANT_KIND_LABEL[kind]]}
        title={item.name}
        description={item.description}
      />
    );
  }

  return createPortal(
    <div
      ref={elRef}
      className="fixed z-[60] max-h-[80vh] overflow-hidden rounded-lg border border-border bg-surface shadow-xl"
      style={{ width: CARD_W, left: pos?.left ?? -9999, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden', pointerEvents: 'none' }}
    >
      {content}
    </div>,
    document.body,
  );
}
