export default function Card({ className = '', children, ...props }) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}
