import CatalogTabs from '../CatalogTabs';

// Sub-navigation for the Maps section: maps list vs. the location library.
// Delegates to the shared CatalogTabs bar every other catalog service uses,
// instead of a hand-rolled copy, so the tab row looks identical everywhere.
const TABS = [
  { to: '/maps', label: 'Мапи', end: true },
  { to: '/maps/locations', label: 'Локації' },
];

export default function MapsTabs() {
  return <CatalogTabs tabs={TABS} />;
}
