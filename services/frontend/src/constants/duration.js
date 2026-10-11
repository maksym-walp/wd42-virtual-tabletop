import { pluralizeUk } from '../utils/pluralize';

// Одиниці тривалості вмінь і заклинань — один набір на обидва каталоги
// (відповідає CHECK duration_unit у міграції 92 і білим спискам
// DURATION_UNITS в abilities/spellbook). Підписи — для випадного списку
// поруч із числом; у тексті відмінюються через formatDuration.
export const DURATION_UNITS = {
  instant:   'Мить',
  action:    'дії',
  round:     'раунди',
  seconds:   'сек.',
  minutes:   'хв.',
  hours:     'год.',
  days:      'дн.',
  permanent: 'Постійно',
};

const COUNTED_UNITS = {
  action: ['дія', 'дії', 'дій'],
  round: ['раунд', 'раунди', 'раундів'],
};

export function formatDuration(value, unit) {
  if (!unit || unit === 'instant' || unit === 'permanent') return DURATION_UNITS[unit] || '—';
  if (COUNTED_UNITS[unit]) return `${value ?? '?'} ${pluralizeUk(value ?? 0, COUNTED_UNITS[unit])}`;
  return `${value ?? '?'} ${DURATION_UNITS[unit]}`;
}
