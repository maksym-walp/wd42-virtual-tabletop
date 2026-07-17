import { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, Link2, Plus, Download, Upload, Pencil, Trash2, LayoutGrid,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import skillTreeApi from '../api/skillTree';
import { RACES, ARCHETYPES, ARCHETYPE_COLORS } from '../constants/characterSheet';
import useSvgPanZoom from '../hooks/useSvgPanZoom';
import Sheet from '../components/ui/Sheet';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import ReqBadge from '../components/ui/ReqBadge';

const NODE_R = 32;
const DRAG_CLICK_THRESHOLD_PX = 5; // movement past this during a node drag suppresses the trailing click
const LEVEL_SPACING_Y = 260; // vertical gap between prerequisite levels when auto-laying-out
const SIBLING_SPACING_X = 280; // horizontal gap between sibling nodes — wide enough that a full-length title label never reaches the next node

// A node's level is derived from the graph, not stored: root = 1, otherwise
// 1 + the deepest prerequisite's level (handles require_both multi-parent nodes).
function computeLevels(nodes, edges) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const parentsOf = new Map();
  edges.forEach((e) => {
    if (!parentsOf.has(e.target_id)) parentsOf.set(e.target_id, []);
    parentsOf.get(e.target_id).push(e.source_id);
  });

  const levels = {};
  const levelOf = (id, visiting) => {
    if (levels[id] != null) return levels[id];
    const node = nodeMap.get(id);
    if (!node) return 1;
    if (node.is_root) { levels[id] = 1; return 1; }
    const parents = (parentsOf.get(id) || []).filter((pid) => nodeMap.has(pid));
    if (parents.length === 0) { levels[id] = 2; return 2; }
    if (visiting.has(id)) return 1; // cycle guard fallback
    visiting.add(id);
    const level = 1 + Math.max(...parents.map((pid) => levelOf(pid, visiting)));
    visiting.delete(id);
    levels[id] = level;
    return level;
  };

  nodes.forEach((n) => levelOf(n.id, new Set()));
  return levels;
}

// Semi-automatic layout: places nodes on fixed level bands (y) with siblings
// spread symmetrically (x), leaving the result freely draggable afterward.
function computeAutoLayout(nodes, edges) {
  const levels = computeLevels(nodes, edges);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map();
  edges.forEach((e) => {
    if (!childrenOf.has(e.source_id)) childrenOf.set(e.source_id, []);
    childrenOf.get(e.source_id).push(e.target_id);
  });

  const sortedNodes = [...nodes].sort((a, b) => a.pos_x - b.pos_x);
  const xMemo = new Map();
  let nextSlot = 0;
  const computeX = (id, visiting) => {
    if (xMemo.has(id)) return xMemo.get(id);
    if (visiting.has(id)) return 0; // cycle guard
    const kids = (childrenOf.get(id) || [])
      .filter((cid) => nodeMap.has(cid))
      .sort((a, b) => nodeMap.get(a).pos_x - nodeMap.get(b).pos_x);
    if (kids.length === 0) {
      const x = nextSlot * SIBLING_SPACING_X;
      nextSlot += 1;
      xMemo.set(id, x);
      return x;
    }
    visiting.add(id);
    const childXs = kids.map((cid) => computeX(cid, visiting));
    visiting.delete(id);
    const x = childXs.reduce((a, b) => a + b, 0) / childXs.length;
    xMemo.set(id, x);
    return x;
  };

  sortedNodes.filter((n) => levels[n.id] === 1).forEach((n) => computeX(n.id, new Set()));
  sortedNodes.forEach((n) => computeX(n.id, new Set())); // catches nodes unreachable from any root

  const rootXs = nodes.filter((n) => levels[n.id] === 1).map((n) => xMemo.get(n.id) ?? 0);
  const originX = rootXs.length ? rootXs.reduce((a, b) => a + b, 0) / rootXs.length : 0;

  const positions = {};
  nodes.forEach((n) => {
    const level = levels[n.id] ?? 2;
    positions[n.id] = {
      pos_x: Math.round((xMemo.get(n.id) ?? 0) - originX),
      pos_y: Math.round(-(level - 1) * LEVEL_SPACING_Y),
    };
  });
  return positions;
}

// Where a new "+"-added child of `parent` should land: to the right of its
// existing children (or directly below the parent if it has none yet).
function computeChildSlot(parent, nodes, edges) {
  const childIds = new Set(edges.filter((e) => e.source_id === parent.id).map((e) => e.target_id));
  const children = nodes.filter((n) => childIds.has(n.id));
  const pos_x = children.length
    ? Math.max(...children.map((c) => c.pos_x)) + SIBLING_SPACING_X
    : parent.pos_x;
  return { pos_x, pos_y: parent.pos_y - LEVEL_SPACING_Y };
}

export default function SkillTree() {
  const { user } = useAuth();
  const isGM = user?.role === 'game_master';

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterRace, setFilterRace] = useState('');
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
  const [dragState, setDragState] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  const levels = useMemo(() => computeLevels(nodes, edges), [nodes, edges]);

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

  const loadTree = (archetype, race) => {
    setLoading(true);
    pendingCenterRef.current = true;
    Promise.all([
      skillTreeApi.getNodes({ archetype, race: race || undefined }),
      skillTreeApi.getEdges({ archetype }),
    ]).then(([n, e]) => {
      setNodes(n);
      setEdges(e);
    }).catch(() => setActionError('Не вдалось завантажити дерево'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTree('fighter'); }, []);

  // Centers the camera on the root node once a (re)load finishes, so opening
  // the tab never leaves the player staring at empty canvas because the
  // node graph sits away from the fixed default {x:120,y:120} origin.
  useEffect(() => {
    if (!pendingCenterRef.current || loading || !svgRef.current || nodes.length === 0) return;
    const root = nodes.find((n) => n.is_root) || nodes[0];
    const rect = svgRef.current.getBoundingClientRect();
    setTransform((t) => ({
      ...t,
      x: rect.width / 2 - root.pos_x * t.k,
      y: rect.height / 2 - root.pos_y * t.k,
    }));
    pendingCenterRef.current = false;
  }, [nodes, loading, setTransform]);

  const handleFilterChange = (race) => {
    loadTree(activeArchetype, race);
  };

  const handleArchetypeChange = (archetype) => {
    setActiveArchetype(archetype);
    setSelectedNode(null);
    setFilterRace('');
    setTransform({ x: 120, y: 120, k: 1 });
    loadTree(archetype);
  };

  // Edge endpoint on circle surface
  const edgePoints = (srcId, dstId) => {
    const s = nodes.find((n) => n.id === srcId);
    const d = nodes.find((n) => n.id === dstId);
    if (!s || !d) return null;
    const dx = d.pos_x - s.pos_x;
    const dy = d.pos_y - s.pos_y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return null;
    const nx = dx / dist;
    const ny = dy / dist;
    return {
      x1: s.pos_x + nx * NODE_R,
      y1: s.pos_y + ny * NODE_R,
      x2: d.pos_x - nx * (NODE_R + 6),
      y2: d.pos_y - ny * (NODE_R + 6),
    };
  };

  // ── Pan/zoom (mouse-drag/wheel or touch-drag/pinch) ────────────────
  // Node click/drag (below) stopPropagation()s before this ever sees the
  // event when a GM drag actually starts; the tag check is a fallback for
  // when a mousedown/pointerdown on a node bubbles up unhandled (e.g. not in
  // GM edit mode) so it isn't misread as the start of a canvas pan.
  const handleSvgPointerDown = (e) => {
    if (dragState || e.button !== 0) return;
    const tag = e.target.tagName;
    if (tag === 'circle' || tag === 'text') return;
    panZoom.bind.onPointerDown(e);
  };

  const handleSvgPointerMove = (e) => {
    if (dragState) {
      const screenDist = Math.hypot(e.clientX - dragState.startClientX, e.clientY - dragState.startClientY);
      if (screenDist > DRAG_CLICK_THRESHOLD_PX) dragMovedRef.current = true;

      const dx = (e.clientX - dragState.startClientX) / transform.k;
      const dy = (e.clientY - dragState.startClientY) / transform.k;
      setNodes((prev) =>
        prev.map((n) =>
          n.id === dragState.nodeId
            ? { ...n, pos_x: dragState.origX + dx, pos_y: dragState.origY + dy }
            : n,
        ),
      );
      return;
    }
    panZoom.bind.onPointerMove(e);
  };

  const endNodeDrag = async () => {
    if (!dragState) return;
    const saved = dragState;
    setDragState(null);
    const node = nodes.find((n) => n.id === saved.nodeId);
    if (node) {
      try {
        await skillTreeApi.updateNode(node.id, node);
      } catch {
        setActionError('Не вдалось зберегти позицію');
      }
    }
  };

  const handleSvgPointerUp = (e) => { endNodeDrag(); panZoom.bind.onPointerUp(e); };
  const handleSvgPointerCancel = (e) => { endNodeDrag(); panZoom.bind.onPointerCancel(e); };

  // ── Node interaction ──────────────────────────────────────────────
  const handleNodeMouseDown = (e, node) => {
    if (!isGM || !editMode || connectMode) return;
    e.stopPropagation();
    dragMovedRef.current = false;
    setDragState({
      nodeId: node.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: node.pos_x,
      origY: node.pos_y,
    });
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
    const cx = (-transform.x + window.innerWidth / 2) / transform.k;
    const cy = (-transform.y + window.innerHeight / 2) / transform.k;
    setNodeForm({
      title: '', description: '', icon: '', cost: 1,
      enableNarrative: false, narrative_condition: [],
      effect: [],
      races: Object.keys(RACES).filter((k) => k !== 'other'),
      archetype: activeArchetype, require_both: false,
      pos_x: Math.round(cx), pos_y: Math.round(cy),
    });
  };

  // "+" affordance under a selected node: pre-fills the next level's slot and
  // wires the new node up as a required child once it's saved.
  const openNewChildForm = (parent) => {
    const slot = computeChildSlot(parent, nodes, edges);
    setNodeForm({
      title: '', description: '', icon: '', cost: 1,
      enableNarrative: false, narrative_condition: [],
      effect: [],
      races: Object.keys(RACES).filter((k) => k !== 'other'),
      archetype: activeArchetype, require_both: false,
      pos_x: Math.round(slot.pos_x), pos_y: Math.round(slot.pos_y),
      _parentId: parent.id,
    });
  };

  const handleAutoLayout = async () => {
    const archetypeLabel = ARCHETYPES[activeArchetype]?.label ?? activeArchetype;
    if (!window.confirm(`Вирівняти всі ${nodes.length} вузлів дерева «${archetypeLabel}» по сітці рівнів?`)) return;
    const positions = computeAutoLayout(nodes, edges);
    const updatedNodes = nodes.map((n) => ({ ...n, ...positions[n.id] }));
    setNodes(updatedNodes);
    try {
      await Promise.all(updatedNodes.map((n) => skillTreeApi.updateNode(n.id, n)));
      showToast('success', 'Дерево вирівняно');
    } catch {
      setActionError('Не вдалось зберегти нове розташування для всіх вузлів');
    }
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
        console.log('[skill-tree] node updated', updated);
        showToast('success', `Вузол «${updated.title}» оновлено`);
      } else {
        const created = await skillTreeApi.createNode(payload);
        setNodes((prev) => [...prev, created]);
        if (nodeForm._parentId) {
          await doCreateEdge(nodeForm._parentId, created.id);
        }
        console.log('[skill-tree] node created', created);
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
      console.log('[skill-tree] node deleted', nodeId);
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
          <select
            className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text"
            value={filterRace}
            onChange={(e) => {
              setFilterRace(e.target.value);
              handleFilterChange(e.target.value);
            }}
          >
            <option value="">Всі народи</option>
            {Object.entries(RACES).map(([key, r]) => (
              <option key={key} value={key}>{r.label}</option>
            ))}
          </select>
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
              <IconBtn icon={LayoutGrid} label="Вирівняти" onClick={handleAutoLayout} title="Вирівняти вузли по рівнях" />
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
          className="h-full w-full touch-none select-none"
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
              <path d="M0,0 L0,6 L8,3 z" fill="#8a6a3e" />
            </marker>
          </defs>

          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {/* Edges */}
            {edges.map((edge) => {
              const pts = edgePoints(edge.source_id, edge.target_id);
              if (!pts) return null;
              const mx = (pts.x1 + pts.x2) / 2;
              const my = (pts.y1 + pts.y2) / 2;
              const isOptional = edge.edge_type === 'optional';
              return (
                <g key={edge.id}>
                  <line
                    x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}
                    stroke={isOptional ? '#a68a55' : '#8a6a3e'}
                    strokeWidth={isOptional ? 1.5 : 2}
                    strokeDasharray={isOptional ? '6,4' : undefined}
                    markerEnd="url(#arrow)"
                    style={{ pointerEvents: 'none' }}
                  />
                  {isGM && editMode && (
                    <g>
                      <circle cx={mx - 11} cy={my} r={9}
                        fill={isOptional ? '#e3d6e8' : '#dce8d6'}
                        stroke={isOptional ? '#5a3a6a' : '#3f5b3a'}
                        strokeWidth={1} style={{ cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); handleToggleEdgeType(edge.id, edge.edge_type); }}
                      />
                      <text x={mx - 11} y={my + 4} textAnchor="middle" fontSize={8}
                        fill={isOptional ? '#5a3a6a' : '#3f5b3a'}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}>
                        {isOptional ? 'АБО' : 'І'}
                      </text>
                      <circle cx={mx + 11} cy={my} r={9}
                        fill="#f0dad4" stroke="#7a2e1d" strokeWidth={1}
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); handleDeleteEdge(edge.id); }}
                      />
                      <text x={mx + 11} y={my + 4} textAnchor="middle" fontSize={11}
                        fill="#7a2e1d" style={{ pointerEvents: 'none', userSelect: 'none' }}>×</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const selected = selectedNode?.id === node.id;
              const isSrc = connectSource?.id === node.id;
              const ac = ARCHETYPE_COLORS[node.archetype];

              const stroke = isSrc ? '#5b440a'
                : selected ? '#8a5a2b'
                : ac?.color || '#b5ab91';
              // Stronger tint than the badge's 0.12 alpha — nodes sit on the tan canvas, not the page bg.
              const fill = ac ? ac.bg.replace('0.12', '0.28') : '#f4efe4';
              const textColor = ac?.color || '#5b440a';

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.pos_x},${node.pos_y})`}
                  style={{ cursor: editMode && !connectMode ? 'move' : 'pointer' }}
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

                  {/* Icon or initials */}
                  <text
                    x={0} y={node.icon ? 9 : 6}
                    textAnchor="middle"
                    fontSize={node.icon ? 24 : 15}
                    fill={textColor}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.icon || node.title.substring(0, 2)}
                  </text>

                  {/* Name label */}
                  <text
                    x={NODE_R + 10} y={5}
                    textAnchor="start"
                    fontSize={13}
                    fill={textColor}
                    fontWeight={selected ? 700 : 500}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.title.length > 20 ? node.title.slice(0, 18) + '…' : node.title}
                  </text>

                  {/* Unlock type hint */}
                  <text
                    x={NODE_R + 10} y={21}
                    textAnchor="start" fontSize={10} fill="#8a6a3e"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.cost > 0 && node.narrative_condition
                      ? `${node.cost} оч. або наратив`
                      : node.cost > 0
                      ? `${node.cost} ${node.cost === 1 ? 'очко' : 'очків'}`
                      : 'наратив'}
                  </text>
                </g>
              );
            })}

            {/* Add-child affordances — one "+" under every node as soon as edit mode is on */}
            {isGM && editMode && !connectMode && nodes.map((node) => {
              const slot = computeChildSlot(node, nodes, edges);
              return (
                <g
                  key={`add-${node.id}`}
                  transform={`translate(${slot.pos_x},${slot.pos_y})`}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); openNewChildForm(node); }}
                >
                  <circle r={16} fill="#dce8d6" stroke="#3f5b3a" strokeWidth={1.5} strokeDasharray="4,3" />
                  <text x={0} y={6} textAnchor="middle" fontSize={18} fill="#3f5b3a"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>+</text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Hover tooltip */}
        {tooltip && (
          <Tooltip tooltip={tooltip} nodes={nodes} edges={edges} />
        )}

        {nodes.length === 0 && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-text-dim">
            {isGM ? 'Вмикай «Редагувати» і додавай перший вузол' : 'Дерево розвитку ще порожнє'}
          </div>
        )}

        {/* Detail panel */}
        {selectedNode && !nodeForm && (
          <NodePanel
            node={selectedNode}
            nodes={nodes}
            edges={edges}
            level={levels[selectedNode.id]}
            isGM={isGM}
            onEdit={(n) => {
              setNodeForm({
                ...n,
                enableNarrative: (n.narrative_condition?.length ?? 0) > 0,
                narrative_condition: n.narrative_condition || [],
                effect: n.effect || [],
                races: n.races || [],
                archetype: n.archetype || activeArchetype,
                require_both: n.require_both || false,
              });
            }}
            onDelete={handleDeleteNode}
            onClose={() => setSelectedNode(null)}
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
      {node.races?.length > 0 && (
        <div className="mt-2">
          <TtLabel>Народи</TtLabel>
          <p className="text-xs leading-relaxed text-gold">{node.races.join(', ')}</p>
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
// ── Node detail panel ─────────────────────────────────────────────
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
        {node.icon && <span className="text-3xl leading-none">{node.icon}</span>}
        <div className="flex flex-wrap gap-1.5">
          {level != null && <Badge>Рівень {level}</Badge>}
          {node.races?.map((r) => <Badge key={r} tone="gold">{r}</Badge>)}
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
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Іконка (емодзі)</span>
            <input className={inputClass} value={form.icon || ''} onChange={set('icon')} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Дерево</span>
            <span className="py-2 text-sm text-accent">{ARCHETYPES[form.archetype]?.label ?? form.archetype}</span>
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Народи</span>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {Object.entries(RACES).filter(([key]) => key !== 'other').map(([key, r]) => (
                <label key={key} className="flex cursor-pointer select-none items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={(form.races || []).includes(key)}
                    onChange={(e) => onChange((f) => ({
                      ...f,
                      races: e.target.checked
                        ? [...(f.races || []), key]
                        : (f.races || []).filter((x) => x !== key),
                    }))}
                  />
                  {r.label}
                </label>
              ))}
            </div>
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
