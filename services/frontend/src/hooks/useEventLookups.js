import { useEffect, useMemo, useState } from 'react';
import mapsApi from '../api/maps';
import npcsApi from '../api/npcs';
import bestiaryApi from '../api/bestiary';
import characterApi from '../api/characterSheet';

// Довідники для подій хронології: локації та потенційні учасники (НІПи, істоти,
// персонажі гравців). Спільні для сторінки подій, сторінки події та її форми.
// Учасник — { key, label, href }: label несе вид у дужках, href веде на його
// сторінку. Збій одного джерела не валить решту — просто порожній список.
export default function useEventLookups() {
  const [locations, setLocations] = useState([]);
  const [characterOptions, setCharacterOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      mapsApi.listLocations().catch(() => []),
      npcsApi.list().catch(() => []),
      bestiaryApi.list().catch(() => []),
      // Персонажі гравців теж можуть бути учасниками — власні та прикріплені
      // до кампаній, де користувач майстер (адмін бачить усіх).
      characterApi.list({ includeGmCampaigns: true }).catch(() => []),
    ]).then(([locs, npcs, creatures, characters]) => {
      if (!alive) return;
      setLocations(locs);
      setCharacterOptions([
        ...npcs.map((n) => ({ key: n.id, label: `${n.name} (НІП)`, href: `/npcs/${n.id}` })),
        ...creatures.map((c) => ({ key: c.id, label: `${c.name} (Істота)`, href: `/bestiary/${c.id}` })),
        ...characters.map((c) => ({ key: c.id, label: `${c.name} (Персонаж)`, href: `/characters/${c.id}` })),
      ]);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const locationsById = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);
  const charactersById = useMemo(() => new Map(characterOptions.map((c) => [c.key, c])), [characterOptions]);

  return { locations, characterOptions, locationsById, charactersById, loading };
}
