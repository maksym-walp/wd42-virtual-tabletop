// Smoothly expanding/collapsing filter panel, replacing the old popup/modal
// filter UI. Uses the grid-template-rows 0fr/1fr trick so height animates
// without measuring scrollHeight in JS — the panel naturally matches the
// width of whatever container it's rendered in and pushes following content
// down as it opens.
// className — зовнішній відступ панелі (типово mb-5; у бічній панелі каталогу — без нього).
export default function FilterAccordion({ open, children, className = 'mb-5' }) {
  return (
    <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
      <div className="overflow-hidden">
        <div className={`${className} flex flex-col gap-5 rounded-lg border border-border bg-surface p-4`}>
          {children}
        </div>
      </div>
    </div>
  );
}
