import './Button.css';

/** Shared action button for new and refactored screens. */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  ...props
}) {
  const classes = ['app-button', `app-button--${variant}`, `app-button--${size}`, loading ? 'is-loading' : '', className].filter(Boolean).join(' ');
  return <button {...props} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined}>{loading && <span className="app-button__spinner" aria-hidden="true" />}{children}</button>;
}
