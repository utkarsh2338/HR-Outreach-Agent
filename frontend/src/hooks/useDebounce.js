import { useState, useEffect } from 'react';

/**
 * Returns a debounced version of the value that only updates
 * after `delay` milliseconds have elapsed since the last change.
 */
export const useDebounce = (value, delay = 350) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};
