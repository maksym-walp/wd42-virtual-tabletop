import { useState, useEffect } from 'react';
import npcsApi from '../../api/npcs';
import characterApi from '../../api/characterSheet';

// NPCs (npcs service) and player characters (character-sheet: own + community,
// de-duplicated) merged into one pickable list of { id, name, type } — the
// source for faction members and NPC relationship targets. Loaded lazily, the
// first time `enabled` turns true (i.e. when a picker actually opens).
export default function usePersonCatalog(enabled) {
  const [people, setPeople] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled || loaded) return;
    Promise.all([
      npcsApi.list().catch(() => []),
      characterApi.list().catch(() => []),
      characterApi.listCommunity().catch(() => []),
    ]).then(([npcs, own, community]) => {
      const characters = new Map();
      [...own, ...community].forEach((c) => characters.set(c.id, c));
      setPeople([
        ...npcs.map((n) => ({ id: n.id, name: n.name, type: 'npc' })),
        ...[...characters.values()].map((c) => ({ id: c.id, name: c.name, type: 'character' })),
      ]);
      setLoaded(true);
    });
  }, [enabled, loaded]);

  return people;
}
