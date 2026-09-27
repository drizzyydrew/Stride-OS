import type { PerformanceForecastMetric } from './trainingOutlook';

export function formatForecastChartValue(metric: PerformanceForecastMetric, value: number): string {
  // All forecast charts are percentages (training load: % of 4-week baseline).
  return `${Math.round(value)}%`;
}

export function buildForecastChartDetail(metric: PerformanceForecastMetric): string {
  const points = metric.chartValues
    .map((value, index) => {
      const label = metric.chartLabels[index] ?? `point ${index + 1}`;
      return `${label}: ${formatForecastChartValue(metric, value)}`;
    })
    .join('\n');

  return [
    metric.summary,
    '',
    'Points:',
    points,
    '',
    metric.info,
  ].join('\n');
}
