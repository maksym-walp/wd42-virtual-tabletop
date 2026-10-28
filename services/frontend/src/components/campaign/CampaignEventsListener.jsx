import useCampaignEvents from '../../hooks/useCampaignEvents';

// Підписка на real-time події однієї кампанії як компонент — щоб сторінка
// без власної кампанії (лист персонажа) могла слухати кілька кампаній:
// по одному <CampaignEventsListener> на кожну.
export default function CampaignEventsListener({ campaignId, handlers }) {
  useCampaignEvents(campaignId, handlers);
  return null;
}
