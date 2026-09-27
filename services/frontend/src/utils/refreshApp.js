// «Оновити застосунок» з меню налаштувань. Потрібне насамперед для версії,
// встановленої як PWA (display: standalone): там немає ні кнопки
// перезавантаження браузера, ні адресного рядка.
//
// Сервіс-воркер (vite-plugin-pwa, registerType: 'autoUpdate' — skipWaiting +
// clientsClaim) кешує збірку, тож простого reload іноді мало: спершу просимо
// його перевірити нову версію і, якщо вона знайшлась, чекаємо (не довше
// кількох секунд), поки вона активується, — тоді reload підтягне свіжі файли.
const ACTIVATE_TIMEOUT_MS = 5000;

function waitForActivation(worker) {
  if (!worker || worker.state === 'activated') return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ACTIVATE_TIMEOUT_MS);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated' || worker.state === 'redundant') {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

export default async function refreshApp() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.update();
      await waitForActivation(reg.installing || reg.waiting);
    }
  } catch {
    // Без мережі чи без SW — просто перезавантажуємо сторінку.
  }
  window.location.reload();
}
