import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag, User } from 'lucide-react';
import npcsApi from '../../api/npcs';
import SmartTextarea from '../ui/SmartTextarea';
import SmartTextReader from '../SmartTextReader';
import CroppedImage from '../ui/CroppedImage';
import NpcEventsSection from '../npcs/NpcEventsSection';

function Block({ title, children, className = '' }) {
  return (
    <section className={`overflow-hidden rounded-lg border border-border bg-surface ${className}`}>
      <div className="border-b border-border bg-bg px-4 py-2">
        <h3 className="m-0 text-[0.78rem] font-bold uppercase tracking-wide text-gold">{title}</h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

// NpcEventsSection очікує власну обгортку секції.
const EventsBlock = ({ title, children }) => <Block title={title}>{children}</Block>;

// «Наратив»: передісторія і те, як персонаж вплетений у світ — звʼязки
// НІПів із ним, фракції (з роллю) і події хронології, де він учасник.
// Нотатки гравця — у правій колонці листа, тут не дублюються.
export default function NarrativeTab({ c, is_owner, patchCharacter }) {
  const [relationships, setRelationships] = useState(null);
  const [factions, setFactions] = useState(null);

  useEffect(() => {
    let alive = true;
    npcsApi.listCharacterRelationships(c.id)
      .then((rows) => { if (alive) setRelationships(rows); })
      .catch(() => { if (alive) setRelationships([]); });
    npcsApi.listCharacterFactions(c.id)
      .then((rows) => { if (alive) setFactions(rows); })
      .catch(() => { if (alive) setFactions([]); });
    return () => { alive = false; };
  }, [c.id]);

  return (
    <div className="flex flex-col gap-4">
      <Block title="Передісторія">
        {is_owner ? (
          <SmartTextarea
            rows={8}
            value={c.backstory ?? ''}
            onChange={(e) => patchCharacter({ backstory: e.target.value })}
            placeholder="Розкажіть про минуле персонажа..."
          />
        ) : c.backstory ? (
          <SmartTextReader text={c.backstory} className="text-sm text-text" />
        ) : (
          <p className="text-sm text-text-dim">Передісторії ще немає.</p>
        )}
      </Block>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Block title="Звʼязки з НІПами">
          {relationships === null ? (
            <p className="text-sm text-text-dim">Завантаження...</p>
          ) : relationships.length === 0 ? (
            <p className="text-sm text-text-dim">Жоден НІП ще не повʼязаний із персонажем.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {relationships.map((r) => (
                <li key={r.id} className="flex items-start gap-3 rounded-md border border-border bg-bg px-3 py-2">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-surface">
                    {r.npc.image_url ? (
                      <CroppedImage src={r.npc.image_url} crop={r.npc.image_crop} alt={r.npc.name} />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-text-dim"><User size={16} /></span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <Link to={`/npcs/${r.npc.id}`} className="font-semibold text-accent hover:underline">{r.npc.name}</Link>
                      <span className="text-text-dim"> — {r.label}</span>
                    </p>
                    {r.note && <p className="mt-0.5 text-xs text-text-dim">{r.note}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title="Фракції">
          {factions === null ? (
            <p className="text-sm text-text-dim">Завантаження...</p>
          ) : factions.length === 0 ? (
            <p className="text-sm text-text-dim">Персонаж не входить до жодної фракції.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {factions.map((f) => (
                <li key={f.id} className="flex items-center gap-3 rounded-md border border-border bg-bg px-3 py-2">
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-border bg-surface">
                    {f.symbol_url ? (
                      <img src={f.symbol_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-text-dim"><Flag size={14} /></span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/npcs/factions/${f.id}`} className="text-sm font-semibold text-accent hover:underline">{f.name}</Link>
                    {f.role && <p className="text-xs text-text-dim">{f.role}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Block>
      </div>

      <NpcEventsSection
        npcId={c.id}
        Section={EventsBlock}
        who="персонажа"
        emptyText="Персонаж ще не брав участі в жодній події хронології."
      />
    </div>
  );
}
