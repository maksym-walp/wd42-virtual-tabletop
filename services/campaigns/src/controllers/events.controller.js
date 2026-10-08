const bus = require('../realtime/bus');
const { loadCampaignOr404, canManage, canView } = require('./load-campaign');

// Менше за дефолтний proxy_read_timeout nginx (60 с), щоб проксі не рвав
// тихе з'єднання.
const HEARTBEAT_MS = 25000;

const EventsController = {
  // Server-Sent Events: повідомляє відкриті вкладки кампанії, що якийсь
  // ресурс змінився. Фронт читає стрім через fetch (щоб передати Bearer-
  // заголовок), а не EventSource.
  async stream(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!await canView(campaign, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const manager = canManage(campaign, req.user);

    res.status(200);
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx: не буферизувати цю відповідь
    });
    res.flushHeaders();
    res.write('retry: 3000\n\n');

    const unsubscribe = bus.subscribe(campaign.id, (topic) => {
      if (!manager && bus.MANAGER_ONLY_TOPICS.has(topic)) return;
      res.write(`data: ${JSON.stringify({ topic })}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  },
};

module.exports = EventsController;
