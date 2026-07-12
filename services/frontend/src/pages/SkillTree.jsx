import { useState, useEffect, useRef } from 'react';
import {
  X, Link2, Plus, Download, Upload, Pencil, RefreshCw, Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import skillTreeApi from '../api/skillTree';
import spellbookApi from '../api/spellbook';
import { RACES, ARCHETYPES, ARCHETYPE_COLORS } from '../constants/characterSheet';
import useSvgPanZoom from '../hooks/useSvgPanZoom';
import Sheet from '../components/ui/Sheet';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';

const NODE_R = 32;
const DRAG_CLICK_THRESHOLD_PX = 5; // movement past this during a node drag suppresses the trailing click

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

  const [selectedNode, setSelectedNode] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [connectMode, setConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [tooltip, setTooltip] = useState(null);

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

  const [activeTab, setActiveTab] = useState('skills');
  const [spells, setSpells] = useState([]);
  const [spellPositions, setSpellPositions] = useState([]);
  const [spellsLoading, setSpellsLoading] = useState(false);
  const [selectedSpell, setSelectedSpell] = useState(null);

  const importRef = useRef(null);

  const computeSpellPositions = (spellList) => {
    const groups = {};
    spellList.forEach((sp) => {
      const key = sp.energy_cost ?? 0;
      if (!groups[key]) groups[key] = [];
      groups[key].push(sp);
    });
    const costs = Object.keys(groups).map(Number).sort((a, b) => a - b);
    const result = [];
    costs.forEach((cost, colIdx) => {
      groups[cost].forEach((sp, rowIdx) => {
        result.push({ ...sp, pos_x: colIdx * 220 + 120, pos_y: rowIdx * 110 + 100 });
      });
    });
    return result;
  };

  const loadSpells = () => {
    setSpellsLoading(true);
    spellbookApi.getAll()
      .then((data) => {
        setSpells(data);
        setSpellPositions(computeSpellPositions(data));
      })
      .catch(() => setActionError('Не вдалось завантажити заклинання'))
      .finally(() => setSpellsLoading(false));
  };

  const loadTree = (archetype, race) => {
    setLoading(true);
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

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedNode(null);
    setSelectedSpell(null);
    setTooltip(null);
    setTransform({ x: 120, y: 120, k: 1 });
    if (tab === 'spells' && spells.length === 0) loadSpells();
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
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skill-tree-${new Date().toISOString().split('T')[0]}.json`;
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
      if (!window.confirm(
        `Імпортувати ${data.nodes.length} вузлів і ${data.edges.length} звʼязків?\n\nВесь прогрес персонажів по дереву буде видалено!`
      )) return;
      await skillTreeApi.importTree(data);
      const [n, ed] = await Promise.all([
        skillTreeApi.getNodes(),
        skillTreeApi.getEdges(),
      ]);
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
        <div className="flex shrink-0 gap-1">
          <button
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              activeTab === 'skills' ? 'border-accent/50 bg-surface text-accent' : 'border-border text-text-dim'
            }`}
            onClick={() => handleTabChange('skills')}
          >
            Дерево розвитку
          </button>
          <button
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              activeTab === 'spells' ? 'border-accent/50 bg-surface text-accent' : 'border-border text-text-dim'
            }`}
            onClick={() => handleTabChange('spells')}
          >
            Дерево заклинань
          </button>
        </div>

        {activeTab === 'skills' && (
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
        )}

        {activeTab === 'spells' && <div className="flex-1" />}

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {activeTab === 'skills' && isGM && editMode && (
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
          {activeTab === 'skills' && isGM && (
            <IconBtn
              active={editMode}
              icon={Pencil}
              label={editMode ? 'Редагування' : 'Редагувати'}
              onClick={() => { setEditMode((m) => !m); setConnectMode(false); setConnectSource(null); }}
            />
          )}
          {activeTab === 'spells' && spells.length > 0 && (
            <IconBtn icon={RefreshCw} label="Оновити" onClick={loadSpells} />
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
          onClick={() => { setSelectedNode(null); setSelectedSpell(null); }}
        >
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#8a6a3e" />
            </marker>
          </defs>

          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {/* Edges */}
            {activeTab === 'skills' && edges.map((edge) => {
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

            {/* Spell nodes (spell tree tab) */}
            {activeTab === 'spells' && spellPositions.map((sp) => {
              const selected = selectedSpell?.id === sp.id;
              return (
                <g
                  key={sp.id}
                  transform={`translate(${sp.pos_x},${sp.pos_y})`}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); setSelectedSpell(sp); }}
                  onMouseEnter={(e) => {
                    const rect = svgRef.current.getBoundingClientRect();
                    setTooltip({ node: { title: sp.name, description: sp.mechanical_desc || sp.narrative_desc }, x: e.clientX - rect.left, y: e.clientY - rect.top });
                  }}
                  onMouseLeave={handleNodeLeave}
                >
                  <circle
                    r={NODE_R}
                    fill="#e5e1ee"
                    stroke={selected ? '#3d2350' : '#8a7aa0'}
                    strokeWidth={selected ? 2.5 : 1.5}
                  />
                  <text x={0} y={6} textAnchor="middle" fontSize={15} fill="#4a3d66"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {sp.name.substring(0, 2)}
                  </text>
                  <text x={NODE_R + 10} y={5} textAnchor="start" fontSize={13} fill="#4a3d66"
                    fontWeight={selected ? 700 : 500}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {sp.name.length > 20 ? sp.name.slice(0, 18) + '…' : sp.name}
                  </text>
                  <text x={NODE_R + 10} y={21} textAnchor="start" fontSize={10} fill="#8a7aa0"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {sp.energy_cost ?? 0} ен. • {sp.magic_type ?? '—'}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {activeTab === 'skills' && nodes.map((node) => {
              const selected = selectedNode?.id === node.id;
              const isSrc = connectSource?.id === node.id;
              const hasRaces = node.races?.length > 0;
              const hasArchetypes = node.archetypes?.length > 0;
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

                  {/* Race indicator — gold dot top-left */}
                  {hasRaces && (
                    <circle cx={-NODE_R + 8} cy={-NODE_R + 8} r={5}
                      fill="#8a5a2b" stroke="#5b440a" strokeWidth={1}
                      style={{ pointerEvents: 'none' }} />
                  )}

                  {/* Archetype indicator — violet dot top-right */}
                  {hasArchetypes && (
                    <circle cx={NODE_R - 8} cy={-NODE_R + 8} r={5}
                      fill="#4a3d66" stroke="#5b440a" strokeWidth={1}
                      style={{ pointerEvents: 'none' }} />
                  )}

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
          </g>
        </svg>

        {/* Hover tooltip */}
        {tooltip && (
          <Tooltip tooltip={tooltip} nodes={nodes} edges={edges} />
        )}

        {activeTab === 'skills' && nodes.length === 0 && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-text-dim">
            {isGM ? 'Вмикай «Редагувати» і додавай перший вузол' : 'Дерево розвитку ще порожнє'}
          </div>
        )}
        {activeTab === 'spells' && spellsLoading && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-text-dim">Завантаження заклинань...</div>
        )}
        {activeTab === 'spells' && !spellsLoading && spells.length === 0 && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-text-dim">Заклинань ще немає</div>
        )}

        {/* Detail panel */}
        {activeTab === 'skills' && selectedNode && !nodeForm && (
          <NodePanel
            node={selectedNode}
            nodes={nodes}
            edges={edges}
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
        {activeTab === 'spells' && selectedSpell && (
          <SpellPanel spell={selectedSpell} onClose={() => setSelectedSpell(null)} />
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
function ReqBadge({ type }) {
  const optional = type === 'optional';
  return (
    <span className={`rounded px-1 text-[0.65rem] ${optional ? 'bg-accent/15 text-accent' : 'bg-sage/15 text-sage'}`}>
      {optional ? 'АБО' : 'І'}
    </span>
  );
}

// ── Node detail panel ─────────────────────────────────────────────
function NodePanel({ node, nodes, edges, isGM, onEdit, onDelete, onClose }) {
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

// ── Spell detail panel ────────────────────────────────────────────
const KIND_LABELS = { offensive: 'Наступальне', defensive: 'Захисне', utility: 'Утилітарне', healing: 'Лікування', passive: 'Пасивне' };
const RITUAL_LABELS = { impossible: null, possible: 'Можна ритуалом', only_ritual: 'Тільки ритуал' };

function SpellPanel({ spell, onClose }) {
  return (
    <Sheet open onClose={onClose} title={spell.name}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {spell.magic_type && <Badge tone="accent">{spell.magic_type}</Badge>}
        {spell.spell_kind && <Badge>{KIND_LABELS[spell.spell_kind] ?? spell.spell_kind}</Badge>}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <Badge>⚡ {spell.energy_cost ?? 0} ен.</Badge>
        <Badge>⏱ {spell.action_time ?? 1} {spell.action_time === 1 ? 'дія' : 'дії'}</Badge>
        {RITUAL_LABELS[spell.ritual] && <Badge tone="accent">{RITUAL_LABELS[spell.ritual]}</Badge>}
      </div>

      {(spell.duration_value != null || spell.range_desc) && (
        <InfoBlock label="Тривалість / Дальність">
          {spell.duration_value != null ? `${spell.duration_value} ${spell.duration_unit ?? ''}` : ''}
          {spell.range_desc ? ` • ${spell.range_desc}` : ''}
        </InfoBlock>
      )}
      {spell.mechanical_desc && <InfoBlock label="Механіка">{spell.mechanical_desc}</InfoBlock>}
      {spell.narrative_desc && <InfoBlock label="Наратив">{spell.narrative_desc}</InfoBlock>}
      {spell.components?.length > 0 && (
        <InfoBlock label="Компоненти">{spell.components.join(', ')}</InfoBlock>
      )}
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
