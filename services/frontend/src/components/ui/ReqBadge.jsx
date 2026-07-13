export default function ReqBadge({ type }) {
  const optional = type === 'optional';
  return (
    <span className={`rounded px-1 text-[0.65rem] ${optional ? 'bg-accent/15 text-accent' : 'bg-sage/15 text-sage'}`}>
      {optional ? 'АБО' : 'І'}
    </span>
  );
}
