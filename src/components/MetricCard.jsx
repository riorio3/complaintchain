export function MetricCard({ title, value, subtitle, trend, trendValue }) {
  const trendColor =
    trend === 'up' ? 'text-red-600 dark:text-red-400' : trend === 'down' ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400';
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</h3>
      <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{value}</p>
      {trend && trendValue !== undefined && (
        <p className={`mt-1 text-sm font-medium ${trendColor}`}>
          {trendIcon} {trendValue}% <span className="font-normal text-gray-500 dark:text-gray-400">vs last month</span>
        </p>
      )}
      {subtitle && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>}
    </div>
  );
}
