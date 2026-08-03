import { cn } from '../../utils/cn.js';

const VARIANTS = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500 border border-transparent',
  secondary: 'bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-gray-400 border border-gray-300',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 focus-visible:ring-gray-400 border border-transparent',
  danger: 'bg-white text-red-600 hover:bg-red-50 focus-visible:ring-red-400 border border-red-200',
};

const SIZES = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-8 px-3 text-sm gap-2',
  lg: 'h-9 px-4 text-sm gap-2',
};

/**
 * Core button component. Always render as a <button> element.
 * Use variant and size props to control appearance.
 */
export const Button = ({
  children,
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled = false,
  className,
  ...props
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center rounded font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-3.5 w-3.5 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
};
