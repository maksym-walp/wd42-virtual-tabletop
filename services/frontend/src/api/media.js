import api from './client';

const BASE = '/api/media';

// Ліміт дублює серверний (multer) і nginx (client_max_body_size 12m).
// Перевірка на клієнті потрібна не для безпеки, а щоб не ганяти даремно
// мегабайти й показати зрозумілу помилку замість HTML-сторінки 413 від nginx.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif';

const mediaApi = {
  /**
   * Завантажує файл і повертає site-relative URL (/uploads/...).
   * entityType: 'campaign-gallery' | 'character' | 'item'
   * entityId потрібен для перших двох.
   */
  async upload(file, { entityType, entityId } = {}) {
    const fd = new FormData();
    // Текстові поля перед файлом: memoryStorage на сервері до порядку
    // байдужий, але парсери, які стрімлять на диск, бачать лише поля перед
    // файловою частиною — так запит лишається валідним за будь-якої стратегії.
    fd.append('entity_type', entityType);
    if (entityId) fd.append('entity_id', entityId);
    fd.append('file', file);

    // Content-Type НЕ виставляємо: axios сам додасть його разом із boundary.
    // Виставити вручну = втратити boundary = зіпсоване тіло запиту.
    const { data } = await api.post(`${BASE}/upload`, fd);
    return data.url;
  },
};

export default mediaApi;
