import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import marketEvents from '../data/marketEvents.json';
import { useCryptoPrice } from '../hooks/useCryptoPrice';

export function PriceCorrelation({ trendData }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [hoveredEvent, setHoveredEvent] = useState(null);

  // Fetch live BTC price data (refresh every 5 minutes)
  const { priceData: livePriceData, currentPrice, loading: priceLoading, lastUpdated, isLive } = useCryptoPrice('bitcoin', 730, 300000);

  // Merge complaint data with price data
  const chartData = useMemo(() => {
    // Create a map of prices by month from live data
    const priceMap = {};
    livePriceData.forEach(item => {
      priceMap[item.month] = item.price;
    });

    return trendData.map(item => ({
      ...item,
      price: priceMap[item.month] || null,
      priceK: priceMap[item.month] ? Math.round(priceMap[item.month] / 1000) : null,
    })).filter(item => item.price !== null || item.count > 0);
  }, [trendData, livePriceData]);

  // Sort events newest first
  const sortedEvents = useMemo(() => {
    return [...marketEvents].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, []);

  // Find events that fall within our data range
  const relevantEvents = useMemo(() => {
    if (chartData.length === 0) return sortedEvents;
    const firstMonth = chartData[0]?.month || '2022-01';
    const lastMonth = chartData[chartData.length - 1]?.month || '2025-12';

    return sortedEvents.filter(event => {
      const eventMonth = event.date.substring(0, 7);
      return eventMonth >= firstMonth && eventMonth <= lastMonth;
    });
  }, [chartData, sortedEvents]);

  // Calculate correlation coefficient
  const correlation = useMemo(() => {
    const validData = chartData.filter(d => d.price !== null && d.count > 0);
    if (validData.length < 3) return null;

    const n = validData.length;
    const sumX = validData.reduce((acc, d) => acc + d.price, 0);
    const sumY = validData.reduce((acc, d) => acc + d.count, 0);
    const sumXY = validData.reduce((acc, d) => acc + d.price * d.count, 0);
    const sumX2 = validData.reduce((acc, d) => acc + d.price * d.price, 0);
    const sumY2 = validData.reduce((acc, d) => acc + d.count * d.count, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return null;
    return (numerator / denominator).toFixed(2);
  }, [chartData]);

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getEventColor = (type) => {
    switch (type) {
      case 'crash': return '#ef4444';
      case 'positive': return '#22c55e';
      case 'regulatory': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  // Custom clickable label for event markers
  const ClickableEventLabel = ({ viewBox, event, color }) => {
    const { x } = viewBox;
    return (
      <g>
        <circle
          cx={x}
          cy={8}
          r={6}
          fill={color}
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedEvent(event);
          }}
          onMouseEnter={() => setHoveredEvent(event)}
          onMouseLeave={() => setHoveredEvent(null)}
        />
        <title>{`${format(parseISO(event.date), 'MMM yyyy')}: ${event.event}`}</title>
      </g>
    );
  };

  const ChartContent = ({ height = 288 }) => (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          tickLine={false}
          interval={isExpanded ? 0 : "preserveStartEnd"}
          angle={isExpanded ? -45 : 0}
          textAnchor={isExpanded ? "end" : "middle"}
          height={isExpanded ? 60 : 30}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          label={{ value: 'Complaints', angle: -90, position: 'insideLeft', fontSize: 11 }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}k`}
          label={{ value: 'BTC Price', angle: 90, position: 'insideRight', fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(255,255,255,0.95)',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          }}
          formatter={(value, name) => {
            if (name === 'Complaints') return [value.toLocaleString(), name];
            if (name === 'BTC Price') return [`$${(value * 1000).toLocaleString()}`, name];
            return [value, name];
          }}
        />
        <Legend />

        {/* Complaint volume bars */}
        <Bar
          yAxisId="left"
          dataKey="count"
          name="Complaints"
          fill="#3b82f6"
          opacity={0.7}
          radius={[2, 2, 0, 0]}
        />

        {/* BTC price line */}
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="priceK"
          name="BTC Price"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={isExpanded}
        />

        {/* Event markers on chart - show all events */}
        {relevantEvents.map((event, i) => {
          const eventMonth = event.date.substring(0, 7);
          const dataPoint = chartData.find(d => d.month === eventMonth);
          if (!dataPoint) return null;

          const isHovered = hoveredEvent === event;

          return (
            <ReferenceLine
              key={i}
              x={dataPoint.label}
              yAxisId="left"
              stroke={getEventColor(event.type)}
              strokeDasharray={isHovered ? "0" : "3 3"}
              strokeWidth={isHovered ? 3 : (isExpanded ? 2 : 1)}
              strokeOpacity={isHovered ? 1 : 0.7}
              ifOverflow="extendDomain"
              label={<ClickableEventLabel event={event} color={getEventColor(event.type)} />}
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );

  // Event detail modal
  const EventModal = ({ event, onClose }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded mb-2 ${
              event.type === 'crash' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' :
              event.type === 'positive' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
              'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
            }`}>
              {event.type === 'crash' ? 'Market Crash' : event.type === 'positive' ? 'Positive Event' : 'Regulatory'}
            </span>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{event.event}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{format(parseISO(event.date), 'MMMM d, yyyy')}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">What Happened</h4>
            <p className="text-gray-600 dark:text-gray-400">{event.description}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Impact on Complaints</h4>
            <p className="text-gray-600 dark:text-gray-400">{event.impact}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Main Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-4">
          <div className="flex items-center justify-between sm:block">
            <div>
              <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
                BTC Price vs Complaints
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {priceLoading ? 'Loading...' : (
                  <>
                    {isLive ? '● Live' : 'Static'}
                    {lastUpdated && <span className="hidden sm:inline ml-1">(Updated {formatTime(lastUpdated)})</span>}
                  </>
                )}
              </p>
            </div>
            {/* Expand Button - mobile */}
            <button
              onClick={() => setIsExpanded(true)}
              className="sm:hidden p-2 rounded-lg bg-gray-100 dark:bg-gray-700"
              title="Expand chart"
            >
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-3">
            {/* Current BTC Price */}
            {currentPrice && (
              <div className="text-left sm:text-right">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  ${currentPrice.price?.toLocaleString()}
                </div>
                {currentPrice.change24h !== null && (
                  <div className={`text-xs ${currentPrice.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {currentPrice.change24h >= 0 ? '↑' : '↓'} {Math.abs(currentPrice.change24h || 0).toFixed(2)}%
                  </div>
                )}
              </div>
            )}
            {/* Correlation */}
            {correlation !== null && (
              <div className="text-right">
                <span className="text-xs text-gray-500 dark:text-gray-400">r=</span>
                <span className={`font-mono font-medium ${
                  parseFloat(correlation) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                }`}>
                  {correlation}
                </span>
              </div>
            )}
            {/* Expand Button - desktop */}
            <button
              onClick={() => setIsExpanded(true)}
              className="hidden sm:block p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="Expand chart"
            >
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
        </div>

        <div className="h-56 sm:h-72">
          <ChartContent />
        </div>

        {/* Clickable Event Tags */}
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700/50 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">Key Events (tap for details):</p>
          <div className="flex flex-wrap gap-1 sm:gap-1.5 justify-center">
            {relevantEvents.slice(0, 6).map((event, i) => (
              <button
                key={i}
                onClick={() => setSelectedEvent(event)}
                className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs rounded cursor-pointer active:brightness-90 transition-all ${
                  event.type === 'crash'
                    ? 'bg-red-100 text-red-700 border border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30'
                    : event.type === 'positive'
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30'
                    : 'bg-violet-100 text-violet-700 border border-violet-300 dark:bg-violet-500/20 dark:text-violet-400 dark:border-violet-500/30'
                }`}
              >
                <span className="hidden sm:inline">{format(parseISO(event.date), 'MMM yy')}: </span>
                <span className="sm:hidden">{format(parseISO(event.date), 'M/yy')} </span>
                {event.event.length > 15 ? event.event.substring(0, 15) + '...' : event.event}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}

      {/* Expanded Chart Modal */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  BTC Price vs Complaint Volume
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Expanded view
                  {currentPrice && (
                    <span className="ml-2">| Current BTC: <span className="font-medium">${currentPrice.price?.toLocaleString()}</span></span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="h-[500px]">
                <ChartContent height={500} />
              </div>

              {/* Interactive Event Legend */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Chart Events ({relevantEvents.length} shown)
                  </h3>
                  <div className="flex gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Positive
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span> Crash
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-violet-500"></span> Regulatory
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto">
                  {relevantEvents
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .map((event, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedEvent(event)}
                      onMouseEnter={() => setHoveredEvent(event)}
                      onMouseLeave={() => setHoveredEvent(null)}
                      className={`p-2 rounded text-left transition-all border ${
                        hoveredEvent === event
                          ? 'ring-2 ring-blue-500 border-transparent'
                          : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                      } ${
                        event.type === 'crash'
                          ? 'bg-red-500/10 hover:bg-red-500/20'
                          : event.type === 'positive'
                          ? 'bg-emerald-500/10 hover:bg-emerald-500/20'
                          : 'bg-violet-500/10 hover:bg-violet-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getEventColor(event.type) }}
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                          {format(parseISO(event.date), 'MMM yyyy')}
                        </span>
                        <span className="text-xs text-gray-800 dark:text-gray-200 truncate">
                          {event.event}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  Hover over an event to highlight its line on the chart. Click for details.
                </p>
              </div>

              {/* Correlation Analysis */}
              {correlation !== null && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Correlation Analysis</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    The correlation coefficient of <span className="font-mono font-medium">{correlation}</span> indicates a{' '}
                    {Math.abs(parseFloat(correlation)) > 0.5 ? 'strong' : Math.abs(parseFloat(correlation)) > 0.3 ? 'moderate' : 'weak'}{' '}
                    {parseFloat(correlation) > 0 ? 'positive' : 'negative'} relationship between BTC price and complaint volume.
                    {parseFloat(correlation) < 0 && ' This suggests complaints tend to increase when prices fall (market downturns).'}
                    {parseFloat(correlation) > 0 && ' This suggests complaints increase alongside price rises (possibly due to increased trading activity).'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
