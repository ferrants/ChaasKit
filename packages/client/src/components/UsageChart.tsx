import { useState, useMemo } from 'react';
import type { UsageDataPoint } from '@chaaskit/shared';

type MetricType = 'messages' | 'inputTokens' | 'outputTokens' | 'totalTokens';

interface UsageChartProps {
  data: UsageDataPoint[];
  metric: MetricType;
  isLoading?: boolean;
}

export default function UsageChart({ data, metric, isLoading }: UsageChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { values, maxValue, total, average, peakDay } = useMemo(() => {
    const values = data.map((d) => {
      if (metric === 'totalTokens') {
        return d.inputTokens + d.outputTokens;
      }
      return d[metric];
    });

    const maxValue = Math.max(...values, 1);
    const total = values.reduce((a, b) => a + b, 0);
    const average = values.length > 0 ? total / values.length : 0;

    let peakIndex = 0;
    let peakValue = 0;
    values.forEach((v, i) => {
      if (v > peakValue) {
        peakValue = v;
        peakIndex = i;
      }
    });
    const peakDay = data[peakIndex]?.date || '';

    return { values, maxValue, total, average, peakDay };
  }, [data, metric]);

  const metricLabels: Record<MetricType, string> = {
    messages: 'messages',
    inputTokens: 'input tokens',
    outputTokens: 'output tokens',
    totalTokens: 'total tokens',
  };

  const formatValue = (value: number): string => {
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`;
    }
    return value.toLocaleString();
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="h-32 w-full flex items-end justify-center gap-1">
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                className="w-4 bg-[var(--color-background-secondary)] rounded-t"
                style={{ height: `${Math.random() * 80 + 20}%` }}
              />
            ))}
          </div>
          <div className="h-4 w-48 bg-[var(--color-background-secondary)] rounded" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-[var(--color-text-muted)]">
        No usage data available for this period
      </div>
    );
  }

  // Determine label frequency based on data length
  const labelFrequency = data.length > 60 ? 14 : data.length > 30 ? 7 : data.length > 14 ? 3 : 1;

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="relative h-48">
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {values.map((value, index) => {
            const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
            const isHovered = hoveredIndex === index;

            return (
              <div
                key={index}
                className="flex-1 relative group"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div
                  className={`w-full rounded-t transition-all cursor-pointer ${
                    isHovered
                      ? 'bg-[var(--color-primary)]'
                      : 'bg-[var(--color-primary)]/60 hover:bg-[var(--color-primary)]/80'
                  }`}
                  style={{ height: `${Math.max(height, 2)}%` }}
                />

                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 whitespace-nowrap">
                    <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg shadow-lg px-3 py-2">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {formatDate(data[index].date)}
                      </p>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {value.toLocaleString()} {metricLabels[metric]}
                      </p>
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-[var(--color-background)] border-r border-b border-[var(--color-border)] rotate-45" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-xs text-[var(--color-text-muted)] px-1">
        {data.map((d, i) => {
          if (i % labelFrequency !== 0 && i !== data.length - 1) {
            return <span key={i} className="flex-1" />;
          }
          return (
            <span key={i} className="flex-1 text-center">
              {formatDate(d.date)}
            </span>
          );
        })}
      </div>

      {/* Summary row */}
      <div className="flex items-center justify-center gap-6 pt-3 mt-1 border-t border-[var(--color-background)] text-sm">
        <div className="text-center">
          <span className="text-[var(--color-text-muted)]">Total: </span>
          <span className="font-medium text-[var(--color-text-primary)]">
            {formatValue(total)} {metricLabels[metric]}
          </span>
        </div>
        <div className="text-center">
          <span className="text-[var(--color-text-muted)]">Avg: </span>
          <span className="font-medium text-[var(--color-text-primary)]">
            {formatValue(Math.round(average))}/day
          </span>
        </div>
        <div className="text-center">
          <span className="text-[var(--color-text-muted)]">Peak: </span>
          <span className="font-medium text-[var(--color-text-primary)]">
            {formatValue(Math.max(...values))}
          </span>
          {peakDay && (
            <span className="text-[var(--color-text-muted)]"> ({formatDate(peakDay)})</span>
          )}
        </div>
      </div>
    </div>
  );
}
