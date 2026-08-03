import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
  Cell,
} from 'recharts';
import { ChartSkeleton } from '../common/Skeleton.jsx';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded px-3 py-2 shadow-sm">
      <span className="text-xs text-gray-500">{name}: </span>
      <span className="text-xs font-semibold text-gray-900">{value.toLocaleString()}</span>
    </div>
  );
};

const ConversionLabel = ({ data }) => {
  if (data.length < 2) return null;

  return (
    <div className="mt-4 flex items-center gap-6 flex-wrap">
      {data.slice(1).map((stage, i) => {
        const prev = data[i].value;
        const rate = prev > 0 ? ((stage.value / prev) * 100).toFixed(0) : 0;
        return (
          <div key={stage.name} className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">{data[i].name} → {stage.name}:</span>
            <span className="text-xs font-medium text-gray-700">{rate}%</span>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Horizontal bar chart styled as a pipeline funnel.
 * Each stage bar is sized relative to contact count,
 * with conversion rates displayed below.
 */
export const PipelineFunnel = ({ data, isLoading }) => {
  if (isLoading) return <ChartSkeleton height={224} />;

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 56, left: 0, bottom: 4 }}
            barCategoryGap="28%"
          >
            <XAxis
              type="number"
              hide
              domain={[0, maxValue * 1.15]}
            />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6b7280', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
              width={72}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
            <Bar dataKey="value" radius={[0, 2, 2, 0]} maxBarSize={24}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v) => v.toLocaleString()}
                style={{
                  fill: '#374151',
                  fontSize: 12,
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ConversionLabel data={data} />
    </div>
  );
};
