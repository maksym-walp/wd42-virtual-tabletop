// Знімає `//`-коментарі поза рядковими літералами — те, що додає
// buildEquipmentImportTemplate (і будь-який інший генератор шаблону), а
// стандартний JSON.parse не розуміє. Посимвольний прохід, а не regexp:
// потрібно не займати `//`, що трапився всередині значення-рядка.
export function stripJsonComments(text) {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      result += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      result += ch;
      continue;
    }

    if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      result += '\n';
      continue;
    }

    result += ch;
  }

  return result;
}

export function parseJsonWithComments(text) {
  return JSON.parse(stripJsonComments(text));
}
