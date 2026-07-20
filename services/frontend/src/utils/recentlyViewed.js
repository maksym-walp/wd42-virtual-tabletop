const KEY = 'walp:recentlyViewed';
const MAX = 15;

// entry: { type, id, name, href, image_url }
export function recordView(entry) {
  const list = getRecentlyViewed().filter((e) => !(e.type === entry.type && e.id === entry.id));
  list.unshift({ ...entry, viewedAt: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

export function getRecentlyViewed() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}
