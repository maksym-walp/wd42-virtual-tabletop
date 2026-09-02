import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Maximize2 } from 'lucide-react';
import skillTreeApi from '../api/skillTree';
import { isIconUrl } from '../constants/maps';
import useSvgPanZoom from '../hooks/useSvgPanZoom';
import {
  computeLayout, elbowPath, computeFitTransform, ancestorClosure,
  computeEdgeLanes, computeEntryOffsets, LEVEL_SPACING_Y,
} from '../utils/skillTreeLayout';
import Sheet from './ui/Sheet';

const TREE_NODE_R = 22;
const TREE_ARROW_GAP = 5;
const TREE_NODE_ICON_SIZE = TREE_NODE_R * 1.3;

// Shared player-facing development tree — used both on the character sheet
// (TreeTab) and in the last step of character creation. Read-only viewer of
// the GM-authored graph (pages/SkillTree.jsx) plus per-character unlocking.
//
// Experience is a single wallet: `experienceTotal` minus skill spend
// (`experienceSkillSpent`, computed server-side) minus the cost of unlocked
// non-root nodes (computed here so it updates the instant a node opens).
export default function DevelopmentTree({
  archetype,
  tree = [],
  experienceTotal = 0,
  experienceSkillSpent = 0,
  is_owner = false,
  onUnlock,
  onExperienceChange,
  catalog = {},
}) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoverLabel, setHoverLabel] = useState(null);
  const panZoom = useSvgPanZoom({ initial: { x: 80, y: 80, k: 0.85 }, maxK: 3 });
  const { transform, setTransform } = panZoom;
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');
  const svgRef = useRef(null);
  const pendingCenterRef = useRef(false);

  useEffect(() => {
    pendingCenterRef.current = true;
    setLoading(true);
    Promise.all([
      skillTreeApi.getNodes({ archetype }),
      skillTreeApi.getEdges({ archetype }),
    ])
      .then(([n, e]) => { setNodes(n); setEdges(e); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [archetype]);

  const layout = useMemo(() => computeLayout(nodes, edges), [nodes, edges]);
  const { levels, positions } = layout;
  const edgeLanes = useMemo(() => computeEdgeLanes(edges, levels, positions), [edges, levels, positions]);
  const entryOffsets = useMemo(() => computeEntryOffsets(edges, positions), [edges, positions]);
  const highlightSet = selectedNode ? ancestorClosure(selectedNode.id, edges) : null;

  useEffect(() => {
    if (!pendingCenterRef.current || loading || !svgRef.current || nodes.length === 0) return;
    const root = nodes.find((n) => n.is_root) || nodes[0];
    const pos = positions.get(root.id) || { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    setTransform((t) => ({
      ...t,
      x: rect.width / 2 - pos.x * t.k,
      y: rect.height / 2 - pos.y * t.k,
    }));
    pendingCenterRef.current = false;
  }, [nodes, loading, positions, setTransform]);

  const handleFitView = () => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const fit = computeFitTransform(positions, rect.width, rect.height);
    if (fit) setTransform(fit);
  };

  const visibleIdSet = new Set(nodes.map((n) => n.id));
  const visibleEdges = edges.filter((e) => visibleIdSet.has(e.source_id) && visibleIdSet.has(e.target_id));

  const rootNodeIds = new Set(nodes.filter((n) => n.is_root).map((n) => n.id));
  const unlockedIds = new Set([...(tree || []).map((t) => t.node_id), ...rootNodeIds]);

  const treeSpent = nodes
    .filter((n) => unlockedIds.has(n.id) && !n.is_root)
    .reduce((s, n) => s + (n.cost || 0), 0);
  const remaining = experienceTotal - experienceSkillSpent - treeSpent;

  const checkCanUnlock = (node) => {
    if (unlockedIds.has(node.id)) return { unlocked: true };

    const prereqEdges = edges.filter((e) => e.target_id === node.id);
    let prereqsMet = true;
    if (prereqEdges.length > 0) {
      const required = prereqEdges.filter((e) => e.edge_type === 'required');
      const optional = prereqEdges.filter((e) => e.edge_type === 'optional');
      prereqsMet =
        required.every((e) => unlockedIds.has(e.source_id)) &&
        (optional.length === 0 || optional.some((e) => unlockedIds.has(e.source_id)));
    }

    const hasPoints = node.cost > 0;
    const hasNarrative = (node.narrative_condition || []).length > 0;
    const requireBoth = !!node.require_both;

    let points = false, narrative = false, bothAvail = false;
    if (prereqsMet) {
      if (requireBoth && hasPoints && hasNarrative) {
        bothAvail = node.cost <= remaining;
      } else {
        points = hasPoints && node.cost <= remaining;
        narrative = hasNarrative;
      }
    }
    return { unlocked: false, prereqsMet, points, narrative, bothAvail };
  };

  const handleUnlock = async (nodeId) => {
    await onUnlock?.(nodeId);
    setSelectedNode(null);
  };

  const handleSvgPointerDown = (e) => {
    if (e.button !== 0) return;
    const tag = e.target.tagName;
    if (tag === 'circle' || tag === 'text') return;
    panZoom.bind.onPointerDown(e);
  };

  const handleNodeEnter = (node) => {
    const pos = positions.get(node.id) || { x: 0, y: 0 };
    const r = TREE_NODE_R * transform.k;
    const cx = transform.x + pos.x * transform.k;
    const cy = transform.y + pos.y * transform.k;
    setHoverLabel({ title: node.title, left: cx + r + 10, nodeTop: cy - r, nodeBottom: cy + r });
  };
  const handleNodeLeave = () => setHoverLabel(null);

  const edgePathFor = (edge) => {
    const s = positions.get(edge.source_id);
    const d = positions.get(edge.target_id);
    if (!s || !d) return null;
    const sLevel = levels[edge.source_id] ?? 1;
    const dLevel = levels[edge.target_id] ?? 1;
    const x1 = s.x, y1 = s.y - TREE_NODE_R;
    const x2 = d.x + (entryOffsets.get(edge.id) ?? 0), y2 = d.y + TREE_NODE_R + TREE_ARROW_GAP;
    const midY = dLevel - sLevel > 1
      ? y1 - LEVEL_SPACING_Y / 2
      : y1 - (edgeLanes.get(edge.source_id) ?? 0.5) * (y1 - y2);
    return { path: elbowPath(x1, y1, x2, y2, midY) };
  };

  const commitBudget = () => {
    const val = Math.max(0, parseInt(budgetDraft, 10) || 0);
    onExperienceChange?.(val);
    setEditingBudget(false);
  };

  if (loading) return <p className="py-4 text-text-dim">Завантаження дерева...</p>;

  return (
    <div className="flex flex-col gap-3">
      {/* Experience bar */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border/60 bg-surface px-3 py-1.5 text-xs text-text-dim">
        <span className="uppercase tracking-wide">Пункти досвіду:</span>
        {is_owner && onExperienceChange && editingBudget ? (
          <input
            autoFocus
            type="number" min={0} value={budgetDraft}
            className="w-10 border-0 border-b border-gold bg-transparent text-center font-semibold text-gold outline-none"
            onChange={(e) => setBudgetDraft(e.target.value)}
            onBlur={commitBudget}
            onKeyDown={(e) => { if (e.key === 'Enter') commitBudget(); if (e.key === 'Escape') setEditingBudget(false); }}
          />
        ) : (
          <span
            className={`font-semibold text-gold ${is_owner && onExperienceChange ? 'cursor-pointer underline decoration-dotted' : 'cursor-default'}`}
            onClick={() => { if (!is_owner || !onExperienceChange) return; setBudgetDraft(String(experienceTotal)); setEditingBudget(true); }}
            title={is_owner && onExperienceChange ? 'Натисни щоб змінити' : undefined}
          >
            {experienceTotal}
          </span>
        )}
        {experienceSkillSpent > 0 && (
          <span className="text-border">·<span className="ml-2 text-text-dim">на навички <strong className="text-danger">{experienceSkillSpent}</strong></span></span>
        )}
        <span className="text-border">·<span className="ml-2 text-text-dim">на дерево <strong className="text-danger">{treeSpent}</strong></span></span>
        <span className="text-border">·<span className="ml-2 text-text-dim">залишилось <strong className={remaining >= 0 ? 'text-sage' : 'text-danger'}>{remaining}</strong></span></span>
      </div>

      {/* Canvas */}
      <div className="relative h-[520px] overflow-hidden rounded-lg border border-border bg-surface">
        <button
          type="button"
          onClick={handleFitView}
          title="Показати все дерево"
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-text-dim hover:text-text"
        >
          <Maximize2 size={15} />
        </button>
        <svg
          ref={svgRef}
          className="block h-full w-full select-none touch-none overscroll-contain"
          style={{ cursor: 'grab' }}
          onPointerDown={handleSvgPointerDown}
          onPointerMove={panZoom.bind.onPointerMove}
          onPointerUp={panZoom.bind.onPointerUp}
          onPointerCancel={panZoom.bind.onPointerCancel}
          onWheel={panZoom.bind.onWheel}
          onClick={() => setSelectedNode(null)}
        >
          <defs>
            <marker id="dev-tree-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill="var(--color-text-muted)" />
            </marker>
          </defs>
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {visibleEdges.map((edge) => {
              const pts = edgePathFor(edge);
              if (!pts) return null;
              const bothUnlocked = unlockedIds.has(edge.source_id) && unlockedIds.has(edge.target_id);
              const isOptional = edge.edge_type === 'optional';
              const stroke = bothUnlocked ? 'var(--color-sage)'
                : isOptional ? 'var(--color-edge-optional)'
                : 'var(--color-text-muted)';
              const dimmed = highlightSet && !(highlightSet.has(edge.source_id) && highlightSet.has(edge.target_id));
              return (
                <path key={edge.id}
                  d={pts.path}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={isOptional ? 1.5 : 2}
                  strokeDasharray={isOptional ? '5,4' : undefined}
                  markerEnd="url(#dev-tree-arrow)"
                  opacity={dimmed ? 0.15 : 1}
                  style={{ pointerEvents: 'none' }}
                />
              );
            })}

            {nodes.map((node) => {
              const pos = positions.get(node.id) || { x: 0, y: 0 };
              const unlocked = unlockedIds.has(node.id);
              const selected = selectedNode?.id === node.id;
              const avail = checkCanUnlock(node);
              const dimmed = highlightSet && !highlightSet.has(node.id);
              const stroke = selected ? 'var(--color-accent)'
                : unlocked ? 'var(--color-sage)'
                : avail.points ? 'var(--color-gold)'
                : avail.narrative ? 'var(--color-node-narrative)'
                : 'var(--color-text-dim)';
              const fill = unlocked ? 'var(--color-node-unlocked-bg)' : 'var(--color-bg)';
              const textColor = unlocked ? 'var(--color-sage)' : 'var(--color-text)';

              return (
                <g key={node.id}
                  transform={`translate(${pos.x},${pos.y})`}
                  opacity={dimmed ? 0.25 : 1}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); setSelectedNode((prev) => (prev?.id === node.id ? null : node)); }}
                  onMouseEnter={() => handleNodeEnter(node)}
                  onMouseLeave={handleNodeLeave}
                >
                  <circle r={TREE_NODE_R} fill={fill}
                    stroke={stroke} strokeWidth={selected || unlocked ? 2.5 : 1.5} />
                  {unlocked && !node.is_root && (
                    <circle r={TREE_NODE_R + 4} fill="none" stroke="var(--color-sage)"
                      strokeWidth={1} opacity={0.25} style={{ pointerEvents: 'none' }} />
                  )}
                  {node.is_root && (
                    <circle r={TREE_NODE_R + 4} fill="none" stroke="var(--color-gold)"
                      strokeWidth={1} opacity={0.35} style={{ pointerEvents: 'none' }} />
                  )}
                  {isIconUrl(node.icon) ? (
                    <image
                      href={node.icon}
                      x={-TREE_NODE_ICON_SIZE / 2} y={-TREE_NODE_ICON_SIZE / 2}
                      width={TREE_NODE_ICON_SIZE} height={TREE_NODE_ICON_SIZE}
                      preserveAspectRatio="xMidYMid slice"
                      style={{ pointerEvents: 'none' }}
                    />
                  ) : (
                    <text x={0} y={node.icon ? 7 : 5} textAnchor="middle"
                      fontSize={node.icon ? 16 : 11} fill={textColor}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {node.icon || node.title.substring(0, 2)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {hoverLabel && <HoverLabel hoverLabel={hoverLabel} />}

        {nodes.length === 0 && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-text-dim">
            Дерево розвитку ще порожнє
          </div>
        )}

        {selectedNode && (
          <TreeNodePanel
            node={selectedNode}
            nodes={nodes}
            edges={edges}
            unlocked={unlockedIds.has(selectedNode.id)}
            canUnlock={checkCanUnlock(selectedNode)}
            is_owner={is_owner}
            onUnlock={() => handleUnlock(selectedNode.id)}
            onClose={() => setSelectedNode(null)}
            catalog={catalog}
          />
        )}
      </div>
    </div>
  );
}

function HoverLabel({ hoverLabel }) {
  const { title, left, nodeTop, nodeBottom } = hoverLabel;
  const elRef = useRef(null);
  const [placement, setPlacement] = useState('above');

  useLayoutEffect(() => {
    const height = elRef.current?.offsetHeight ?? 0;
    setPlacement(nodeTop - height < 8 ? 'below' : 'above');
  }, [nodeTop]);

  const style = placement === 'above'
    ? { left, top: nodeTop, transform: 'translateY(-100%)' }
    : { left, top: nodeBottom };

  return (
    <div
      ref={elRef}
      className="pointer-events-none absolute z-20 max-w-[200px] rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-text shadow-lg"
      style={style}
    >
      {title}
    </div>
  );
}

// Resolve a node_grants entry to a display name from the loaded catalog.
function grantLabel(grant, catalog) {
  const pools = {
    ability: catalog.abilities,
    maneuver: catalog.maneuvers,
    spell: catalog.spells,
    ability_collection: catalog.abilityCollections,
    spell_collection: catalog.spellCollections,
  };
  const hit = (pools[grant.item_kind] || []).find((x) => x.id === grant.item_id);
  return hit?.name || '—';
}

const GRANT_KIND_LABEL = {
  ability: 'вміння',
  maneuver: 'маневр',
  spell: 'заклинання',
  ability_collection: 'колекція вмінь',
  spell_collection: 'колекція заклинань',
};

function TreeNodePanel({ node, nodes, edges, unlocked, canUnlock, is_owner, onUnlock, onClose, catalog }) {
  const prereqs = edges
    .filter((e) => e.target_id === node.id)
    .map((e) => ({ node: nodes.find((n) => n.id === e.source_id), type: e.edge_type }))
    .filter((x) => x.node);

  const grants = node.grants || [];
  const grantedItems = grants.filter((g) => g.mode === 'grant');
  const unlockItems = grants.filter((g) => g.mode === 'unlock');
  const effectLines = node.effect || [];
  const narrativeLines = node.narrative_condition || [];
  const costLabel = `${node.cost} ${node.cost === 1 ? 'пункт' : 'пунктів'} досвіду`;

  return (
    <Sheet
      open
      onClose={onClose}
      title={node.icon ? (
        <span className="inline-flex items-center gap-2">
          {isIconUrl(node.icon)
            ? <img src={node.icon} alt="" className="h-6 w-6 object-contain" />
            : <span>{node.icon}</span>}
          {node.title}
        </span>
      ) : node.title}
    >
      {node.is_root && <span className="mb-2 block text-xs text-gold">★ Кореневий вузол</span>}

      {node.description && <p className="mb-1 text-sm leading-relaxed text-text-muted">{node.description}</p>}

      {effectLines.length > 0 && (
        <div className="mt-2 rounded-md border border-border bg-bg p-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-text-dim">Ефект</p>
          <ul className="list-disc space-y-0.5 pl-4 text-sm leading-relaxed text-text-muted">
            {effectLines.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
      )}

      {grantedItems.length > 0 && (
        <div className="mt-2 rounded-md border border-sage/30 bg-sage/5 p-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-text-dim">Додає автоматично</p>
          <ul className="mt-1 list-inside list-disc text-sm leading-relaxed text-text-muted">
            {grantedItems.map((g, i) => (
              <li key={i}>{grantLabel(g, catalog)} <span className="text-text-dim">({GRANT_KIND_LABEL[g.item_kind]})</span></li>
            ))}
          </ul>
        </div>
      )}

      {unlockItems.length > 0 && (
        <div className="mt-2 rounded-md border border-border bg-bg p-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-text-dim">Робить доступним</p>
          <ul className="mt-1 list-inside list-disc text-sm leading-relaxed text-text-muted">
            {unlockItems.map((g, i) => (
              <li key={i}>{grantLabel(g, catalog)} <span className="text-text-dim">({GRANT_KIND_LABEL[g.item_kind]})</span></li>
            ))}
          </ul>
        </div>
      )}

      {narrativeLines.length > 0 && (
        <div className="mt-2 rounded-md border border-accent/30 bg-bg p-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-text-dim">Наративна умова</p>
          <ul className="list-disc space-y-0.5 pl-4 text-sm leading-relaxed text-text-muted">
            {narrativeLines.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
      )}

      {prereqs.length > 0 && (
        <div className="mt-2 rounded-md border border-border bg-bg p-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-text-dim">Вимоги</p>
          <div className="mt-1 flex flex-col gap-1.5">
            {prereqs.map(({ node: n, type }) => (
              <span key={n.id} className="flex items-center gap-1.5 text-sm">
                <span className={`shrink-0 rounded px-1 text-[0.65rem] ${type === 'optional' ? 'bg-accent/15 text-accent' : 'bg-sage/15 text-sage'}`}>
                  {type === 'optional' ? 'АБО' : 'І'}
                </span>
                <span className="text-text-dim">{n.title}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="my-3 flex flex-wrap gap-1.5">
        {node.cost > 0 && narrativeLines.length > 0 && node.require_both ? (
          <span className="rounded border border-border bg-surface-hover px-2 py-1 text-sm text-text-dim">💰+📖 {costLabel} + наратив</span>
        ) : (
          <>
            {node.cost > 0 && (
              <span className="rounded border border-border bg-surface-hover px-2 py-1 text-sm text-text-dim">💰 {costLabel}</span>
            )}
            {narrativeLines.length > 0 && (
              <span className="rounded border border-accent/30 bg-accent/10 px-2 py-1 text-sm text-accent">📖 наратив</span>
            )}
          </>
        )}
        {unlocked && <span className="rounded border border-sage/30 bg-sage/10 px-2 py-1 text-sm text-sage">✓ відкрито</span>}
      </div>

      {is_owner && (
        <div className="mt-1 flex flex-wrap gap-2">
          {!unlocked && canUnlock.bothAvail && (
            <button className="min-h-9 rounded border border-sage/40 bg-sage/15 px-3 py-1.5 text-sm font-semibold text-sage" onClick={onUnlock}>
              Витратити {costLabel} + наратив
            </button>
          )}
          {!unlocked && canUnlock.points && (
            <button className="min-h-9 rounded border border-sage/40 bg-sage/15 px-3 py-1.5 text-sm font-semibold text-sage" onClick={onUnlock}>
              Витратити {costLabel}
            </button>
          )}
          {!unlocked && canUnlock.narrative && (
            <button className="min-h-9 rounded border border-accent/40 bg-accent/15 px-3 py-1.5 text-sm font-semibold text-accent" onClick={onUnlock}>
              Відкрити наративно
            </button>
          )}
          {!unlocked && !canUnlock.points && !canUnlock.narrative && !canUnlock.bothAvail && (
            <span className="self-center text-sm italic text-text-dim">
              {!canUnlock.prereqsMet ? 'Вимоги не виконані' : 'Недостатньо пунктів досвіду'}
            </span>
          )}
        </div>
      )}
    </Sheet>
  );
}
