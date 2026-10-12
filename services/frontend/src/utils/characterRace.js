import { RACES } from '../constants/characterSheet';

// Назва раси персонажа: раса компендіуму (race_name віддає бекенд), а для
// персонажів, яких не вдалося зіставити з расою компендіуму, — назва за
// старим ключем (race).
export function raceLabel(character) {
  return character?.race_name ?? RACES[character?.race]?.label ?? character?.race ?? '';
}
