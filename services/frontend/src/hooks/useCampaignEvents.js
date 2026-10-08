import { useEffect, useRef } from 'react';
import { getAccessToken, refreshAccessToken } from '../api/client';

const MIN_RETRY_MS = 1000;
const MAX_RETRY_MS = 30000;

// Real-time сповіщення кампанії (Server-Sent Events із campaigns-сервісу).
// Подія несе лише тему ('board', 'screen', 'campaign', 'sessions',
// 'characters', 'combat') — обробник сам перезапитує свій ресурс, тож
// урізання даних для гравців лишається на звичайних REST-ендпоінтах.
//
// Стрім читається через fetch, а не EventSource: так токен іде в
// Authorization-заголовку, а не в URL (який осідає в логах nginx).
// Після кожного перепідключення викликаються всі обробники — щоб надолужити
// події, пропущені, поки з'єднання не було.
export default function useCampaignEvents(campaignId, handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!campaignId) return undefined;

    const controller = new AbortController();
    let retryMs = MIN_RETRY_MS;
    let retryTimer = null;
    let connectedOnce = false;

    const dispatch = (topic) => {
      const fn = handlersRef.current?.[topic];
      if (typeof fn === 'function') fn();
    };
    const dispatchAll = () => Object.keys(handlersRef.current || {}).forEach(dispatch);

    const scheduleReconnect = () => {
      if (controller.signal.aborted) return;
      retryTimer = setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
    };

    async function connect(isRetryAfterRefresh = false) {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/events`, {
          headers: { Authorization: `Bearer ${getAccessToken()}`, Accept: 'text/event-stream' },
          credentials: 'include',
          signal: controller.signal,
        });

        if (res.status === 401 && !isRetryAfterRefresh) {
          await refreshAccessToken();
          return connect(true);
        }
        // 403/404: доступу немає — не довбемо сервер перепідключеннями.
        if (res.status === 403 || res.status === 404) return undefined;
        if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`);

        retryMs = MIN_RETRY_MS;
        if (connectedOnce) dispatchAll();
        connectedOnce = true;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let boundary;
          while ((boundary = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const data = block.split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim())
              .join('');
            if (!data) continue; // коментар-heartbeat або retry:
            try {
              const { topic } = JSON.parse(data);
              if (topic) dispatch(topic);
            } catch { /* битий рядок — пропускаємо */ }
          }
        }
        scheduleReconnect();
      } catch (err) {
        if (controller.signal.aborted) return undefined;
        scheduleReconnect();
      }
      return undefined;
    }

    connect();

    return () => {
      controller.abort();
      clearTimeout(retryTimer);
    };
  }, [campaignId]);
}
