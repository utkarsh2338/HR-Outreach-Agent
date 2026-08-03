import { cn } from '../../utils/cn.js';

/** A single animated skeleton line */
const SkeletonLine = ({ className }) => (
  <div className={cn('animate-pulse rounded bg-gray-100', className)} />
);

/** Full-width skeleton rows for a table body */
export const TableSkeleton = ({ rows = 8, cols = 6 }) => (
  <tbody>
    {Array.from({ length: rows }).map((_, ri) => (
      <tr key={ri} className="border-b border-gray-100">
        {Array.from({ length: cols }).map((_, ci) => (
          <td key={ci} className="px-4 py-3">
            <SkeletonLine
              className={cn('h-4', ci === 0 ? 'w-32' : ci === cols - 1 ? 'w-16' : 'w-24')}
            />
          </td>
        ))}
      </tr>
    ))}
  </tbody>
);

/** Skeleton for a metric / KPI card */
export const KPISkeleton = () => (
  <div className="border border-gray-200 rounded p-4 space-y-2">
    <SkeletonLine className="h-3 w-24" />
    <SkeletonLine className="h-7 w-16" />
  </div>
);

/** Skeleton block for chart area */
export const ChartSkeleton = ({ height = 224 }) => (
  <div
    className="animate-pulse rounded bg-gray-100 w-full"
    style={{ height }}
    aria-label="Loading chart..."
  />
);

/** Generic text skeleton lines */
export const TextSkeleton = ({ lines = 3, className }) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <SkeletonLine
        key={i}
        className={cn('h-4', i === lines - 1 ? 'w-3/5' : 'w-full')}
      />
    ))}
  </div>
);
