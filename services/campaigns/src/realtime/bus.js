const { EventEmitter } = require('events');

// Шина подій кампаній у пам'яті процесу. Сервіс campaigns працює одним
// процесом, тож EventEmitter достатньо; якщо колись з'являться репліки —
// той самий інтерфейс (publish/subscribe) переводиться на pg LISTEN/NOTIFY.
//
// Подія — лише тема ('board', 'screen', 'campaign', 'sessions', 'characters',
// 'combat'), без даних: клієнт перезапитує ресурс власним запитом, тож
// редагування для гравців і далі робить звичайний REST-ендпоінт.
const emitter = new EventEmitter();
emitter.setMaxListeners(0); // по одному слухачу на відкриту вкладку

// Теми, які отримують лише майстер/адмін.
const MANAGER_ONLY_TOPICS = new Set(['screen']);

function channel(campaignId) {
  return `campaign:${campaignId}`;
}

function publish(campaignId, topic) {
  emitter.emit(channel(campaignId), topic);
}

// Повертає функцію відписки.
function subscribe(campaignId, listener) {
  const name = channel(campaignId);
  emitter.on(name, listener);
  return () => emitter.off(name, listener);
}

function listenerCount(campaignId) {
  return emitter.listenerCount(channel(campaignId));
}

module.exports = { publish, subscribe, listenerCount, MANAGER_ONLY_TOPICS };
