const CampaignGalleryModel = require('../models/campaign-gallery.model');
const CampaignCharacterModel = require('../models/campaign-character.model');
const { loadCampaignOr404, isGm } = require('./load-campaign');

const MAX_URL_LENGTH = 500; // = VARCHAR(500) у схемі

// Приймаємо або власний upload (/uploads/...), або зовнішній https-URL.
// Це відсікає javascript: і data: — вони інакше потрапили б у <img src>
// на сторінці кампанії.
function isAllowedImageUrl(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_URL_LENGTH
    && (value.startsWith('/uploads/') || value.startsWith('https://'));
}

const CampaignGalleryController = {
  // Галерею бачать усі учасники кампанії — той самий гейт, що в getOne.
  async list(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;

    const member = isGm(campaign, req.user.sub)
      || await CampaignCharacterModel.isMember(campaign.id, req.user.sub);
    if (!member) return res.status(403).json({ message: 'Доступ заборонено' });

    const images = await CampaignGalleryModel.listByCampaign(campaign.id);
    res.json({ images });
  },

  async add(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!isGm(campaign, req.user.sub)) return res.status(403).json({ message: 'Доступ заборонено' });

    const { image_url } = req.body;
    if (!isAllowedImageUrl(image_url)) {
      return res.status(400).json({ message: 'Некоректне посилання на зображення' });
    }

    const image = await CampaignGalleryModel.add(campaign.id, image_url);
    res.status(201).json({ image });
  },

  async remove(req, res) {
    const campaign = await loadCampaignOr404(req, res);
    if (!campaign) return;
    if (!isGm(campaign, req.user.sub)) return res.status(403).json({ message: 'Доступ заборонено' });

    const removed = await CampaignGalleryModel.remove(req.params.imageId, campaign.id);
    if (!removed) return res.status(404).json({ message: 'Зображення не знайдено' });

    // Сам файл лишається на диску: media-service stateless і не має
    // delete-ендпоінта (він не зміг би перевірити власника).
    res.status(204).send();
  },
};

module.exports = CampaignGalleryController;
