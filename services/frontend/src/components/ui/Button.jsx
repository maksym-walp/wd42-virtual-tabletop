import { Link } from 'react-router-dom';

const VARIANTS = {
  primary: 'bg-accent text-bg hover:opacity-90',
  sage: 'bg-sage text-bg hover:opacity-90',
  ghost: 'bg-transparent text-text border border-border hover:bg-surface-hover',
  danger: 'bg-danger text-bg hover:opacity-90',
};

const SIZES = {
  md: 'min-h-11 px-5 text-sm',
  sm: 'min-h-9 px-3.5 text-xs',
  icon: 'h-11 w-11 p-0',
};

export default function Button({
  variant = 'primary', size = 'md', to, className = '', children, ...props
}) {
  const classes = [
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold',
    'transition-opacity disabled:opacity-50 disabled:cursor-not-allowed',
    SIZES[size], VARIANTS[variant], className,
  ].join(' ');

  if (to) return <Link to={to} className={classes} {...props}>{children}</Link>;
  return <button className={classes} {...props}>{children}</button>;
}
