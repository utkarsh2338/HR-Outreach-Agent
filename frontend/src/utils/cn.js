/**
 * Merges class names, filtering out falsy values.
 * Lightweight alternative to clsx for this project's needs.
 */
export const cn = (...classes) => classes.filter(Boolean).join(' ');
