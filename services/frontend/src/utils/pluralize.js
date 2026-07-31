// Ukrainian count-noun declension: picks one of [one, few, many] by the
// standard Slavic rule — "1 запис", "2 записи", "5 записів", but also
// "11 записів" (not "11 запис") and "21 запис" (not "21 записів"), since the
// exception for the teens (11-14) takes priority over the last-digit rule.
export function pluralizeUk(n, [one, few, many]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
