import { pluralizeUk } from '../utils/pluralize';

export const DURATION_UNITS = {
  instant:   'Мить',
  action:    'дія',
  seconds:   'сек.',
  minutes:   'хв.',
  hours:     'год.',
  days:      'дн.',
  permanent: 'Постійно',
};

export function formatDuration(value, unit) {
  if (!unit || unit === 'instant' || unit === 'permanent') return DURATION_UNITS[unit] || '—';
  if (unit === 'action') return `${value ?? '?'} ${pluralizeUk(value ?? 0, ['дія', 'дії', 'дій'])}`;
  return `${value ?? '?'} ${DURATION_UNITS[unit]}`;
}
