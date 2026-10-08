const BoardItemModel = require('../models/board-item.model');
const BoardSourceModel = require('../models/board-source.model');
const bus = require('../realtime/bus');
const { loadCampaignOr404, canManage, canView, isAdmin } = require('./load-campaign');

const ZONES = ['table', 'screen'];
const OWN_KINDS = ['image', 'note', 'custom'];
const KINDS = [...BoardSourceModel.SOURCE_KINDS, ...OWN_KINDS];

const MAX_TITLE_LENGTH = 200;
const MAX_URL_LENGTH = 500; // = VARCHAR(500) у схемі
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_TITLES = { image: 'Зображення', note: 'Нотатка' };

// Приймаємо або власний upload (/uploads/...), або зовнішній https-URL.
// Це відсікає javascript: і data: — вони інакше потрапили б у <img src>.
function isAllowedImageUrl(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_URL_LENGTH
    && (value.startsWith('/uploads/') || value.startsWith('https://'));
}

function cleanTitle(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_TITLE_LENGTH) : '';
}

// Тема real-time події: Стіл бачать усі, Ширму — лише майстер/адмін.
function topicFor(zone) {
  return zone === 'screen' ? 'screen' : 'board';
}

function snapshotFields(source) {
  return {
    title: cleanTitle(source.title) || 'Без назви',
    subtitle: source.subtitle ? cleanTitle(source.subtitle) : null,
    image_url: source.image_url ?? null,
    image_crop: source.image_crop ?? null,
    content: source.content ?? null,
  };
}

async function loadManagedOr403(req, res) {
  const campaign = await loadCampaignOr404(req, res);
  if (!campaign) return null;
  if (!canManage(campaign, req.user)) { res.status(403).json({ message: 'Доступ заборонено' }); return null; }
  return campaign;
}

const BoardController = {
  async list(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;

    const zone = req.query?.zone || 'table';
    if (!ZONES.includes(zone)) return res.status(400).json({ message: 'Некоректна зона' });

    const manager = canManage(campaign, req.user);
    if (zone === 'screen' && !manager) return res.status(403).json({ message: 'Доступ заборонено' });
    if (!manager && !await canView(campaign, req.user)) return res.status(403).json({ message: 'Доступ заборонено' });

    const items = await BoardItemModel.listByZone(campaign.id, zone, {
      manager, userId: req.user.sub, admin: isAdmin(req.user),
    });
    res.json({ items });
  },

  async add(req, res) {
    const campaign = await loadManagedOr403(req, res);
    if (!campaign) return;

    const { zone = 'table', kind, ref_id, ref_subtype } = req.body;
    if (!ZONES.includes(zone)) return res.status(400).json({ message: 'Некоректна зона' });
    if (!KINDS.includes(kind)) return res.status(400).json({ message: 'Некоректний тип запису' });

    let data;
    if (OWN_KINDS.includes(kind)) {
      const { image_url, content } = req.body;
      if (image_url !== undefined && image_url !== null && !isAllowedImageUrl(image_url)) {
        return res.status(400).json({ message: 'Некоректне посилання на зображення' });
      }
      if (kind === 'image' && !image_url) return res.status(400).json({ message: 'image_url є обовʼязковим' });

      const title = cleanTitle(req.body.title) || DEFAULT_TITLES[kind];
      if (!title) return res.status(400).json({ message: 'title є обовʼязковим' });
      data = { title, image_url: image_url || null, content: content ?? null };
    } else {
      if (!ref_id || !UUID_RE.test(ref_id)) return res.status(400).json({ message: 'Некоректний ref_id' });
      if (kind === 'equipment' && !BoardSourceModel.EQUIPMENT_SUBTYPES.includes(ref_subtype)) {
        return res.status(400).json({ message: 'Некоректний тип спорядження' });
      }
      if (kind === 'map' && await BoardItemModel.mapOnBoard(campaign.id, ref_id)) {
        return res.status(409).json({ message: 'Мапу вже додано до кампанії' });
      }

      const source = await BoardSourceModel.resolve(kind, ref_id, ref_subtype, req.user);
      if (!source) return res.status(404).json({ message: 'Запис не знайдено' });
      data = {
        ...snapshotFields(source),
        ref_id,
        ref_subtype: kind === 'equipment' ? ref_subtype : null,
      };
    }

    const item = await BoardItemModel.create(campaign.id, {
      ...data, zone, kind, is_visible: zone === 'table' && req.body.is_visible === true,
    }, req.user.sub);
    bus.publish(campaign.id, topicFor(zone));
    res.status(201).json({ item });
  },

  // Одне PATCH-тіло може перемістити запис, змінити видимість/основний і
  // поправити текст картки.
  async update(req, res) {
    const campaign = await loadManagedOr403(req, res);
    if (!campaign) return;

    let item = await BoardItemModel.findById(req.params.itemId, campaign.id);
    if (!item) return res.status(404).json({ message: 'Запис не знайдено' });
    const previousZone = item.zone;

    const { zone, is_visible, is_featured } = req.body;
    if (zone !== undefined && !ZONES.includes(zone)) return res.status(400).json({ message: 'Некоректна зона' });
    if (req.body.image_url !== undefined && req.body.image_url !== null && !isAllowedImageUrl(req.body.image_url)) {
      return res.status(400).json({ message: 'Некоректне посилання на зображення' });
    }
    if (req.body.title !== undefined && !cleanTitle(req.body.title)) {
      return res.status(400).json({ message: 'title є обовʼязковим' });
    }

    if (zone && zone !== item.zone) item = await BoardItemModel.moveToZone(item.id, campaign.id, zone);
    if (typeof is_visible === 'boolean') item = await BoardItemModel.setVisible(item.id, campaign.id, is_visible);
    if (typeof is_featured === 'boolean') item = await BoardItemModel.setFeatured(item.id, campaign.id, is_featured);

    const fields = {
      title: req.body.title !== undefined ? cleanTitle(req.body.title) : undefined,
      subtitle: req.body.subtitle,
      content: req.body.content,
      image_url: req.body.image_url,
    };
    item = await BoardItemModel.updateFields(item.id, campaign.id, fields);

    bus.publish(campaign.id, topicFor(item.zone));
    if (previousZone !== item.zone) bus.publish(campaign.id, topicFor(previousZone));
    res.json({ item });
  },

  // Перечитати знімок картки з джерела (майстер оновив НІПа чи заклинання).
  async refresh(req, res) {
    const campaign = await loadManagedOr403(req, res);
    if (!campaign) return;

    const item = await BoardItemModel.findById(req.params.itemId, campaign.id);
    if (!item) return res.status(404).json({ message: 'Запис не знайдено' });
    if (!item.ref_id) return res.status(400).json({ message: 'Цей запис не має джерела' });

    const source = await BoardSourceModel.resolve(item.kind, item.ref_id, item.ref_subtype, req.user);
    if (!source) return res.status(404).json({ message: 'Джерело запису не знайдено або недоступне' });

    const updated = await BoardItemModel.updateFields(item.id, campaign.id, snapshotFields(source));
    bus.publish(campaign.id, topicFor(updated.zone));
    res.json({ item: updated });
  },

  async reorder(req, res) {
    const campaign = await loadManagedOr403(req, res);
    if (!campaign) return;

    const { zone, ids } = req.body;
    if (!ZONES.includes(zone)) return res.status(400).json({ message: 'Некоректна зона' });
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'string' && UUID_RE.test(id))) {
      return res.status(400).json({ message: 'ids має бути непорожнім масивом id' });
    }

    await BoardItemModel.reorder(campaign.id, zone, ids);
    bus.publish(campaign.id, topicFor(zone));
    res.status(204).send();
  },

  async remove(req, res) {
    const campaign = await loadManagedOr403(req, res);
    if (!campaign) return;

    const removed = await BoardItemModel.remove(req.params.itemId, campaign.id);
    if (!removed) return res.status(404).json({ message: 'Запис не знайдено' });

    // Завантажений файл зображення лишається на диску: media-service
    // stateless і не має delete-ендпоінта (він не зміг би перевірити власника).
    bus.publish(campaign.id, topicFor(removed.zone));
    res.status(204).send();
  },
};

module.exports = BoardController;
