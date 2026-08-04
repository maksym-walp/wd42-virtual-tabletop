// Той самий Blob + <a download> прийом, що вже використовує SkillTree для
// експорту дерева — виносимо сюди, щоб не дублювати для каталогів.
export function downloadJsonFile(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
