import { forwardRef } from 'react';
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

// forwardRef so callers that need the rendered DOM node (e.g. a dropdown
// positioning itself off the trigger button, à la MultiSelectDropdown) can
// get one — plain function components can't receive a ref at all.
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', to, className = '', children, ...props }, ref
) {
  const classes = [
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold',
    'transition-opacity disabled:opacity-50 disabled:cursor-not-allowed',
    SIZES[size], VARIANTS[variant], className,
  ].join(' ');

  if (to) return <Link ref={ref} to={to} className={classes} {...props}>{children}</Link>;
  return <button ref={ref} className={classes} {...props}>{children}</button>;
});

export default Button;
