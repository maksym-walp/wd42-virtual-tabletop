import CatalogTabs from '../CatalogTabs';

// Верхній рівень сервісу «Хронологія»: каталог календарів і окрема вкладка
// подій (раніше «Події» були підвкладкою всередині конкретного календаря).
export default function ChronologyTabs() {
  return (
    <CatalogTabs
      tabs={[
        { label: 'Календарі', to: '/chronology', end: true },
        { label: 'Події', to: '/chronology/events' },
      ]}
    />
  );
}
