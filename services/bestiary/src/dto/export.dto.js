// Поля, яких немає (чи не має бути) в експортованому JSON: зображення лежить
// на диску конкретного деплою, решта — службові/обчислені чи прив'язані до
// поточного користувача. Спільне для експорту колекції, записів у ній і
// експорту одного запису.
const EXPORT_OMIT_FIELDS = [
  'image_url', 'image_crop', 'created_at', 'updated_at', 'is_owner', 'owner_username', 'created_by',
];

function sanitizeForExport(row) {
  const clean = { ...row };
  for (const field of EXPORT_OMIT_FIELDS) delete clean[field];
  return clean;
}

module.exports = { EXPORT_OMIT_FIELDS, sanitizeForExport };
