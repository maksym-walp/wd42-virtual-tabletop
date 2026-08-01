import { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, Link2, Plus, Download, Upload, Pencil, Trash2, Maximize2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import skillTreeApi from '../api/skillTree';
import mediaApi, { MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES } from '../api/media';
import { ARCHETYPES, ARCHETYPE_COLORS as ARCHETYPE_COLORS_LIGHT, ARCHETYPE_COLORS_DARK } from '../constants/characterSheet';
import { isIconUrl } from '../constants/maps';
import { useTheme } from '../context/ThemeContext';
import useSvgPanZoom from '../hooks/useSvgPanZoom';
import {
  computeLayout, reorderCluster, elbowPath, computeFitTransform, ancestorClosure, computeEdgeLanes, computeEntryOffsets, LEVEL_SPACING_Y,
} from '../utils/skillTreeLayout';
import Sheet from '../components/ui/Sheet';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import ReqBadge from '../components/ui/ReqBadge';

const NODE_R = 24;
const NODE_ICON_SIZE = NODE_R * 1.3; // uploaded-image icon size — stays inside the circle (half-diagonal < NODE_R)
const ARROW_GAP = 6; // extra clearance beyond a node's radius before the arrowhead
const EDGE_HIT_WIDTH = 16; // invisible click target width along an edge, wide enough to hit comfortably
const DRAG_CLICK_THRESHOLD_PX = 5; // movement past this during a node drag suppresses the trailing click

export default function SkillTree() {
  const { user } = useAuth();
  const isGM = user?.role === 'game_master' || user?.role === 'admin';
  const { theme } = useTheme();
  const ARCHETYPE_COLORS = theme === 'dark' ? ARCHETYPE_COLORS_DARK : ARCHETYPE_COLORS_LIGHT;

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeArchetype, setActiveArchetype] = useState('fighter');

  const panZoom = useSvgPanZoom({ initial: { x: 120, y: 120, k: 1 } });
  const { transform, setTransform } = panZoom;
  const svgRef = useRef(null);
  const dragMovedRef = useRef(false); // true once a node drag exceeds the click-vs-drag threshold
  const pendingCenterRef = useRef(false); // armed on each (re)load so the next render centers on the root node

  const [selectedNode, setSelectedNode] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [connectMode, setConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState(null);
  const [dragState, setDragState] = useState(null); // { nodeId, startClientX, startClientY, offsetX }
  const [tooltip, setTooltip] = useState(null);

  // Clicking a node in edit mode opens this action menu instead of jumping
  // straight to a panel; clicking an edge opens the settings modal. Both
  // store just the id and look the current object up live each render, so
  // an in-place edit/toggle is reflected immediately without closing/reopening.
  const [actionMenuNodeId, setActionMenuNodeId] = useState(null);
  const [connectionsNodeId, setConnectionsNodeId] = useState(null);
  const [edgeModalId, setEdgeModalId] = useState(null);

  // Layout is always fully derived from the graph — no stored pixel
  // coordinates. `pos_x` on a node is only a manual tie-break rank within its
  // sibling cluster (see utils/skillTreeLayout.js); `pos_y` is unused.
  const layout = useMemo(() => computeLayout(nodes, edges), [nodes, edges]);
  const { levels, positions, clusterKeyOf } = layout;

  // Hovering or selecting a node highlights its chain of prerequisites and
  // dims everything else — skipped mid-drag/connect so it doesn't fight those.
  const highlightSourceId = !connectMode && !dragState ? (tooltip?.node?.id ?? selectedNode?.id) : null;
  const highlightSet = highlightSourceId ? ancestorClosure(highlightSourceId, edges) : null;

  const [nodeForm, setNodeForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', text }
  const toastTimeoutRef = useRef(null);

  const showToast = (type, text) => {
    setToast({ type, text });
    clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 2500);
  };

  const importRef = useRef(null);

  const loadTree = (archetype) => {
    setLoading(true);
    pendingCenterRef.current = true;
    Promise.all([
      skillTreeApi.getNodes({ archetype }),
      skillTreeApi.getEdges({ archetype }),
    ]).then(([n, e]) => {
      setNodes(n);
      setEdges(e);
    }).catch(() => setActionError('Не вдалось завантажити дерево'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTree('fighter'); }, []);

  // Centers the camera on the root node once a (re)load finishes, so opening
  // the tab never leaves the player staring at empty canvas because the node
  // graph sits away from the fixed default {x:120,y:120} origin.
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

  const handleArchetypeChange = (archetype) => {
    setActiveArchetype(archetype);
    setSelectedNode(null);
    setTransform({ x: 120, y: 120, k: 1 });
    loadTree(archetype);
  };

  const handleFitView = () => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const fit = computeFitTransform(positions, rect.width, rect.height);
    if (fit) setTransform(fit);
  };

  // Different sources feeding the same pair of levels would otherwise all
  // bend at the identical shared-bus height and become visually indistinct
  // from each other — this gives each source its own lane within the gap.
  const edgeLanes = useMemo(() => computeEdgeLanes(edges, levels, positions), [edges, levels, positions]);
  // A target with 2+ incoming edges gets each one's arrival x spread apart
  // slightly, so a bent edge's final approach never perfectly overlaps an
  // unrelated straight-line edge that happens to share that column.
  const entryOffsets = useMemo(() => computeEntryOffsets(edges, positions), [edges, positions]);

  // Orthogonal edge path between two node circles (tree grows upward: source
  // exits at its top, target is entered at its bottom). Edges that skip a
  // level (possible with require_both parents at very different levels) bend
  // near the source instead of at the true midpoint, so the jog doesn't cut
  // through an unrelated intermediate level's node row.
  const edgePathFor = (edge) => {
    const s = positions.get(edge.source_id);
    const d = positions.get(edge.target_id);
    if (!s || !d) return null;
    const sLevel = levels[edge.source_id] ?? 1;
    const dLevel = levels[edge.target_id] ?? 1;
    const x1 = s.x, y1 = s.y - NODE_R;
    const x2 = d.x + (entryOffsets.get(edge.id) ?? 0), y2 = d.y + NODE_R + ARROW_GAP;
    const midY = dLevel - sLevel > 1
      ? y1 - LEVEL_SPACING_Y / 2
      : y1 - (edgeLanes.get(edge.source_id) ?? 0.5) * (y1 - y2);
    return { path: elbowPath(x1, y1, x2, y2, midY) };
  };

  // ── Pan/zoom (mouse-drag/wheel or touch-drag/pinch) ────────────────
  // Node click/drag (below) stopPropagation()s before this ever sees the
  // event when a GM drag actually starts; the tag check is a fallback for
  // when a mousedown/pointerdown on a node bubbles up unhandled (e.g. not in
  // GM edit mode) so it isn't misread as the start of a canvas pan.
  const handleSvgPointerDown = (e) => {
    if (dragState || e.button !== 0) return;
    const tag = e.target.tagName;
    // 'path' is the edge click hit-area (only rendered with real pointer
    // events in edit mode — the always-on visible edge path underneath is
    // pointer-events:none, so it's never `e.target`) — without this, a
    // pointerdown here started a canvas pan before the click ever reached
    // the edge's own handler.
    if (tag === 'circle' || tag === 'text' || tag === 'path') return;
    panZoom.bind.onPointerDown(e);
  };

  const handleSvgPointerMove = (e) => {
    if (dragState) {
      const screenDist = Math.hypot(e.clientX - dragState.startClientX, e.clientY - dragState.startClientY);
      if (screenDist > DRAG_CLICK_THRESHOLD_PX) dragMovedRef.current = true;
      const dx = (e.clientX - dragState.startClientX) / transform.k;
      setDragState((s) => (s ? { ...s, offsetX: dx } : s));
      return;
    }
    panZoom.bind.onPointerMove(e);
  };

  // Dragging only ever reorders a node among its own sibling cluster (nodes
  // sharing the exact same parent set) — its level/y never changes, and only
  // the two-or-more members whose rank actually moved get PATCHed.
  const endNodeDrag = async () => {
    if (!dragState) return;
    const { nodeId, offsetX } = dragState;
    setDragState(null);
    if (Math.abs(offsetX) < 1) return;

    const key = clusterKeyOf(nodeId);
    const clusterMembers = nodes
      .filter((n) => n.id === nodeId || clusterKeyOf(n.id) === key)
      .sort((a, b) => (positions.get(a.id)?.x ?? 0) - (positions.get(b.id)?.x ?? 0));
    if (clusterMembers.length < 2) return;

    const draggedPos = positions.get(nodeId);
    const estimatedX = (draggedPos?.x ?? 0) + offsetX;
    const others = clusterMembers.filter((n) => n.id !== nodeId);
    const dropIndex = others.filter((n) => (positions.get(n.id)?.x ?? 0) < estimatedX).length;

    const changed = reorderCluster(clusterMembers, nodeId, dropIndex);
    if (changed.length === 0) return;

    setNodes((prev) => prev.map((n) => changed.find((c) => c.id === n.id) || n));
    try {
      await Promise.all(changed.map((n) => skillTreeApi.updateNode(n.id, n)));
    } catch {
      setActionError('Не вдалось зберегти новий порядок вузлів');
    }
  };

  const handleSvgPointerUp = (e) => { endNodeDrag(); panZoom.bind.onPointerUp(e); };
  const handleSvgPointerCancel = (e) => { endNodeDrag(); panZoom.bind.onPointerCancel(e); };

  // ── Node interaction ──────────────────────────────────────────────
  const handleNodeMouseDown = (e, node) => {
    if (!isGM || !editMode || connectMode) return;
    e.stopPropagation();
    dragMovedRef.current = false;
    setDragState({ nodeId: node.id, startClientX: e.clientX, startClientY: e.clientY, offsetX: 0 });
  };

  const handleNodeClick = (e, node) => {
    e.stopPropagation();
    // A drag that moved past the threshold shouldn't also open the node —
    // the browser still fires a click after mouseup regardless of movement.
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    setTooltip(null);
    if (connectMode) {
      if (!connectSource) {
        setConnectSource(node);
      } else if (connectSource.id !== node.id) {
        doCreateEdge(connectSource.id, node.id);
        setConnectSource(null);
        setConnectMode(false);
      }
      return;
    }
    // Edit mode: clicking a node offers a choice of actions instead of
    // jumping straight to a panel — creating a child, editing the node, or
    // editing its connections all start from the same place.
    if (isGM && editMode) {
      setActionMenuNodeId(node.id);
      return;
    }
    setSelectedNode(node);
  };

  const handleNodeEnter = (e, node) => {
    if (dragState || connectMode) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setTooltip({ node, x, y });
  };

  const handleNodeLeave = () => setTooltip(null);

  const handleEdgeClick = (e, edge) => {
    e.stopPropagation();
    if (!isGM || !editMode || connectMode) return;
    setEdgeModalId(edge.id);
  };

  // ── CRUD ──────────────────────────────────────────────────────────
  const doCreateEdge = async (sourceId, targetId) => {
    try {
      const edge = await skillTreeApi.createEdge({ source_id: sourceId, target_id: targetId });
      setEdges((prev) => [...prev, edge]);
    } catch {
      setActionError('Не вдалось створити звʼязок (можливо, вже існує)');
    }
  };

  const handleDeleteEdge = async (edgeId) => {
    try {
      await skillTreeApi.deleteEdge(edgeId);
      setEdges((prev) => prev.filter((e) => e.id !== edgeId));
    } catch {
      setActionError('Не вдалось видалити звʼязок');
    }
  };

  const handleToggleEdgeType = async (edgeId, currentType) => {
    const next = currentType === 'optional' ? 'required' : 'optional';
    try {
      const updated = await skillTreeApi.updateEdge(edgeId, next);
      setEdges((prev) => prev.map((e) => (e.id === edgeId ? updated : e)));
    } catch {
      setActionError('Не вдалось змінити тип звʼязку');
    }
  };

  const openNewNodeForm = () => {
    // Unconnected nodes (no parent yet) share one cluster — rank them after
    // whatever's already waiting to be wired up via "Зʼєднати".
    const orphans = nodes.filter((n) => !n.is_root && !edges.some((e) => e.target_id === n.id));
    const nextPosX = orphans.length ? Math.max(...orphans.map((n) => n.pos_x ?? 0)) + 1 : 0;
    setNodeForm({
      title: '', description: '', icon: '', cost: 1,
      enableNarrative: false, narrative_condition: [],
      effect: [],
      archetype: activeArchetype, require_both: false,
      pos_x: nextPosX, pos_y: 0,
    });
  };

  // "Створити похідний вузол" action-menu entry: ranks the new child after
  // `parent`'s existing children (its own sibling cluster once the edge is created).
  const openNewChildForm = (parent) => {
    const siblingIds = new Set(edges.filter((e) => e.source_id === parent.id).map((e) => e.target_id));
    const siblings = nodes.filter((n) => siblingIds.has(n.id));
    const nextPosX = siblings.length ? Math.max(...siblings.map((n) => n.pos_x ?? 0)) + 1 : 0;
    setNodeForm({
      title: '', description: '', icon: '', cost: 1,
      enableNarrative: false, narrative_condition: [],
      effect: [],
      archetype: activeArchetype, require_both: false,
      pos_x: nextPosX, pos_y: 0,
      _parentId: parent.id,
    });
  };

  const openEditNodeForm = (n) => {
    setNodeForm({
      ...n,
      enableNarrative: (n.narrative_condition?.length ?? 0) > 0,
      narrative_condition: n.narrative_condition || [],
      effect: n.effect || [],
      archetype: n.archetype || activeArchetype,
      require_both: n.require_both || false,
    });
  };

  const handleSaveNode = async () => {
    if (!nodeForm.title.trim()) { setFormError('Назва обовʼязкова'); return; }
    const narrativeValue = nodeForm.enableNarrative
      ? (nodeForm.narrative_condition || []).filter((v) => v.trim() !== '')
      : [];
    if (nodeForm.cost === 0 && narrativeValue.length === 0) {
      setFormError('Вузол повинен мати хоча б один спосіб відкриття');
      return;
    }
    const effectValue = (nodeForm.effect || []).filter((v) => v.trim() !== '');
    const payload = { ...nodeForm, narrative_condition: narrativeValue, effect: effectValue };
    try {
      if (nodeForm.id) {
        const updated = await skillTreeApi.updateNode(nodeForm.id, payload);
        setNodes((prev) => prev.map((n) => (n.id === nodeForm.id ? updated : n)));
        setSelectedNode(updated);
        showToast('success', `Вузол «${updated.title}» оновлено`);
      } else {
        const created = await skillTreeApi.createNode(payload);
        setNodes((prev) => [...prev, created]);
        if (nodeForm._parentId) {
          await doCreateEdge(nodeForm._parentId, created.id);
        }
        showToast('success', `Вузол «${created.title}» створено`);
      }
      setNodeForm(null);
      setFormError('');
    } catch (err) {
      console.error('[skill-tree] failed to save node', err);
      showToast('error', 'Не вдалось зберегти вузол');
      setFormError('Помилка збереження');
    }
  };

  const handleDeleteNode = async (nodeId) => {
    if (!window.confirm('Видалити цей вузол разом з усіма звʼязками і прогресом персонажів?')) return;
    try {
      await skillTreeApi.deleteNode(nodeId);
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setEdges((prev) => prev.filter((e) => e.source_id !== nodeId && e.target_id !== nodeId));
      setSelectedNode(null);
      showToast('success', 'Вузол видалено');
    } catch (err) {
      console.error('[skill-tree] failed to delete node', err);
      setActionError('Не вдалось видалити вузол');
    }
  };

  // ── Export / Import ───────────────────────────────────────────────
  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ nodes, edges, archetype: activeArchetype }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skill-tree-${activeArchetype}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
        setActionError('Невірний формат файлу');
        return;
      }
      const archetypeLabel = ARCHETYPES[activeArchetype]?.label ?? activeArchetype;
      if (!window.confirm(
        `Імпортувати ${data.nodes.length} вузлів і ${data.edges.length} звʼязків у дерево «${archetypeLabel}»?\n\nПрогрес персонажів по ЦЬОМУ дереву буде видалено!`
      )) return;
      await skillTreeApi.importTree({ ...data, archetype: activeArchetype });
      const [n, ed] = await Promise.all([
        skillTreeApi.getNodes({ archetype: activeArchetype }),
        skillTreeApi.getEdges({ archetype: activeArchetype }),
      ]);
      pendingCenterRef.current = true;
      setNodes(n); setEdges(ed);
      setSelectedNode(null);
    } catch {
      setActionError('Помилка імпорту — перевір формат файлу');
    }
  };

  // ── Modal derived state (looked up live, so an in-place edit/toggle
  // shows immediately instead of needing the modal reopened) ────────
  const actionMenuNode = nodes.find((n) => n.id === actionMenuNodeId) || null;
  const connectionsNode = nodes.find((n) => n.id === connectionsNodeId) || null;
  const edgeModalEdge = edges.find((e) => e.id === edgeModalId) || null;

  // ── Render ────────────────────────────────────────────────────────
  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  return (
    <div className="skill-tree-page flex h-full flex-col pb-16 md:pb-0">
      {toast && (
        <div
          className={`fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-lg md:bottom-6 ${
            toast.type === 'success'
              ? 'border-sage/50 bg-sage/15 text-sage'
              : 'border-danger/50 bg-danger/15 text-danger'
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-bg px-4 py-2.5 sm:px-6">
        <div className="flex flex-1 flex-wrap gap-1.5">
          {Object.entries(ARCHETYPES).map(([key, a]) => (
            <button
              key={key}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                activeArchetype === key ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border text-text-dim'
              }`}
              onClick={() => handleArchetypeChange(key)}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {isGM && editMode && (
            <>
              <IconBtn
                active={connectMode}
                icon={Link2}
                label={connectMode ? (connectSource ? `→ ${connectSource.title}` : 'Вибери вузол') : 'Зʼєднати'}
                onClick={() => { setConnectMode((c) => !c); setConnectSource(null); }}
              />
              <IconBtn icon={Plus} label="Вузол" onClick={openNewNodeForm} primary />
              <IconBtn icon={Download} label="Експорт" onClick={handleExport} title="Експорт у JSON" />
              <label
                className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-text-dim"
                title="Імпорт з JSON"
              >
                <Upload size={15} /> Імпорт
                <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
              </label>
            </>
          )}
          <IconBtn icon={Maximize2} label="Вмістити" onClick={handleFitView} title="Показати все дерево" />
          {isGM && (
            <IconBtn
              active={editMode}
              icon={Pencil}
              label={editMode ? 'Редагування' : 'Редагувати'}
              onClick={() => { setEditMode((m) => !m); setConnectMode(false); setConnectSource(null); }}
            />
          )}
        </div>
      </div>

      {actionError && (
        <div className="flex shrink-0 items-center justify-between gap-3 bg-danger/15 px-4 py-2 text-sm text-danger sm:px-6">
          {actionError}
          <button onClick={() => setActionError('')} aria-label="Закрити"><X size={16} /></button>
        </div>
      )}

      {/* Canvas */}
      <div className="relative flex-1 overflow-hidden bg-surface">
        <svg
          ref={svgRef}
          className="h-full w-full touch-none select-none overscroll-contain"
          style={{ cursor: dragState ? 'grabbing' : 'grab' }}
          onPointerDown={handleSvgPointerDown}
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          onPointerCancel={handleSvgPointerCancel}
          onPointerLeave={() => { endNodeDrag(); setTooltip(null); }}
          onWheel={panZoom.bind.onWheel}
          onClick={() => setSelectedNode(null)}
        >
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="var(--color-text-muted)" />
            </marker>
          </defs>

          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {/* Edges */}
            {edges.map((edge) => {
              const pts = edgePathFor(edge);
              if (!pts) return null;
              const isOptional = edge.edge_type === 'optional';
              const dimmed = highlightSet && !(highlightSet.has(edge.source_id) && highlightSet.has(edge.target_id));
              const clickable = isGM && editMode && !connectMode;
              return (
                <g key={edge.id} opacity={dimmed ? 0.15 : 1}>
                  <path
                    d={pts.path}
                    fill="none"
                    stroke={isOptional ? 'var(--color-edge-optional)' : 'var(--color-text-muted)'}
                    strokeWidth={isOptional ? 1.5 : 2}
                    strokeDasharray={isOptional ? '6,4' : undefined}
                    markerEnd="url(#arrow)"
                    style={{ pointerEvents: 'none' }}
                  />
                  {/* Wide invisible hit area — clicking the thin line itself is
                      fiddly, and this replaces the old inline I/× buttons that
                      used to sit on top of (and get buried under) other edges. */}
                  {clickable && (
                    <path
                      d={pts.path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={EDGE_HIT_WIDTH}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => handleEdgeClick(e, edge)}
                    />
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const pos = positions.get(node.id) || { x: 0, y: 0 };
              const isDragging = dragState?.nodeId === node.id;
              const x = pos.x + (isDragging ? dragState.offsetX : 0);
              const y = pos.y;
              const selected = selectedNode?.id === node.id;
              const isSrc = connectSource?.id === node.id;
              const ac = ARCHETYPE_COLORS[node.archetype];
              const dimmed = highlightSet && !highlightSet.has(node.id);

              const stroke = isSrc ? 'var(--color-accent)'
                : selected ? 'var(--color-gold)'
                : ac?.color || 'var(--color-text-dim)';
              // Stronger tint than the badge's 0.12 alpha — nodes sit on the tan canvas, not the page bg.
              const fill = ac ? ac.bg.replace('0.12', '0.28') : 'var(--color-bg)';
              const textColor = ac?.color || 'var(--color-text)';

              return (
                <g
                  key={node.id}
                  transform={`translate(${x},${y})`}
                  opacity={dimmed ? 0.25 : 1}
                  style={{ cursor: editMode && !connectMode ? 'ew-resize' : 'pointer' }}
                  onClick={(e) => handleNodeClick(e, node)}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  onMouseEnter={(e) => handleNodeEnter(e, node)}
                  onMouseLeave={handleNodeLeave}
                >
                  {/* Main circle */}
                  <circle
                    r={NODE_R}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={selected || isSrc ? 2.5 : 1.5}
                  />

                  {/* Icon (emoji or uploaded image) or initials — the name/cost only show on hover (Tooltip below) */}
                  {isIconUrl(node.icon) ? (
                    <image
                      href={node.icon}
                      x={-NODE_ICON_SIZE / 2} y={-NODE_ICON_SIZE / 2}
                      width={NODE_ICON_SIZE} height={NODE_ICON_SIZE}
                      preserveAspectRatio="xMidYMid slice"
                      style={{ pointerEvents: 'none' }}
                    />
                  ) : (
                    <text
                      x={0} y={node.icon ? 7 : 5}
                      textAnchor="middle"
                      fontSize={node.icon ? 18 : 12}
                      fill={textColor}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {node.icon || node.title.substring(0, 2)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Hover tooltip — the only place a node's name/details show now */}
        {tooltip && (
          <Tooltip tooltip={tooltip} nodes={nodes} edges={edges} />
        )}

        {nodes.length === 0 && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-text-dim">
            {isGM ? 'Вмикай «Редагувати» і додавай перший вузол' : 'Дерево розвитку ще порожнє'}
          </div>
        )}

        {/* Detail panel (view mode / non-GM) */}
        {selectedNode && !nodeForm && (
          <NodePanel
            node={selectedNode}
            nodes={nodes}
            edges={edges}
            level={levels[selectedNode.id]}
            isGM={isGM}
            onEdit={openEditNodeForm}
            onDelete={handleDeleteNode}
            onClose={() => setSelectedNode(null)}
          />
        )}

        {/* Action menu (edit mode node click) */}
        {actionMenuNode && (
          <Sheet open onClose={() => setActionMenuNodeId(null)} title={actionMenuNode.title}>
            <div className="flex flex-col gap-2">
              <MenuAction
                icon={Plus} label="Створити похідний вузол"
                onClick={() => { openNewChildForm(actionMenuNode); setActionMenuNodeId(null); }}
              />
              <MenuAction
                icon={Pencil} label="Редагувати поточний вузол"
                onClick={() => { openEditNodeForm(actionMenuNode); setActionMenuNodeId(null); }}
              />
              <MenuAction
                icon={Link2} label="Редагувати звʼязки"
                onClick={() => { setConnectionsNodeId(actionMenuNode.id); setActionMenuNodeId(null); }}
              />
              <div className="mt-2 border-t border-border pt-3">
                <MenuAction
                  icon={Trash2} label="Видалити вузол" danger
                  onClick={() => { setActionMenuNodeId(null); handleDeleteNode(actionMenuNode.id); }}
                />
              </div>
            </div>
          </Sheet>
        )}

        {/* Node connections editor (incoming/outgoing, grouped) */}
        {connectionsNode && (
          <NodeConnectionsModal
            node={connectionsNode}
            nodes={nodes}
            edges={edges}
            onToggle={handleToggleEdgeType}
            onDelete={handleDeleteEdge}
            onClose={() => setConnectionsNodeId(null)}
          />
        )}

        {/* Single-edge settings (canvas edge click) */}
        {edgeModalEdge && (
          <EdgeSettingsModal
            edge={edgeModalEdge}
            sourceTitle={nodes.find((n) => n.id === edgeModalEdge.source_id)?.title ?? '—'}
            targetTitle={nodes.find((n) => n.id === edgeModalEdge.target_id)?.title ?? '—'}
            onToggle={() => handleToggleEdgeType(edgeModalEdge.id, edgeModalEdge.edge_type)}
            onDelete={() => { handleDeleteEdge(edgeModalEdge.id); setEdgeModalId(null); }}
            onClose={() => setEdgeModalId(null)}
          />
        )}
      </div>

      {nodeForm && (
        <NodeFormModal
          form={nodeForm}
          error={formError}
          onChange={setNodeForm}
          onSave={handleSaveNode}
          onClose={() => { setNodeForm(null); setFormError(''); }}
        />
      )}
    </div>
  );
}

// ── Compact icon toolbar button (skills header) ────────────────────
function IconBtn({ icon: Icon, label, onClick, active, primary, title }) {
  const classes = primary
    ? 'bg-accent text-bg'
    : active
      ? 'border border-accent/50 bg-accent/10 text-accent'
      : 'border border-border text-text-dim';
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold ${classes}`}
    >
      <Icon size={15} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ── Action-menu row (node click in edit mode) ──────────────────────
function MenuAction({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-left text-sm font-semibold transition-colors ${
        danger ? 'border-danger/40 text-danger hover:bg-danger/10' : 'border-border text-text hover:bg-surface-hover'
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────
function Tooltip({ tooltip, nodes, edges }) {
  const { node, x, y } = tooltip;
  const prereqs = edges
    .filter((e) => e.target_id === node.id)
    .map((e) => ({ node: nodes.find((n) => n.id === e.source_id), type: e.edge_type }))
    .filter((x) => x.node);

  const left = x + 18;
  const top = Math.max(8, y - 20);

  return (
    <div
      className="absolute z-30 max-w-[260px] rounded-lg border border-border bg-surface p-3 shadow-xl"
      style={{ left, top, pointerEvents: 'none' }}
    >
      <p className="mb-1 font-display text-sm text-accent">{node.title}</p>
      {node.description && <p className="text-xs leading-relaxed text-text-dim">{node.description}</p>}
      {node.effect?.length > 0 && (
        <div className="mt-2">
          <TtLabel>Ефект</TtLabel>
          <ul className="list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-text-muted">
            {node.effect.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}
      {prereqs.length > 0 && (
        <div className="mt-2">
          <TtLabel>Вимоги</TtLabel>
          {prereqs.map(({ node: n, type }) => (
            <p key={n.id} className="flex items-center gap-1.5 text-xs text-text-dim">
              <ReqBadge type={type} />
              {n.title}
            </p>
          ))}
        </div>
      )}
      {node.archetypes?.length > 0 && (
        <div className="mt-2">
          <TtLabel>Архетипи</TtLabel>
          <p className="text-xs leading-relaxed text-accent">{node.archetypes.join(', ')}</p>
        </div>
      )}
      {(node.cost > 0 || node.narrative_condition?.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {node.cost > 0 && (
            <TtBadge>💰 {node.cost} {node.cost === 1 ? 'очко' : 'очків'}</TtBadge>
          )}
          {node.narrative_condition?.length > 0 && <TtBadge>📖 наратив</TtBadge>}
        </div>
      )}
    </div>
  );
}

function TtLabel({ children }) {
  return <span className="mb-0.5 block text-[0.7rem] uppercase tracking-wide text-text-dim">{children}</span>;
}
function TtBadge({ children }) {
  return <span className="inline-block rounded bg-bg px-2 py-0.5 text-xs text-text-dim">{children}</span>;
}
// ── Node detail panel (view mode / non-GM click) ────────────────────
function NodePanel({ node, nodes, edges, level, isGM, onEdit, onDelete, onClose }) {
  const prereqEdges = edges.filter((e) => e.target_id === node.id);
  const prereqs = prereqEdges
    .map((e) => ({ node: nodes.find((n) => n.id === e.source_id), type: e.edge_type }))
    .filter((x) => x.node);

  const hasOptional = prereqEdges.some((e) => e.edge_type === 'optional');
  const hasRequired = prereqEdges.some((e) => e.edge_type !== 'optional');
  const hasNarrative = (node.narrative_condition?.length ?? 0) > 0;

  return (
    <Sheet open onClose={onClose} title={node.title}>
      <div className="mb-3 flex items-start gap-3">
        {node.icon && (
          isIconUrl(node.icon)
            ? <img src={node.icon} alt="" className="h-9 w-9 shrink-0 object-contain" />
            : <span className="text-3xl leading-none">{node.icon}</span>
        )}
        <div className="flex flex-wrap gap-1.5">
          {level != null && <Badge>Рівень {level}</Badge>}
          {node.archetypes?.map((a) => <Badge key={a} tone="accent">{a}</Badge>)}
        </div>
      </div>

      {node.description && <p className="mb-1 text-sm leading-relaxed text-text-muted">{node.description}</p>}

      {node.effect?.length > 0 && (
        <InfoBlock label="Ефект">
          <ul className="list-disc space-y-1 pl-4">
            {node.effect.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </InfoBlock>
      )}

      {hasNarrative && (
        <InfoBlock label="Наративна умова">
          <ul className="list-disc space-y-1 pl-4">
            {node.narrative_condition.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </InfoBlock>
      )}

      {prereqs.length > 0 && (
        <InfoBlock label={
          <>
            Вимоги
            {hasOptional && hasRequired && <span className="font-normal text-text-dim"> (І + АБО)</span>}
            {hasOptional && !hasRequired && <span className="font-normal text-text-dim"> (будь-яке одне)</span>}
          </>
        }>
          <div className="flex flex-col gap-1.5">
            {prereqs.map(({ node: n, type }) => (
              <span key={n.id} className="flex items-center gap-1.5 text-sm">
                <ReqBadge type={type} />
                <span className="text-text-dim">{n.title}</span>
              </span>
            ))}
          </div>
        </InfoBlock>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {node.cost > 0 && <Badge>💰 {node.cost} {node.cost === 1 ? 'очко' : 'очків'}</Badge>}
        {hasNarrative && <Badge tone="accent">📖 наратив</Badge>}
      </div>

      {isGM && (
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" onClick={() => onEdit(node)}>Редагувати</Button>
          <Button variant="danger" onClick={() => onDelete(node.id)}><Trash2 size={15} /> Видалити</Button>
        </div>
      )}
    </Sheet>
  );
}

function InfoBlock({ label, children }) {
  return (
    <div className="mt-2 rounded-md border border-border bg-bg p-3">
      <p className="mb-1 text-xs uppercase tracking-wide text-text-dim">{label}</p>
      <div className="text-sm leading-relaxed text-text-muted">{children}</div>
    </div>
  );
}

function Badge({ tone = 'muted', children }) {
  const tones = {
    muted: 'bg-surface-hover text-text-dim',
    gold: 'bg-gold/15 text-gold',
    accent: 'bg-accent/15 text-accent',
  };
  return <span className={`inline-block rounded px-2 py-0.5 text-xs ${tones[tone]}`}>{children}</span>;
}

// ── Edge row: shared by the per-node connections editor and the
// single-edge settings modal — the other node's name, a required/optional
// toggle, and delete. ───────────────────────────────────────────────
function EdgeRow({ edge, otherTitle, onToggle, onDelete }) {
  const isOptional = edge.edge_type === 'optional';
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg px-3 py-2">
      <span className="text-sm text-text">{otherTitle}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggle}
          title={isOptional ? "Опціональний — натисни, щоб зробити обовʼязковим" : "Обов'язковий — натисни, щоб зробити опціональним"}
          className="rounded px-2 py-1 text-xs font-semibold"
          style={{
            background: isOptional ? 'var(--color-node-narrative-bg)' : 'var(--color-node-unlocked-bg)',
            color: isOptional ? 'var(--color-node-narrative)' : 'var(--color-sage)',
          }}
        >
          {isOptional ? 'АБО' : 'І'}
        </button>
        <button type="button" onClick={onDelete} title="Видалити звʼязок" className="rounded p-1.5 text-danger hover:bg-danger/10">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Node connections editor: grouped incoming (requirements) / outgoing
// (unlocks) edges for one node ───────────────────────────────────────
function NodeConnectionsModal({ node, nodes, edges, onToggle, onDelete, onClose }) {
  const incoming = edges
    .filter((e) => e.target_id === node.id)
    .map((e) => ({ edge: e, other: nodes.find((n) => n.id === e.source_id) }))
    .filter((x) => x.other);
  const outgoing = edges
    .filter((e) => e.source_id === node.id)
    .map((e) => ({ edge: e, other: nodes.find((n) => n.id === e.target_id) }))
    .filter((x) => x.other);

  return (
    <Sheet open onClose={onClose} title={`Звʼязки: ${node.title}`}>
      <div className="flex flex-col gap-4">
        <ConnectionsSection label="Вхідні (вимоги)" items={incoming} onToggle={onToggle} onDelete={onDelete} />
        <ConnectionsSection label="Вихідні (розблоковує)" items={outgoing} onToggle={onToggle} onDelete={onDelete} />
      </div>
    </Sheet>
  );
}

function ConnectionsSection({ label, items, onToggle, onDelete }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">{label}</p>
      {items.length === 0 ? (
        <p className="text-sm text-text-dim">Немає</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(({ edge, other }) => (
            <EdgeRow
              key={edge.id}
              edge={edge}
              otherTitle={other.title}
              onToggle={() => onToggle(edge.id, edge.edge_type)}
              onDelete={() => onDelete(edge.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Single-edge settings modal (canvas edge click) ──────────────────
function EdgeSettingsModal({ edge, sourceTitle, targetTitle, onToggle, onDelete, onClose }) {
  return (
    <Sheet open onClose={onClose} title="Звʼязок">
      <p className="mb-4 text-sm">
        <span className="text-text-dim">{sourceTitle}</span> <span className="text-text-dim">→</span> <span className="font-semibold text-text">{targetTitle}</span>
      </p>
      <EdgeRow edge={edge} otherTitle={targetTitle} onToggle={onToggle} onDelete={onDelete} />
    </Sheet>
  );
}

// ── Repeatable text-item list (mirrors SpellForm's components editor) ─────
function ArrayListField({ label, items, placeholder, onAdd, onRemove, onChangeItem, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">{label}</span>}
      <div className="flex flex-col gap-2">
        {items.map((val, i) => (
          <div key={i} className="flex items-start gap-2">
            <textarea
              rows={3}
              className={`${inputClass} flex-1 resize-y`}
              value={val}
              onChange={(e) => onChangeItem(i, e.target.value)}
              placeholder={placeholder ? `${placeholder} ${i + 1}` : undefined}
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              title="Видалити"
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded border border-danger/40 text-danger"
            >
              <X size={16} />
            </button>
          </div>
        ))}
        <button
          type="button" onClick={onAdd}
          className="inline-flex w-fit items-center gap-1.5 rounded border border-dashed border-border px-3 py-1.5 text-sm text-text-dim"
        >
          <Plus size={14} /> Додати пункт
        </button>
      </div>
    </div>
  );
}

// ── Node form modal ───────────────────────────────────────────────
function NodeFormModal({ form, error, onChange, onSave, onClose }) {
  const set = (field) => (e) => onChange((f) => ({ ...f, [field]: e.target.value }));
  const hasPoints = form.cost > 0;
  const hasNarrative = !!form.enableNarrative;

  const iconRef = useRef(null);
  const [iconUploading, setIconUploading] = useState(false);
  const [iconError, setIconError] = useState('');

  const handleIconFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) { setIconError('Файл завеликий — максимум 25 МБ'); return; }
    setIconError('');
    setIconUploading(true);
    try {
      const url = await mediaApi.upload(file, { entityType: 'skill-node-icon' });
      onChange((f) => ({ ...f, icon: url }));
    } catch (err) {
      setIconError(err.response?.data?.message || 'Не вдалось завантажити іконку');
    } finally {
      setIconUploading(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={form.id ? 'Редагувати вузол' : 'Новий вузол'}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Назва *</span>
          <input
            autoFocus className={inputClass} value={form.title} onChange={set('title')}
            onKeyDown={(e) => e.key === 'Enter' && onSave()}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Опис</span>
          <textarea rows={2} className={`${inputClass} resize-y`} value={form.description || ''} onChange={set('description')} />
        </label>

        <ArrayListField
          label="Ефект (механіка)"
          items={form.effect || []}
          placeholder="Ефект"
          onAdd={() => onChange((f) => ({ ...f, effect: [...(f.effect || []), ''] }))}
          onRemove={(i) => onChange((f) => ({ ...f, effect: f.effect.filter((_, idx) => idx !== i) }))}
          onChangeItem={(i, val) => onChange((f) => ({
            ...f, effect: f.effect.map((v, idx) => (idx === i ? val : v)),
          }))}
        />

        <div className="rounded-lg border border-border bg-bg p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-dim">Способи відкриття</p>

          <div className="mb-3 flex items-center gap-3">
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={hasPoints}
                onChange={(e) => onChange((f) => ({ ...f, cost: e.target.checked ? (f._lastCost || 1) : 0, _lastCost: f.cost || f._lastCost, require_both: e.target.checked ? f.require_both : false }))}
              />
              💰 За очки
            </label>
            {hasPoints && (
              <input
                type="number" min={1}
                value={form.cost}
                onChange={(e) => onChange((f) => ({ ...f, cost: Math.max(1, parseInt(e.target.value) || 1) }))}
                className={`${inputClass} w-20 min-h-9 py-1.5`}
              />
            )}
          </div>

          <div className="flex flex-col items-start gap-2">
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={hasNarrative}
                onChange={(e) => onChange((f) => ({ ...f, enableNarrative: e.target.checked, require_both: e.target.checked ? f.require_both : false }))}
              />
              📖 Наративне
            </label>
            {hasNarrative && (
              <ArrayListField
                items={form.narrative_condition || []}
                placeholder="Умова"
                onAdd={() => onChange((f) => ({ ...f, narrative_condition: [...(f.narrative_condition || []), ''] }))}
                onRemove={(i) => onChange((f) => ({
                  ...f, narrative_condition: f.narrative_condition.filter((_, idx) => idx !== i),
                }))}
                onChangeItem={(i, val) => onChange((f) => ({
                  ...f, narrative_condition: f.narrative_condition.map((v, idx) => (idx === i ? val : v)),
                }))}
                className="w-full"
              />
            )}
          </div>

          {hasPoints && hasNarrative && (
            <div className="mt-3 flex gap-4">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-text">
                <input type="radio" name="unlock_mode" checked={!form.require_both} onChange={() => onChange((f) => ({ ...f, require_both: false }))} />
                🔀 На вибір
              </label>
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-text">
                <input type="radio" name="unlock_mode" checked={!!form.require_both} onChange={() => onChange((f) => ({ ...f, require_both: true }))} />
                🔒 Обидва необхідні
              </label>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Іконка</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded border border-border bg-bg text-xl">
                {isIconUrl(form.icon) ? <img src={form.icon} alt="" className="h-7 w-7 object-contain" /> : (form.icon || '—')}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => iconRef.current?.click()} disabled={iconUploading}>
                <Upload size={14} /> {iconUploading ? 'Завантаження…' : 'Своя іконка'}
              </Button>
              <input
                className={`${inputClass} w-20 text-center`}
                placeholder="😀"
                value={isIconUrl(form.icon) ? '' : (form.icon || '')}
                onChange={set('icon')}
                maxLength={8}
              />
              {form.icon && (
                <button type="button" onClick={() => onChange((f) => ({ ...f, icon: '' }))} className="text-xs text-text-dim hover:text-danger">
                  Очистити
                </button>
              )}
              <input ref={iconRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={handleIconFile} />
            </div>
            {iconError && <p className="text-xs text-danger">{iconError}</p>}
            <p className="text-xs text-text-dim">Своє зображення (PNG, WebP, GIF) або emoji.</p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Дерево</span>
            <span className="py-2 text-sm text-accent">{ARCHETYPES[form.archetype]?.label ?? form.archetype}</span>
          </label>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-3">
          <Button onClick={onSave}>Зберегти</Button>
          <Button variant="ghost" onClick={onClose}>Скасувати</Button>
        </div>
      </div>
    </Sheet>
  );
}
