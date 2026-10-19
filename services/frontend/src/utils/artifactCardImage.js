import { cropRegion } from '../components/ui/CroppedImage';
import { RARITIES, ARTIFACT_TYPE, CARD_W_MM, CARD_H_MM } from '../constants/artifacts';

// Експорт картки артефакта в JPEG: малюємо її на <canvas> у тих самих мм, що й
// друкована версія (ArtifactPrintCard), 300 dpi → 945×1417 px. Не робимо знімок
// DOM-у (html2canvas, SVG foreignObject): без бібліотек це ламається на шрифтах,
// стилях TipTap і чужих зображеннях, а canvas дає однаковий результат скрізь.
//
// Опис — rich-text HTML: підтримуємо абзаци, жирний/курсив, списки й розриви
// рядків; кубики та внутрішні посилання малюються текстом (як і в друці).

const DPI = 300;
const PX_PER_MM = DPI / 25.4;
const PT_MM = 25.4 / 72;

const COLORS = {
  paper: '#f4efe4', ink: '#5b440a', text: '#3b2d08', muted: '#6b5530', gold: '#8a5a2b',
};
const DISPLAY = '"Cinzel", serif';
const BODY = '"Lora", serif';

const MARGIN_MM = 3.5;
const IMAGE_H_MM = 44;
const MAX_FONT_PT = 8.5;
const MIN_FONT_PT = 5.5;

const mm = (v) => v * PX_PER_MM;
const ptPx = (pt) => pt * PT_MM * PX_PER_MM;

// ── Опис: HTML → абзаци зі стилізованими шматками ───────────────────────────

function collectInline(node, style, runs) {
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      const text = child.textContent.replace(/\s+/g, ' ');
      if (text) runs.push({ text, bold: style.bold, italic: style.italic });
    } else if (child.nodeType === 1) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'br') { runs.push({ br: true }); return; }
      if (tag === 'ul' || tag === 'ol') return; // списки обробляє blockPass
      collectInline(child, {
        bold: style.bold || tag === 'strong' || tag === 'b' || /^h\d$/.test(tag) || child.getAttribute('data-type') === 'dice-roll',
        italic: style.italic || tag === 'em' || tag === 'i',
      }, runs);
    }
  });
}

const hasContent = (runs) => runs.some((r) => r.br || r.text.trim());

function blockPass(node, out) {
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      const text = child.textContent.trim();
      if (text) out.push({ runs: [{ text, bold: false, italic: false }], bullet: false });
      return;
    }
    if (child.nodeType !== 1) return;
    const tag = child.tagName.toLowerCase();
    if (tag === 'ul' || tag === 'ol' || tag === 'div' || tag === 'blockquote') {
      blockPass(child, out);
    } else if (tag === 'li') {
      const start = out.length;
      blockPass(child, out);
      if (out.length === start) {
        const runs = [];
        collectInline(child, { bold: false, italic: false }, runs);
        if (hasContent(runs)) out.push({ runs, bullet: true });
      } else {
        out[start].bullet = true;
      }
    } else {
      const runs = [];
      collectInline(child, { bold: /^h\d$/.test(tag), italic: false }, runs);
      if (hasContent(runs)) out.push({ runs, bullet: false });
    }
  });
}

export function parseDescription(html) {
  if (!html) return [];
  // Старі описи — звичайний текст без тегів.
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return html.split(/\n+/).map((l) => l.trim()).filter(Boolean)
      .map((text) => ({ runs: [{ text, bold: false, italic: false }], bullet: false }));
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];
  blockPass(doc.body, out);
  return out;
}

// ── Перенесення рядків ──────────────────────────────────────────────────────

const fontOf = (family, px, { bold, italic }) => `${italic ? 'italic ' : ''}${bold ? '600 ' : '400 '}${px}px ${family}`;

// Жадібне перенесення абзаців у лінії ширини maxWidth. Лінія — масив шматків
// { text, font }; indent — відступ під маркер списку.
function layoutParagraphs(ctx, paragraphs, { family, px, maxWidth }) {
  const lines = [];
  paragraphs.forEach((para, paraIndex) => {
    ctx.font = fontOf(family, px, {});
    const indent = para.bullet ? ctx.measureText('• ').width : 0;
    const newLine = (first) => ({
      segs: first && para.bullet ? [{ text: '• ', font: ctx.font }] : [],
      width: indent,
      indent: first ? 0 : indent,
      para: paraIndex,
      hasText: false,
    });
    let line = newLine(true);
    const flush = () => {
      lines.push(line);
      line = newLine(false);
    };

    para.runs.forEach((run) => {
      if (run.br) { flush(); return; }
      const font = fontOf(family, px, run);
      ctx.font = font;
      run.text.split(/(\s+)/).filter(Boolean).forEach((token) => {
        const isSpace = /^\s+$/.test(token);
        const width = ctx.measureText(token).width;
        if (isSpace) {
          // Пробіл на початку рядка чи в кінці (на межі переносу) не потрібен.
          if (!line.hasText || line.width + width > maxWidth) return;
        } else {
          if (line.hasText && line.width + width > maxWidth) flush();
          line.hasText = true;
        }
        line.segs.push({ text: token, font });
        line.width += width;
      });
    });
    lines.push(line);
  });
  return lines;
}

// ── Малювання ───────────────────────────────────────────────────────────────

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    // Для чужого https-хоста без CORS canvas «заб'ється» і toBlob впаде: тоді
    // img.onerror спрацює вже тут, і картка експортується без зображення.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Джерельний прямокутник зображення під форму рамки — та сама математика, що й
// CroppedImage (кадр користувача), інакше центрований cover.
function sourceRect(img, crop, boxAspect) {
  if (crop) {
    const { left, top, w, h } = cropRegion(crop, boxAspect);
    // Одиниці кадру: висота зображення = 1, ширина = crop.ratio.
    return { sx: (left / crop.ratio) * img.naturalWidth, sy: top * img.naturalHeight, sw: (w / crop.ratio) * img.naturalWidth, sh: h * img.naturalHeight };
  }
  const imgAspect = img.naturalWidth / img.naturalHeight;
  if (imgAspect > boxAspect) {
    const sw = img.naturalHeight * boxAspect;
    return { sx: (img.naturalWidth - sw) / 2, sy: 0, sw, sh: img.naturalHeight };
  }
  const sh = img.naturalWidth / boxAspect;
  return { sx: 0, sy: (img.naturalHeight - sh) / 2, sw: img.naturalWidth, sh };
}

function drawLabel(ctx, text, x, y, { align = 'left', pt, color, family = BODY, weight = 700, spacingEm = 0.15 }) {
  ctx.font = `${weight} ${ptPx(pt)}px ${family}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacingEm * ptPx(pt)}px`;
  ctx.fillText(text, x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

// Малює картку й повертає { blob, imageSkipped }. imageSkipped — зображення не
// вдалося вбудувати (недоступне або з чужого сервера без CORS).
export async function renderArtifactCard(artifact) {
  // Шрифти з @fontsource підтягуються лише коли ними щось намальовано на сторінці.
  await Promise.all([
    document.fonts.load(`700 40px ${DISPLAY}`),
    document.fonts.load(`400 40px ${BODY}`),
    document.fonts.load(`600 40px ${BODY}`),
  ]);

  const W = Math.round(mm(CARD_W_MM));
  const H = Math.round(mm(CARD_H_MM));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, W, H);

  const left = mm(MARGIN_MM);
  const innerW = W - left * 2;
  let y = mm(3);

  // Шапка: вид і рідкість.
  drawLabel(ctx, ARTIFACT_TYPE.label.toUpperCase(), left, y, { pt: 5.5, color: COLORS.muted });
  const rarity = RARITIES[artifact.rarity];
  if (rarity) drawLabel(ctx, rarity.label.toUpperCase(), W - left, y, { pt: 5.5, color: COLORS.gold, align: 'right' });
  y += mm(3.6);

  // Назва.
  const namePx = ptPx(12);
  const nameLines = layoutParagraphs(ctx, [{ runs: [{ text: artifact.name, bold: true, italic: false }], bullet: false }], { family: DISPLAY, px: namePx, maxWidth: innerW });
  ctx.fillStyle = COLORS.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  nameLines.forEach((line) => {
    ctx.font = `700 ${namePx}px ${DISPLAY}`;
    let x = left;
    line.segs.forEach((seg) => { ctx.fillText(seg.text, x, y); x += ctx.measureText(seg.text).width; });
    y += namePx * 1.25;
  });

  if (artifact.creator) {
    y += mm(0.5);
    const px = ptPx(6.5);
    ctx.font = `italic 400 ${px}px ${BODY}`;
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`Творець: ${artifact.creator}`, left, y);
    y += px * 1.25;
  }

  // Зображення.
  let imageSkipped = false;
  if (artifact.image_url) {
    y += mm(2);
    const boxH = mm(IMAGE_H_MM);
    const img = await loadImage(artifact.image_url);
    if (img) {
      const { sx, sy, sw, sh } = sourceRect(img, artifact.image_crop, innerW / boxH);
      ctx.drawImage(img, sx, sy, sw, sh, left, y, innerW, boxH);
    } else {
      imageSkipped = true;
      ctx.fillStyle = COLORS.paper;
      ctx.fillRect(left, y, innerW, boxH);
    }
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = mm(0.3);
    ctx.strokeRect(left, y, innerW, boxH);
    y += boxH;
  }

  // Підвал: ціна.
  const footerTop = mm(110.5);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = mm(0.15);
  ctx.beginPath();
  ctx.moveTo(left, footerTop);
  ctx.lineTo(W - left, footerTop);
  ctx.stroke();
  const footerTextY = footerTop + mm(1.8);
  drawLabel(ctx, 'ЦІНА', left, footerTextY + mm(0.5), { pt: 6, color: COLORS.muted, weight: 400, spacingEm: 0.08 });
  drawLabel(ctx, artifact.price != null ? String(Number(artifact.price)) : '—', W - left, footerTextY, {
    pt: 9, color: COLORS.ink, align: 'right', family: DISPLAY, spacingEm: 0,
  });

  // Опис: найбільший кегль 8,5 → 5,5 pt, з яким текст влазить; нижче — обрізаємо.
  const descTop = y + mm(2);
  const descBottom = footerTop - mm(1.5);
  const paragraphs = parseDescription(artifact.description);
  if (paragraphs.length > 0 && descBottom > descTop) {
    const paraGap = 0.35;
    const measure = (pt) => {
      const px = ptPx(pt);
      const lines = layoutParagraphs(ctx, paragraphs, { family: BODY, px, maxWidth: innerW });
      const lh = px * 1.3;
      const gaps = new Set(lines.map((l) => l.para)).size - 1;
      return { px, lines, lh, height: lines.length * lh + gaps * lh * paraGap };
    };
    let pt = MAX_FONT_PT;
    let layout = measure(pt);
    while (layout.height > descBottom - descTop && pt > MIN_FONT_PT) {
      pt -= 0.25;
      layout = measure(pt);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, descTop, innerW, descBottom - descTop);
    ctx.clip();
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let lineY = descTop;
    let prevPara = layout.lines[0]?.para;
    layout.lines.forEach((line) => {
      if (line.para !== prevPara) { lineY += layout.lh * paraGap; prevPara = line.para; }
      let x = left + line.indent;
      line.segs.forEach((seg) => {
        ctx.font = seg.font;
        ctx.fillText(seg.text, x, lineY + (layout.lh - layout.px) / 2);
        x += ctx.measureText(seg.text).width;
      });
      lineY += layout.lh;
    });
    ctx.restore();
  }

  // Рамка картки зверху всього.
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = mm(0.5);
  ctx.strokeRect(mm(0.25), mm(0.25), W - mm(0.5), H - mm(0.5));

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('Не вдалося створити зображення');
  return { blob, imageSkipped };
}

// Ім'я файлу без символів, заборонених у файлових системах.
export function cardFileName(artifact) {
  const base = (artifact.name || 'artifact').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return `${base || 'artifact'}.jpg`;
}

export async function downloadArtifactCardJpeg(artifact) {
  const { blob, imageSkipped } = await renderArtifactCard(artifact);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cardFileName(artifact);
  a.click();
  URL.revokeObjectURL(url);
  return { imageSkipped };
}
