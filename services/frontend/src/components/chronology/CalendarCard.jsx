import { Link } from 'react-router-dom';
import { CalendarDays, Globe, Lock } from 'lucide-react';
import MoonPhase from '../MoonPhase';
import {
  daysPerYear, totalDaysSinceEpoch, weekdayIndexOf, yearLabel, getActiveSeason,
} from '../../utils/chronologyMath';
import { pluralizeUk } from '../../utils/pluralize';
import { htmlToPreviewText } from '../../utils/richText';

// Згенерована мініатюра календаря: один місяць сіткою з урахуванням днів
// тижня, сезонів (колір/фон) і фаз супутників. Структура приходить разом із
// календарем (preview_months/weekdays/seasons/moons — див.
// chronology.model.js), тож картка не робить власних запитів.
//
// Дата: явна (year/monthId/day — напр. поточна дата кампанії, day
// підсвічується) або дефолтний вигляд календаря (default_year/month), або
// перший місяць 1-го року.
export function CalendarMiniPreview({ calendar, year, monthId, day }) {
  const months = calendar.preview_months || [];
  const weekdays = calendar.preview_weekdays || [];
  const seasons = calendar.preview_seasons || [];
  const moons = calendar.preview_moons || [];

  if (months.length === 0) {
    return (
      <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 bg-bg text-text-dim">
        <CalendarDays size={28} strokeWidth={1.5} />
        <span className="text-xs">Структуру ще не налаштовано</span>
      </div>
    );
  }

  const wantedMonthId = monthId || calendar.default_month_id;
  const monthIndex = Math.max(0, months.findIndex((m) => m.id === wantedMonthId));
  const month = months[monthIndex];
  const viewYear = year ?? calendar.default_year ?? 1;
  const monthLength = Number(month.length);
  const columns = weekdays.length || 7;
  const firstWeekday = weekdayIndexOf(
    totalDaysSinceEpoch(months, viewYear, monthIndex, 1), calendar.first_day_offset, weekdays.length,
  );
  const focusDay = day && day <= monthLength ? Number(day) : 1;
  const season = getActiveSeason(seasons, months, monthIndex, focusDay);
  const focusTotal = totalDaysSinceEpoch(months, viewYear, monthIndex, focusDay);

  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: monthLength }, (_, i) => i + 1),
  ];

  return (
    <div className="relative overflow-hidden bg-bg px-3 pb-3 pt-2.5">
      {season?.bg_image_url && (
        <img src={season.bg_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15" loading="lazy" />
      )}
      {season && (
        <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: season.color }} />
      )}
      <div className="relative">
        {/* Правий верхній кут лишається вільним під actions картки. */}
        <div className="mb-2 min-w-0 pr-9">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-display text-sm text-text">{month.name}</p>
            {moons.slice(0, 3).map((m) => (
              <span key={m.id} className="flex shrink-0">
                <MoonPhase
                  name={m.name} color={m.color} size={13}
                  cycleLength={Number(m.cycle_length)} shift={m.shift} totalDaysPassed={focusTotal}
                />
              </span>
            ))}
          </div>
          <p className="truncate text-[0.65rem] text-text-dim">
            {yearLabel(viewYear, calendar.current_era_name, calendar.previous_era_name)}
            {season && <> · <span style={{ color: season.color }}>{season.name}</span></>}
          </p>
        </div>

        <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {weekdays.map((w, i) => (
            <span key={i} className="truncate text-center text-[0.55rem] font-semibold uppercase text-text-dim">
              {w.short_name || w.name.slice(0, 2)}
            </span>
          ))}
          {cells.map((d, i) => {
            if (d == null) return <span key={`b${i}`} />;
            const daySeason = getActiveSeason(seasons, months, monthIndex, d);
            const isToday = day != null && d === Number(day);
            return (
              <span
                key={d}
                className={`rounded-sm py-px text-center text-[0.6rem] leading-4 tabular-nums ${
                  isToday ? 'bg-accent font-bold text-bg' : 'text-text-muted'
                }`}
                style={!isToday && daySeason ? { backgroundColor: `${daySeason.color}22` } : undefined}
              >
                {d}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Картка календаря для каталогу /chronology і блоку календаря кампанії.
// actions — кнопки поверх картки (налаштування, відвʼязати); вони лежать
// поза <Link>, щоб не вкладати інтерактивні елементи в посилання.
export default function CalendarCard({ calendar: c, to, actions, date, label }) {
  const months = c.preview_months || [];
  const moonsCount = (c.preview_moons || []).length;
  const description = htmlToPreviewText(c.description, 160);
  const stats = [
    months.length > 0 && `${months.length} ${pluralizeUk(months.length, ['місяць', 'місяці', 'місяців'])}`,
    months.length > 0 && `${daysPerYear(months)} дн. на рік`,
    moonsCount > 0 && `${moonsCount} ${pluralizeUk(moonsCount, ['супутник', 'супутники', 'супутників'])}`,
  ].filter(Boolean);

  return (
    <div className="relative h-full">
      <Link
        to={to}
        className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-accent/50"
      >
        <CalendarMiniPreview calendar={c} year={date?.year} monthId={date?.monthId} day={date?.day} />
        <div className="flex flex-1 flex-col gap-1 border-t border-border px-3.5 py-2.5">
          {label && <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-gold">{label}</p>}
          <h3 className="flex items-center gap-1.5 font-display text-lg leading-tight text-accent">
            <span className="min-w-0 truncate">{c.name}</span>
            <span className="shrink-0 text-text-dim" title={c.is_private ? 'Приватний' : 'Публічний'}>
              {c.is_private ? <Lock size={13} /> : <Globe size={13} />}
            </span>
          </h3>
          {stats.length > 0 && <p className="text-xs text-text-dim">{stats.join(' · ')}</p>}
          {description && <p className="line-clamp-2 text-sm italic leading-snug text-text-dim">{description}</p>}
        </div>
      </Link>
      {actions && <div className="absolute right-2 top-2 flex items-center gap-1">{actions}</div>}
    </div>
  );
}
