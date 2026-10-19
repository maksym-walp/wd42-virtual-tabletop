import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import api from '../api/client';
import Button from '../components/ui/Button';
import ArtifactPrintCard from '../components/ArtifactPrintCard';
import { CARD_W_MM, CARD_H_MM } from '../constants/artifacts';
import { pluralizeUk } from '../utils/pluralize';

const MAX_CARDS = 40;

// A4 з 4 картками 80×120 мм (2×2). Проміжок між картками 10 мм: мітки різу
// (відступ 2 мм від краю, довжина 2,5 мм) сусідніх карток не зливаються —
// між ними лишається симетричний просвіт 1 мм.
const A4_W_MM = 210;
const A4_H_MM = 297;
const GAP_MM = 10;
const CARDS_PER_SHEET = 4;
const BLOCK_W_MM = CARD_W_MM * 2 + GAP_MM;
const BLOCK_H_MM = CARD_H_MM * 2 + GAP_MM;
const BLOCK_LEFT_MM = (A4_W_MM - BLOCK_W_MM) / 2;
const BLOCK_TOP_MM = (A4_H_MM - BLOCK_H_MM) / 2;
const MARK_OFFSET_MM = 2;
const MARK_LEN_MM = 2.5;
const MARK_THICKNESS_MM = 0.25;

// 1 мм = 96/25.4 css-px
const MM_TO_PX = 96 / 25.4;

// Висоту аркуша трохи зменшуємо: рівно в сторінку браузери іноді додають
// порожню сторінку в кінці через похибку округлення.
const PAGE_TRIM_MM = 0.2;

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// Кутові мітки різу навколо картки з лівим-верхнім кутом (x, y) на аркуші:
// у кожному куті горизонтальна й вертикальна рисочки назовні від картки.
function CropMarks({ x, y }) {
  const marks = [];
  [[x, -1], [x + CARD_W_MM, 1]].forEach(([cx, dx]) => {
    [[y, -1], [y + CARD_H_MM, 1]].forEach(([cy, dy]) => {
      const hStart = dx < 0 ? cx - MARK_OFFSET_MM - MARK_LEN_MM : cx + MARK_OFFSET_MM;
      const vStart = dy < 0 ? cy - MARK_OFFSET_MM - MARK_LEN_MM : cy + MARK_OFFSET_MM;
      marks.push(
        { left: hStart, top: cy - MARK_THICKNESS_MM / 2, width: MARK_LEN_MM, height: MARK_THICKNESS_MM },
        { left: cx - MARK_THICKNESS_MM / 2, top: vStart, width: MARK_THICKNESS_MM, height: MARK_LEN_MM },
      );
    });
  });

  return marks.map((m, i) => (
    <div
      key={i}
      className="absolute bg-black"
      style={{ left: `${m.left}mm`, top: `${m.top}mm`, width: `${m.width}mm`, height: `${m.height}mm` }}
    />
  ));
}

function SheetOfFour({ artifacts }) {
  return (
    <div className="relative bg-white" style={{ width: `${A4_W_MM}mm`, height: `${A4_H_MM - PAGE_TRIM_MM}mm`, overflow: 'hidden' }}>
      {artifacts.map((artifact, i) => {
        const x = BLOCK_LEFT_MM + (i % 2) * (CARD_W_MM + GAP_MM);
        const y = BLOCK_TOP_MM + Math.floor(i / 2) * (CARD_H_MM + GAP_MM);
        return (
          <div key={artifact.id}>
            <CropMarks x={x} y={y} />
            <div className="absolute" style={{ left: `${x}mm`, top: `${y}mm` }}>
              <ArtifactPrintCard artifact={artifact} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ArtifactPrint() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [artifacts, setArtifacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(0);
  const [viewportW, setViewportW] = useState(() => window.innerWidth);

  const idsParam = params.get('ids') || '';
  const ids = useMemo(
    () => [...new Set(idsParam.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, MAX_CARDS),
    [idsParam],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled(ids.map((id) => api.get(`/api/equipment/artifacts/${id}`)))
      .then((results) => {
        if (cancelled) return;
        const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value.data.item);
        setArtifacts(ok);
        setMissing(results.length - ok.length);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ids]);

  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Лише для екрана: звужуємо попередній перегляд до ширини вікна. У друці
  // zoom скидається правилом нижче.
  const zoom = Math.min(1, (viewportW - 32) / (A4_W_MM * MM_TO_PX));
  const sheets = chunk(artifacts, CARDS_PER_SHEET);

  return (
    <div className="min-h-dvh bg-[#d9d4c5] pb-12 print:bg-white print:pb-0">
      <style>{`
        @page { size: A4; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          html, body { background: #fff !important; margin: 0 !important; min-height: 0 !important; }
          .print-hide { display: none !important; }
          .print-zoom { zoom: 1 !important; }
          .print-page { margin: 0 !important; box-shadow: none !important; break-after: page; }
          .print-page:last-child { break-after: auto; }
        }
      `}</style>

      <div className="print-hide sticky top-0 z-10 border-b border-border bg-bg px-4 py-3">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
          <button
            type="button" onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-accent"
          >
            <ArrowLeft size={15} /> Назад
          </button>

          <span className="text-sm font-semibold text-text">
            Аркуш A4: {artifacts.length} {pluralizeUk(artifacts.length, ['картка', 'картки', 'карток'])} 80×120 мм, аркушів: {sheets.length}
          </span>

          <Button size="sm" className="ml-auto" onClick={() => window.print()} disabled={loading || artifacts.length === 0}>
            <Printer size={14} /> Друк / Зберегти як PDF
          </Button>

          <p className="w-full text-xs text-text-dim">
            У вікні друку обери «Зберегти як PDF», поля — «Немає», масштаб — 100%. Після друку виріж картки по мітках у кутах.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="print-hide py-12 text-center text-text-dim">Завантаження...</p>
      ) : artifacts.length === 0 ? (
        <p className="print-hide py-12 text-center text-text-dim">Немає артефактів для друку.</p>
      ) : (
        <>
          {missing > 0 && (
            <p className="print-hide pt-4 text-center text-sm text-danger">Не вдалося завантажити артефактів: {missing}</p>
          )}
          <div className="print-zoom flex flex-col items-center gap-6 pt-6 print:gap-0 print:pt-0" style={{ zoom }}>
            {sheets.map((group) => (
              <div key={group.map((a) => a.id).join('-')} className="print-page bg-white shadow-lg">
                <SheetOfFour artifacts={group} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
