import { Link } from 'react-router-dom';
import {
  natureLabels, SPELL_COMPLEXITIES, RITUAL_TYPES, formatDuration as formatSpellDuration, spellForms,
} from '../../constants/spellbook';
import useSpellKinds from '../../hooks/useSpellKinds';
import { EQUIPMENT_TYPES, ARMOR_WEIGHTS, weaponModifierLabel } from '../../constants/equipment';
import { RARITIES } from '../../constants/artifacts';
import { ARCHETYPES } from '../../constants/characterSheet';
import { formatDuration as formatAbilityDuration, abilityForms } from '../../constants/abilities';
import { STAT_BLOCK_KINDS } from '../../constants/statBlocks';
import { htmlToPreviewText } from '../../utils/richText';
import CroppedImage from '../ui/CroppedImage';

// Стислі прев'ю записів для бічної панелі каталогу (CatalogLayout). Кожне
// доменне прев'ю лише збирає дані для спільного PreviewCard.

// Рамка прев'ю з плейсхолдером, поки курсор ще ні на що не наводився.
export function CatalogPreview({ item, children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="border-b border-border bg-bg px-4 py-2">
        <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Перегляд</span>
      </div>
      {item ? children : (
        <p className="px-4 py-6 text-center text-sm text-text-dim">Наведи на запис, щоб побачити подробиці</p>
      )}
    </div>
  );
}

function PreviewCard({ href, image, imageCrop, badges = [], title, subtitle, stats = [], chips = [], description }) {
  const text = htmlToPreviewText(description, 600);
  const shownStats = stats.filter((s) => s.value != null && s.value !== '');
  return (
    <div>
      {image && (
        <div className="aspect-[16/9] w-full overflow-hidden bg-bg">
          <CroppedImage src={image} crop={imageCrop} alt={title} />
        </div>
      )}
      <div className="px-4 pb-3 pt-3">
        {badges.filter(Boolean).length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {badges.filter(Boolean).map((b) => (
              <span key={b} className="rounded border border-border px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-text-dim">
                {b}
              </span>
            ))}
          </div>
        )}
        {href ? (
          <Link to={href} className="font-display text-xl text-accent hover:underline">{title}</Link>
        ) : (
          <span className="font-display text-xl text-accent">{title}</span>
        )}
        {subtitle && <p className="mt-0.5 text-xs italic text-text-dim">{subtitle}</p>}
      </div>
      {shownStats.length > 0 && (
        <div className="grid grid-cols-2 gap-px border-y border-border bg-border">
          {shownStats.map((s, i) => (
            // Odd count: the last cell spans both columns instead of leaving an empty bg-border gap.
            <div key={s.label} className={`flex flex-col gap-0.5 bg-surface px-3 py-1.5 ${i === shownStats.length - 1 && shownStats.length % 2 ? 'col-span-2' : ''}`}>
              <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-text-dim">{s.label}</span>
              <span className="text-sm font-semibold text-text">{s.value}</span>
            </div>
          ))}
        </div>
      )}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {chips.map((c) => (
            <span key={c} className="rounded border border-accent/40 px-2 py-0.5 text-xs text-accent">{c}</span>
          ))}
        </div>
      )}
      {text && <p className="px-4 py-3 text-sm leading-relaxed text-text-muted">{text}</p>}
    </div>
  );
}

export function SpellPreview({ spell }) {
  const { spellKindsMap } = useSpellKinds();
  const forms = spellForms(spell);
  const ritual = RITUAL_TYPES[spell.ritual];
  return (
    <PreviewCard
      href={`/spellbook/${spell.id}`}
      image={spell.image_url}
      imageCrop={spell.image_crop}
      badges={[natureLabels(spell.nature), spellKindsMap[spell.spell_kind]?.label, spell.form_label]}
      title={spell.name}
      subtitle={spell.owner_username ? `@${spell.owner_username}` : null}
      stats={[
        { label: 'Складність', value: SPELL_COMPLEXITIES[spell.complexity]?.label },
        { label: 'Енергія', value: spell.energy_cost },
        { label: 'Дії', value: `${spell.action_time}/3` },
        { label: 'Ритуал', value: ritual && `${ritual.symbol} ${ritual.label}` },
        { label: 'Тривалість', value: formatSpellDuration(spell.duration_value, spell.duration_unit) },
        { label: 'Дальність', value: spell.range_desc },
      ]}
      chips={forms.length > 1 && !spell.form_label ? forms.map((f) => f.label) : []}
      description={spell.mechanical_desc || spell.narrative_desc}
    />
  );
}

// artifact — прев'ю в каталозі артефактів (своя сторінка перегляду).
export function EquipmentPreview({ item, artifact = false }) {
  const isArtifact = artifact || item.type === 'artifact';
  return (
    <PreviewCard
      href={isArtifact ? `/equipment/artifacts/${item.id}` : `/equipment/${item.id}`}
      image={item.thumbnail_url || item.image_url}
      imageCrop={item.image_crop}
      badges={[isArtifact ? 'Артефакт' : EQUIPMENT_TYPES[item.type]?.label, RARITIES[item.rarity]?.label]}
      title={item.name}
      subtitle={[item.creator && `Творець: ${item.creator}`, item.owner_username && `@${item.owner_username}`].filter(Boolean).join(' · ')}
      stats={[
        { label: 'Шкода', value: item.damage_die },
        { label: 'Модифікатор', value: item.modifier && weaponModifierLabel(item.modifier) },
        { label: 'Захист', value: item.defense_value },
        { label: 'Вага', value: ARMOR_WEIGHTS[item.armor_weight]?.label },
        { label: 'Ціна', value: item.price },
      ]}
      description={item.description}
    />
  );
}

// form_label — прев'ю конкретної форми (abilityWithForm), без переліку форм.
export function AbilityPreview({ ability }) {
  const forms = abilityForms(ability);
  return (
    <PreviewCard
      href={`/abilities/${ability.id}`}
      image={ability.image_url}
      imageCrop={ability.image_crop}
      badges={[...(ability.archetypes ?? []).map((a) => ARCHETYPES[a]?.label ?? a), ability.is_maneuver && 'Маневр', ability.form_label]}
      title={ability.name}
      subtitle={ability.owner_username ? `@${ability.owner_username}` : null}
      stats={ability.is_maneuver
        ? [{ label: 'Тривалість', value: formatAbilityDuration(ability.duration_value, ability.duration_unit) }]
        : []}
      chips={forms.length > 1 && !ability.form_label ? forms.map((f) => f.label) : []}
      description={ability.mechanical_desc || ability.narrative_desc}
    />
  );
}

export function StatBlockPreview({ kind: kindKey, entry, speciesName }) {
  const kind = STAT_BLOCK_KINDS[kindKey];
  return (
    <PreviewCard
      href={`${kind.basePath}/${entry.id}`}
      image={entry.image_url}
      imageCrop={entry.image_crop}
      badges={[kind.label]}
      title={entry.name}
      subtitle={speciesName}
      description={entry.description}
    />
  );
}

// Для списків без власних карток-компонентів (таксономія, фракції,
// колекції, традиції, локації, мапи).
export function SimplePreview({ href, image, imageCrop, badges, title, subtitle, description }) {
  return (
    <PreviewCard href={href} image={image} imageCrop={imageCrop} badges={badges} title={title} subtitle={subtitle} description={description} />
  );
}
