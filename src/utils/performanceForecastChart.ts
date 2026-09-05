import type { PerformanceForecastMetric } from './trainingOutlook';

export function formatForecastChartValue(metric: PerformanceForecastMetric, value: number): string {
  if (metric.key === 'training_load_trend') {
    return value >= 10 ? value.toFixed(1) : value.toFixed(2);
  }
  return `${Math.round(value)}/100`;
}

export function buildForecastChartDetail(metric: PerformanceForecastMetric): string {
  const points = metric.chartValues
    .map((value, index) => {
      const label = metric.chartLabels[index] ?? `point ${index + 1}`;
      return `${label}: ${formatForecastChartValue(metric, value)}`;
    })
    .join('\n');

  return [
    `X-axis: ${metric.chartXAxisLabel}`,
    `Y-axis: ${metric.chartYAxisLabel}`,
    '',
    'Data points:',
    points,
    '',
    metric.summary,
  ].join('\n');
}
