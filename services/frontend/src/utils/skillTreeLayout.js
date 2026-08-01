// Shared layout engine for the skill tree — used by both the GM editor
// (pages/SkillTree.jsx) and the read-only viewer (CharacterSheet.jsx's
// TreeTab). Positions are always *derived* from the graph (level + parent
// references), never stored as pixel coordinates: `pos_x` on a node is
// repurposed as a manual tie-break rank within its sibling cluster (see
// `computeLayout`), and `pos_y` is unused.

export const LEVEL_SPACING_Y = 180; // vertical gap between prerequisite levels
export const MIN_SLOT_SPACING_X = 190; // *minimum* horizontal gap between any two nodes on the same level — never a cap, nodes spread further apart than this whenever their subtrees need the room

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
    levels,
    positions,
    clusterKeyOf: (id) => clusterKeyOf(id, nodeMap, parentsOf),
  };
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

// Orthogonal ("elbow") SVG path between two points: straight if already
// vertically aligned, otherwise a vertical-horizontal-vertical dogleg via
// `midY` (defaults to the true midpoint). Because y is always level-derived,
// every ordinary edge between the same pair of adjacent levels bends at the
// identical height by default — a clean shared-bus look when there's exactly
// one source feeding the row. Callers pass an explicit `midY` — see
// `computeEdgeLanes` below for the case where that default isn't safe, and
// for edges that skip levels, where the bend needs to avoid an unrelated
// intermediate level's node row instead.
export function elbowPath(x1, y1, x2, y2, midY) {
  if (Math.abs(x1 - x2) < 0.5) return `M${x1},${y1} L${x2},${y2}`;
  const m = midY ?? (y1 + y2) / 2;
  return `M${x1},${y1} L${x1},${m} L${x2},${m} L${x2},${y2}`;
}

// The default shared bus height (true midpoint between two adjacent levels)
// only reads cleanly when a single source feeds that row. As soon as two
// *different* sources both have edges landing between the same pair of
// levels, their bus segments land at the identical height and visually
// merge into one indistinguishable line — you can no longer tell which
// parent a given child hangs from, especially where a require_both
// convergence and an unrelated sibling edge overlap in x. This assigns each
// distinct source (among edges connecting that exact pair of levels) its
// own lane — a fraction in (0,1) of the gap to the next level, 0.5 (the
// plain true midpoint) when it's the only source feeding that row. Returns
// a Map of source node id -> fraction; callers compute their own actual
// `midY = y1 - frac * (y1 - y2)` from their own (node-radius-adjusted) y1/y2,
// since node radius/arrow-gap constants live page-side, not here. Skip-level
// edges aren't included — they use their own jog-near-source rule instead.
export function computeEdgeLanes(edges, levels, positions) {
  const sourcesByLevel = new Map(); // source level -> Set of source ids
  edges.forEach((e) => {
    const sLevel = levels[e.source_id] ?? 1;
    const dLevel = levels[e.target_id] ?? 1;
    if (dLevel - sLevel !== 1) return;
    if (!sourcesByLevel.has(sLevel)) sourcesByLevel.set(sLevel, new Set());
    sourcesByLevel.get(sLevel).add(e.source_id);
  });

  const laneFractionOf = new Map();
  sourcesByLevel.forEach((sourceIds) => {
    const sorted = [...sourceIds].sort((a, b) => (positions.get(a)?.x ?? 0) - (positions.get(b)?.x ?? 0));
    const n = sorted.length;
    sorted.forEach((id, i) => laneFractionOf.set(id, (i + 1) / (n + 1)));
  });
  return laneFractionOf;
}

// Lanes alone don't fully solve a subtler ambiguity: a bent edge's final
// approach into a shared target can land on the *exact same x* as an
// unrelated straight-line edge that happens to pass through that column
// (e.g. sibling A has only target C, sibling B has both C and D — B's bent
// path into C can end up pixel-identical to A's straight vertical for that
// stretch, and the horizontal bend can land right on A's column too,
// together reading as one connected rectangle that implies A also reaches
// D, which isn't true). Spreads a target's incoming edges' arrival x
// slightly apart instead of funneling them all through dead-center; a
// target with only one incoming edge is untouched (arrives dead-center, the
// clean common case). Returns a Map of edge id -> x offset to add to the
// target's x.
export function computeEntryOffsets(edges, positions, spacing = 10) {
  const byTarget = new Map();
  edges.forEach((e) => {
    if (!byTarget.has(e.target_id)) byTarget.set(e.target_id, []);
    byTarget.get(e.target_id).push(e);
  });

  const offsetOf = new Map();
  byTarget.forEach((list) => {
    if (list.length < 2) return;
    const sorted = [...list].sort((a, b) => (positions.get(a.source_id)?.x ?? 0) - (positions.get(b.source_id)?.x ?? 0));
    const n = sorted.length;
    sorted.forEach((e, i) => offsetOf.set(e.id, (i - (n - 1) / 2) * spacing));
  });
  return offsetOf;
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
