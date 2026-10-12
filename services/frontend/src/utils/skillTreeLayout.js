// Shared layout engine for the skill tree — used by both the GM editor
// (pages/SkillTree.jsx) and the read-only viewer (CharacterSheet.jsx's
// TreeTab). Positions are always *derived* from the graph (level + parent
// references), never stored as pixel coordinates: `pos_x` on a node is
// repurposed as a manual tie-break rank within its sibling cluster (see
// `computeLayout`), and `pos_y` is unused.

export const LEVEL_SPACING_Y = 220; // vertical gap between prerequisite levels
export const MIN_SLOT_SPACING_X = 160; // *minimum* horizontal gap between any two nodes on the same level — never a cap, nodes spread further apart than this whenever their subtrees need the room

// A node's level is derived from the graph, not stored: root = 1, otherwise
// 1 + the deepest prerequisite's level (handles require_both multi-parent nodes).
export function computeLevels(nodes, edges) {
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

// Canonical key identifying a node's "sibling cluster" — every node sharing
// the exact same parent set. Roots share one cluster, unconnected/new nodes
// (no parents, not root) share another. Used for drag-to-swap eligibility:
// comparing this string (not the averaged `refIndex` used for ordering)
// avoids floating-point-equality bugs between logically-unrelated nodes
// whose parent-index averages happen to coincide.
function clusterKeyOf(id, nodeMap, parentsOf) {
  const node = nodeMap.get(id);
  if (node?.is_root) return '__root__';
  const parents = (parentsOf.get(id) || []).filter((pid) => nodeMap.has(pid));
  if (parents.length === 0) return '__orphan__';
  return [...new Set(parents)].sort().join(',');
}

// Computes a fully derived layout in two passes.
//
// Pass 1 (DFS, roots first): establishes left-to-right *order* only — a leaf
// (no children) claims the next free slot; recursion visits an entire
// subtree, left to right, before moving to the next sibling/root, which is
// what keeps a branch's nodes grouped together rather than interleaved by
// creation order. Internal (non-leaf) nodes are not given a final x here —
// pass 2 always recomputes them — this pass only decides ordering and which
// nodes are leaves.
//
// Pass 2 (level by level, deepest to shallowest): each level's internal
// nodes are set to the average x of their own children — which, because we
// go deepest-first, are already fully finalized (both averaged/leaf-placed
// *and* minimum-gap-swept) by the time a shallower level reads them. Then a
// single left-to-right sweep enforces `MIN_SLOT_SPACING_X` as a hard floor
// between every consecutive pair at that level, pushing later ones right as
// needed — never a cap, so a wide subtree is simply free to spread further
// apart than the minimum. Processing bottom-up like this means a parent
// always settles over where its children actually *ended up* (post-sweep),
// not where they started — this is what centers a parent over its children
// even when a sibling subtree needed extra room. When a push happens, it
// also drags the pushed node's exclusive (single-parent) descendants along
// by the same amount, so centering survives the push instead of only
// applying to whichever node happened to need the least room. A trailing
// pass then recenters any node with no children of its own but 2+ parents
// (it never went through the above rule at all) over its now-final parents.
export function computeLayout(nodes, edges) {
  const levels = computeLevels(nodes, edges);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const parentsOf = new Map();
  const childrenOf = new Map();
  edges.forEach((e) => {
    if (!parentsOf.has(e.target_id)) parentsOf.set(e.target_id, []);
    parentsOf.get(e.target_id).push(e.source_id);
    if (!childrenOf.has(e.source_id)) childrenOf.set(e.source_id, []);
    childrenOf.get(e.source_id).push(e.target_id);
  });

  const sortedNodes = [...nodes].sort((a, b) => (a.pos_x ?? 0) - (b.pos_x ?? 0));

  let nextSlot = 0;
  const xMemo = new Map(); // node id -> x (leaf: final from pass 1; internal: overwritten in pass 2)
  const isLeaf = new Map(); // node id -> bool

  const visitOrder = (id, visiting) => {
    if (isLeaf.has(id)) return;
    if (visiting.has(id)) return; // cycle guard
    visiting.add(id);
    const kids = (childrenOf.get(id) || [])
      .filter((cid) => nodeMap.has(cid))
      .sort((a, b) => (nodeMap.get(a).pos_x ?? 0) - (nodeMap.get(b).pos_x ?? 0));
    kids.forEach((cid) => visitOrder(cid, visiting));
    visiting.delete(id);

    if (kids.length === 0) {
      xMemo.set(id, nextSlot * MIN_SLOT_SPACING_X);
      nextSlot += 1;
      isLeaf.set(id, true);
    } else {
      isLeaf.set(id, false);
    }
  };

  // Roots first (each fully resolves its whole reachable subtree as one
  // contiguous left-to-right block before the next root starts), then
  // anything left over (orphans / disconnected islands).
  sortedNodes.filter((n) => n.is_root).forEach((n) => visitOrder(n.id, new Set()));
  sortedNodes.forEach((n) => visitOrder(n.id, new Set()));

  const maxLevel = nodes.reduce((m, n) => Math.max(m, levels[n.id] ?? 1), 1);
  const nodesByLevel = new Map();
  nodes.forEach((n) => {
    const level = levels[n.id] ?? 1;
    if (!nodesByLevel.has(level)) nodesByLevel.set(level, []);
    nodesByLevel.get(level).push(n);
  });

  // When the sweep below has to push a node sideways to keep the minimum
  // gap from its neighbor, that alone breaks "parent centered over
  // children" for anything already-placed above it — the push moves the
  // node but leaves its children exactly where they were. Dragging the
  // node's descendants along by the same delta restores that centering,
  // but only through nodes with exactly one parent: a shared node (2+
  // incoming edges, like a require_both target) is also anchored by its
  // OTHER parent, so forcibly dragging it to satisfy just this one would
  // misalign it from that other parent instead — there's no single
  // position that centers a shared node under every parent it has at
  // once, so this leaves shared nodes alone rather than picking a side.
  const singleParentOf = new Map(); // node id -> its one parent, only set when it has exactly one
  edges.forEach((e) => {
    if (!nodeMap.has(e.source_id) || !nodeMap.has(e.target_id)) return;
    if (singleParentOf.has(e.target_id)) { singleParentOf.set(e.target_id, null); return; }
    singleParentOf.set(e.target_id, e.source_id);
  });
  const dragDescendants = (id, delta, visited) => {
    (childrenOf.get(id) || []).forEach((cid) => {
      if (visited.has(cid) || !xMemo.has(cid)) return;
      if (singleParentOf.get(cid) !== id) return; // shared (or not actually this node's child alone) — leave it
      visited.add(cid);
      xMemo.set(cid, xMemo.get(cid) + delta);
      dragDescendants(cid, delta, visited);
    });
  };

  for (let level = maxLevel; level >= 1; level -= 1) {
    const levelNodes = nodesByLevel.get(level) || [];
    if (levelNodes.length === 0) continue;

    levelNodes.forEach((n) => {
      if (isLeaf.get(n.id)) return; // pass-1 value is already final
      const kids = (childrenOf.get(n.id) || []).filter((cid) => xMemo.has(cid));
      if (kids.length === 0) return; // shouldn't happen (would have been a leaf), guard anyway
      const avg = kids.reduce((s, cid) => s + xMemo.get(cid), 0) / kids.length;
      xMemo.set(n.id, avg);
    });

    const ordered = [...levelNodes].sort((a, b) => xMemo.get(a.id) - xMemo.get(b.id));
    for (let i = 1; i < ordered.length; i += 1) {
      const prev = ordered[i - 1];
      const cur = ordered[i];
      const minX = xMemo.get(prev.id) + MIN_SLOT_SPACING_X;
      if (xMemo.get(cur.id) < minX) {
        const delta = minX - xMemo.get(cur.id);
        xMemo.set(cur.id, minX);
        dragDescendants(cur.id, delta, new Set([cur.id]));
      }
    }
  }

  // A node with no children of its own but 2+ incoming edges (e.g. a
  // require_both target) never went through the "center over children"
  // rule above — it only ever got a bare leaf slot in pass 1, with no
  // relationship to where its several parents ended up, which can look
  // arbitrarily off-center under them. Recenter each one over the average
  // of its now-final parents, then re-sweep every level once more since
  // this can introduce new same-level collisions the earlier per-level
  // sweep never had a chance to see.
  nodes.forEach((n) => {
    if (!isLeaf.get(n.id)) return;
    const parents = (parentsOf.get(n.id) || []).filter((pid) => xMemo.has(pid));
    if (parents.length < 2) return;
    const avg = parents.reduce((s, pid) => s + xMemo.get(pid), 0) / parents.length;
    xMemo.set(n.id, avg);
  });
  nodesByLevel.forEach((levelNodes) => {
    const ordered = [...levelNodes].sort((a, b) => xMemo.get(a.id) - xMemo.get(b.id));
    for (let i = 1; i < ordered.length; i += 1) {
      const prev = ordered[i - 1];
      const cur = ordered[i];
      const minX = xMemo.get(prev.id) + MIN_SLOT_SPACING_X;
      if (xMemo.get(cur.id) < minX) {
        // Reuse the same drag-through-single-parent-chains rule as the main
        // sweep — this pass can push a node that already has finalized
        // children of its own (not just leaves), and those need to follow.
        const delta = minX - xMemo.get(cur.id);
        xMemo.set(cur.id, minX);
        dragDescendants(cur.id, delta, new Set([cur.id]));
      }
    }
  });

  // Single global centering shift — the whole tree's bounding box.
  const allXs = [...xMemo.values()];
  const centerOffset = allXs.length ? (Math.min(...allXs) + Math.max(...allXs)) / 2 : 0;

  const positions = new Map();
  nodes.forEach((n) => {
    const level = levels[n.id] ?? 1;
    positions.set(n.id, { x: (xMemo.get(n.id) ?? 0) - centerOffset, y: -(level - 1) * LEVEL_SPACING_Y });
  });

  return {
    mode: 'tree',
    levels,
    positions,
    clusterKeyOf: (id) => clusterKeyOf(id, nodeMap, parentsOf),
    // Position along the axis siblings are ordered on — what drag-to-reorder
    // compares (the star layout orders by angle instead).
    sortKeyOf: (id) => positions.get(id)?.x ?? 0,
    sortKeyAt: (p) => p.x,
  };
}

// ── Star layout ───────────────────────────────────────────────────────
// Root in the centre, its children fan out as evenly spaced rays and every
// descendant continues in its parent's direction (inside the parent's angular
// sector), one ring further out per level. Like the tree layout, positions are
// derived from the graph only; `pos_x` is just the sibling order, now read as
// clockwise order instead of left-to-right.
export const STAR_RING_STEP = 150; // radial distance between prerequisite levels
export const STAR_MIN_RING_GAP = 110; // rings never get closer than this, whatever the crowding
export const STAR_MIN_CHORD = 72; // *minimum* straight-line gap between neighbours on one ring — rings grow outward to honour it
const STAR_START_ANGLE = -Math.PI / 2; // first ray points straight up
const STAR_MIN_DELTA = 0.06; // rad; floor for the neighbour angle used in the ring radius, so two nodes sharing one ray can't blow it up
const TWO_PI = Math.PI * 2;

const normalizeAngle = (a) => ((a % TWO_PI) + TWO_PI) % TWO_PI;

export function computeStarLayout(nodes, edges) {
  const levels = computeLevels(nodes, edges);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const parentsOf = new Map();
  edges.forEach((e) => {
    if (!nodeMap.has(e.source_id) || !nodeMap.has(e.target_id)) return;
    if (!parentsOf.has(e.target_id)) parentsOf.set(e.target_id, []);
    parentsOf.get(e.target_id).push(e.source_id);
  });

  const rank = (id) => nodeMap.get(id).pos_x ?? 0;
  const byRank = (a, b) => rank(a) - rank(b);

  // Every node hangs under ONE "primary" parent — the deepest one, so it sits
  // just beyond it — which gives a plain tree to carve angular sectors from.
  // Extra parents (require_both nodes) only pull the node's angle afterwards.
  const primaryKids = new Map();
  const hasParent = new Set();
  nodes.forEach((n) => {
    if (n.is_root) return;
    const parents = parentsOf.get(n.id) || [];
    if (parents.length === 0) return;
    const best = parents.reduce((b, p) => ((levels[p] ?? 1) > (levels[b] ?? 1) ? p : b), parents[0]);
    hasParent.add(n.id);
    if (!primaryKids.has(best)) primaryKids.set(best, []);
    primaryKids.get(best).push(n.id);
  });
  primaryKids.forEach((kids) => kids.sort(byRank));

  const roots = nodes.filter((n) => n.is_root).map((n) => n.id).sort(byRank);
  const centerId = roots.length === 1 ? roots[0] : null;
  const orphans = nodes.filter((n) => !n.is_root && !hasParent.has(n.id)).map((n) => n.id).sort(byRank);
  const topLevel = [...(centerId ? primaryKids.get(centerId) || [] : roots), ...orphans];

  // Sector width follows the number of leaves in a subtree, so a bushy branch
  // gets proportionally more room than a single chain.
  const weightMemo = new Map();
  const weightOf = (id, visiting = new Set()) => {
    if (weightMemo.has(id)) return weightMemo.get(id);
    if (visiting.has(id)) return 1; // cycle guard
    visiting.add(id);
    const kids = primaryKids.get(id) || [];
    const w = kids.length === 0 ? 1 : kids.reduce((s, k) => s + weightOf(k, visiting), 0);
    visiting.delete(id);
    weightMemo.set(id, w);
    return w;
  };

  // `sweep` = clockwise angle, in [0, 2π), measured from the start of the
  // first top-level sector. Rays sit in the middle of their sector, so the
  // whole picture is rotated back by half a sector to put the first ray
  // exactly at the top (`offset`).
  const sweep = new Map();
  const topSpan = TWO_PI / Math.max(1, topLevel.length);
  const offset = topSpan / 2;

  const assign = (id, a0, a1) => {
    if (sweep.has(id)) return; // cycle guard
    sweep.set(id, (a0 + a1) / 2);
    const kids = (primaryKids.get(id) || []).filter((k) => !sweep.has(k));
    const total = kids.reduce((s, k) => s + weightOf(k), 0);
    let cursor = a0;
    kids.forEach((k) => {
      const span = ((a1 - a0) * weightOf(k)) / total;
      assign(k, cursor, cursor + span);
      cursor += span;
    });
  };
  topLevel.forEach((id, i) => assign(id, i * topSpan, (i + 1) * topSpan));
  if (centerId) sweep.set(centerId, 0);
  // Anything the walk couldn't reach (a pure prerequisite cycle) still gets a spot.
  nodes.forEach((n) => { if (!sweep.has(n.id)) sweep.set(n.id, 0); });

  // A node needing several prerequisites lands between them (circular mean),
  // carrying its own subtree along. Shallowest first, so its parents are
  // already final.
  const shiftSubtree = (id, delta, visited) => {
    (primaryKids.get(id) || []).forEach((k) => {
      if (visited.has(k)) return;
      visited.add(k);
      sweep.set(k, normalizeAngle(sweep.get(k) + delta));
      shiftSubtree(k, delta, visited);
    });
  };
  const derived = new Set(); // nodes whose angle comes from several parents rather than from a sector
  [...nodes]
    .sort((a, b) => (levels[a.id] ?? 1) - (levels[b.id] ?? 1))
    .forEach((n) => {
      const parents = (parentsOf.get(n.id) || []).filter((p) => p !== centerId);
      if (n.is_root || parents.length < 2) return;
      const sx = parents.reduce((s, p) => s + Math.cos(sweep.get(p)), 0);
      const sy = parents.reduce((s, p) => s + Math.sin(sweep.get(p)), 0);
      if (Math.hypot(sx, sy) < 1e-6) return; // parents point opposite ways — no meaningful middle, keep the sector position
      const target = normalizeAngle(Math.atan2(sy, sx));
      const delta = target - sweep.get(n.id);
      sweep.set(n.id, target);
      derived.add(n.id);
      shiftSubtree(n.id, delta, new Set([n.id]));
    });

  // Ring radii, innermost first. Each ring is at least RING_STEP further out
  // than the previous one, and further still when its closest pair of
  // neighbours would otherwise be nearer than MIN_CHORD.
  const nodesByLevel = new Map();
  nodes.forEach((n) => {
    if (n.id === centerId) return;
    const level = levels[n.id] ?? 1;
    if (!nodesByLevel.has(level)) nodesByLevel.set(level, []);
    nodesByLevel.get(level).push(n.id);
  });
  const radiusOf = new Map();
  let prevRadius = centerId ? 0 : -Infinity;
  [...nodesByLevel.keys()].sort((a, b) => a - b).forEach((level) => {
    // Derived nodes are left out: they land wherever their parents' middle
    // is, possibly right beside another node — they get nudged apart below
    // instead of pushing the whole ring outward.
    const ids = nodesByLevel.get(level).filter((id) => !derived.has(id));
    const angles = ids.map((id) => sweep.get(id)).sort((a, b) => a - b);
    let minDelta = TWO_PI;
    for (let i = 1; i < angles.length; i += 1) minDelta = Math.min(minDelta, angles[i] - angles[i - 1]);
    if (angles.length > 1) minDelta = Math.min(minDelta, TWO_PI - (angles[angles.length - 1] - angles[0]));
    const needed = angles.length > 1 ? STAR_MIN_CHORD / (2 * Math.sin(Math.min(Math.PI, Math.max(minDelta, STAR_MIN_DELTA)) / 2)) : 0;
    const base = (level - (centerId ? 1 : 0)) * STAR_RING_STEP;
    const r = Math.max(base, needed, prevRadius + STAR_MIN_RING_GAP);
    radiusOf.set(level, r);
    prevRadius = r;
  });

  // Slide each derived node along its ring to the nearest spot that keeps
  // MIN_CHORD from everything else on that ring.
  const placed = new Set(nodes.filter((n) => !derived.has(n.id)).map((n) => n.id));
  derived.forEach((id) => {
    const level = levels[id] ?? 1;
    const r = radiusOf.get(level) ?? 0;
    const step = r > 0 ? STAR_MIN_CHORD / r / 2 : 0;
    const neighbours = (nodesByLevel.get(level) || []).filter((o) => o !== id && placed.has(o));
    const isFree = (sw) => neighbours.every((o) => 2 * r * Math.abs(Math.sin((sw - sweep.get(o)) / 2)) >= STAR_MIN_CHORD);
    const home = sweep.get(id);
    for (let i = 0; step > 0 && i <= 60; i += 1) {
      const candidate = [home + i * step, home - i * step].find((sw) => isFree(sw));
      if (candidate != null) { sweep.set(id, normalizeAngle(candidate)); break; }
    }
    placed.add(id);
  });

  const angleAt = (sw) => STAR_START_ANGLE + sw - offset;
  const positions = new Map();
  nodes.forEach((n) => {
    if (n.id === centerId) { positions.set(n.id, { x: 0, y: 0 }); return; }
    const r = radiusOf.get(levels[n.id] ?? 1) ?? 0;
    const theta = angleAt(sweep.get(n.id));
    positions.set(n.id, { x: r * Math.cos(theta), y: r * Math.sin(theta) });
  });

  return {
    mode: 'star',
    levels,
    positions,
    clusterKeyOf: (id) => clusterKeyOf(id, nodeMap, parentsOf),
    sortKeyOf: (id) => sweep.get(id) ?? 0,
    sortKeyAt: (p) => normalizeAngle(Math.atan2(p.y, p.x) - STAR_START_ANGLE + offset),
  };
}

// Per-tab view settings (see skill_tree.archetype_settings) — what a tab
// without a stored row looks like.
export const DEFAULT_TREE_SETTINGS = { layout: 'tree', background_url: null };

// A tab whose nodes carry no `is_root` flag (e.g. the root lost its flag in
// an import) would be laid out around an arbitrary parentless node, leaving
// the star lopsided. When exactly one parentless node actually has children,
// lay the tab out as if that node were the root. Layout-only: the flag itself
// (which drives unlocking) is left untouched.
function withImplicitRoot(nodes, edges) {
  if (nodes.some((n) => n.is_root)) return nodes;
  const ids = new Set(nodes.map((n) => n.id));
  const hasParent = new Set();
  const hasChild = new Set();
  edges.forEach((e) => {
    if (!ids.has(e.source_id) || !ids.has(e.target_id)) return;
    hasParent.add(e.target_id);
    hasChild.add(e.source_id);
  });
  const candidates = nodes.filter((n) => !hasParent.has(n.id) && hasChild.has(n.id));
  if (candidates.length !== 1) return nodes;
  return nodes.map((n) => (n === candidates[0] ? { ...n, is_root: true } : n));
}

export function computeLayoutFor(mode, nodes, edges) {
  const laidOut = withImplicitRoot(nodes, edges);
  return mode === 'star' ? computeStarLayout(laidOut, edges) : computeLayout(laidOut, edges);
}

// Reassigns fresh sequential `pos_x` ranks (0,1,2,…) to every node in
// `clusterNodes` (its members, already sorted in current visual order) after
// moving `draggedId` to sit at `dropIndex` among the others. Returns only the
// node objects whose `pos_x` actually changed, ready to PATCH. Deliberately
// does not just swap two raw pos_x values — freshly-created siblings often
// start tied at the same default, which would make a naive swap a silent no-op.
export function reorderCluster(clusterNodes, draggedId, dropIndex) {
  const dragged = clusterNodes.find((n) => n.id === draggedId);
  if (!dragged) return [];
  const rest = clusterNodes.filter((n) => n.id !== draggedId);
  const clamped = Math.max(0, Math.min(rest.length, dropIndex));
  const reordered = [...rest.slice(0, clamped), dragged, ...rest.slice(clamped)];
  const changed = [];
  reordered.forEach((n, i) => {
    if ((n.pos_x ?? 0) !== i) changed.push({ ...n, pos_x: i });
  });
  return changed;
}

// Straight SVG path between two node circles, trimmed so it starts on the
// source circle's edge and ends `endGap` short of the target's (room for the
// arrowhead). Straight lines don't need the shared-bus routing the old
// orthogonal edges did (lanes, entry offsets), which is what lets the layout
// spacing above stay compact.
export function straightEdgePath(s, d, startGap, endGap) {
  const dx = d.x - s.x;
  const dy = d.y - s.y;
  const len = Math.hypot(dx, dy);
  if (len <= startGap + endGap) return null; // overlapping nodes — nothing sensible to draw
  const ux = dx / len;
  const uy = dy / len;
  return `M${s.x + ux * startGap},${s.y + uy * startGap} L${d.x - ux * endGap},${d.y - uy * endGap}`;
}

// Bounding-box "fit to view" transform for the pan/zoom `{x, y, k}` state.
export function computeFitTransform(positions, viewportWidth, viewportHeight, { padding = 70, minK = 0.2, maxK = 2.5 } = {}) {
  const pts = [...positions.values()];
  if (!pts.length || !viewportWidth || !viewportHeight) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const k = Math.min(maxK, Math.max(minK, Math.min(viewportWidth / w, viewportHeight / h)));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { k, x: viewportWidth / 2 - cx * k, y: viewportHeight / 2 - cy * k };
}

// Every upstream prerequisite of `nodeId` (walking source_id backward),
// including itself — for the hover/select "highlight prerequisite path" feature.
export function ancestorClosure(nodeId, edges) {
  const parentsOf = new Map();
  edges.forEach((e) => {
    if (!parentsOf.has(e.target_id)) parentsOf.set(e.target_id, []);
    parentsOf.get(e.target_id).push(e.source_id);
  });
  const closure = new Set([nodeId]);
  const stack = [nodeId];
  while (stack.length) {
    const id = stack.pop();
    (parentsOf.get(id) || []).forEach((pid) => {
      if (!closure.has(pid)) { closure.add(pid); stack.push(pid); }
    });
  }
  return closure;
}
