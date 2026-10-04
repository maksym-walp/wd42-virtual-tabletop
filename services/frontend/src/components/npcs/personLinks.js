// Where a faction member / relationship target links to. NPCs have their
// own page; a player character opens its sheet for its owner and the
// public read-only view for everyone else (a private character someone
// else owns has no page the viewer could open, so no link).
export function personHref(type, person, userId) {
  if (!person) return null;
  if (type === 'npc') return `/npcs/${person.id}`;
  const isOwner = person.is_owner ?? (person.user_id != null && person.user_id === userId);
  if (isOwner) return `/characters/${person.id}`;
  return person.is_public ? `/characters/public/${person.id}` : null;
}

export const PERSON_TYPE_LABELS = { npc: 'НІП', character: 'Персонаж' };
