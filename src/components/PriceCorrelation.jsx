import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../hooks/useTheme';
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
  const { isDark } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const hoverTimeoutRef = useRef(null);

  // Debounced hover to prevent glitchy transitions
  const handleEventHover = useCallback((event) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (event) {
      // Immediate set for entering
      setHoveredEvent(event);
    } else {
      // Small delay for leaving to allow transition to next event
      hoverTimeoutRef.current = setTimeout(() => {
        setHoveredEvent(null);
      }, 50);
    }
  }, []);

  // Dynamic colors for chart based on theme
  const chartColors = {
    tickText: isDark ? '#e5e7eb' : '#374151',
    axisLabel: isDark ? '#ffffff' : '#1f2937',
  };

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
          onMouseEnter={() => handleEventHover(event)}
          onMouseLeave={() => handleEventHover(null)}
        />
        <title>{`${format(parseISO(event.date), 'MMM yyyy')}: ${event.event}`}</title>
      </g>
    );
  };

  // Check if mobile (will be used for responsive adjustments)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 640);

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculate smart tick interval based on data length, view, and screen size
  const getTickInterval = (expanded) => {
    const dataLength = chartData.length;
    if (isMobile && !expanded) {
      // Mobile compact: show ~4-5 labels max
      return Math.max(Math.floor(dataLength / 4), 1);
    }
    if (!expanded) {
      // Desktop compact: show ~5-6 labels
      return Math.max(Math.floor(dataLength / 5), 1);
    }
    if (isMobile && expanded) {
      // Mobile expanded: show ~6 labels
      return Math.max(Math.floor(dataLength / 6), 1);
    }
    // Desktop expanded view: show ~12-15 labels
    return Math.max(Math.floor(dataLength / 12), 1);
  };

  // Custom tick formatter - clean abbreviated format
  const formatXAxisTick = (value) => {
    if (!value) return '';
    // value is like "Jan 2019" or "Dec 2024"
    const parts = value.split(' ');
    if (parts.length !== 2) return value;
    const [, year] = parts;
    // Always show just the year for cleaner look
    return `'${year.slice(2)}`;
  };

  const ChartContent = ({ showEventMarkers = true }) => (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={chartData}
        margin={isMobile
          ? (isExpanded ? { top: 10, right: 30, left: 10, bottom: 5 } : { top: 5, right: 5, left: 0, bottom: 20 })
          : { top: 20, right: 45, left: 20, bottom: 5 }
        }
      >
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: isMobile && !isExpanded ? 9 : 11, fill: chartColors.tickText, fontWeight: 500 }}
          tickLine={false}
          interval={getTickInterval(isExpanded)}
          angle={0}
          textAnchor="middle"
          height={isMobile && !isExpanded ? 20 : 30}
          tickFormatter={formatXAxisTick}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: isMobile && !isExpanded ? 8 : 11, fill: chartColors.tickText, fontWeight: 500 }}
          tickLine={false}
          axisLine={false}
          width={isMobile && !isExpanded ? 28 : 50}
          tickCount={isMobile && !isExpanded ? 4 : 5}
          label={!isMobile || isExpanded ? { value: 'Complaints', angle: -90, position: 'insideLeft', fontSize: 11, fill: chartColors.axisLabel, fontWeight: 600 } : undefined}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: isMobile && !isExpanded ? 8 : 11, fill: chartColors.tickText, fontWeight: 500 }}
          tickLine={false}
          axisLine={false}
          width={isMobile && !isExpanded ? 32 : 50}
          tickCount={isMobile && !isExpanded ? 4 : 5}
          tickFormatter={(value) => `$${value}k`}
          label={!isMobile || isExpanded ? { value: 'BTC Price', angle: 90, position: 'insideRight', fontSize: 11, fill: chartColors.axisLabel, fontWeight: 600 } : undefined}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            border: '1px solid #374151',
            borderRadius: '8px',
          }}
          labelStyle={{ color: '#ffffff', fontWeight: 600 }}
          formatter={(value, name) => {
            if (name === 'Complaints') return [value.toLocaleString(), name];
            if (name === 'BTC Price') return [`$${(value * 1000).toLocaleString()}`, name];
            return [value, name];
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: isMobile && !isExpanded ? 9 : 12 }}
          iconSize={isMobile && !isExpanded ? 8 : 14}
        />

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

        {/* Event markers - hide on mobile compact view to prevent overlap */}
        {showEventMarkers && !isMobile && relevantEvents.map((event, i) => {
          const eventMonth = event.date.substring(0, 7);
          const dataPoint = chartData.find(d => d.month === eventMonth);
          if (!dataPoint) return null;

          const isHovered = hoveredEvent === event;
          const isDimmed = hoveredEvent && hoveredEvent !== event;

          return (
            <ReferenceLine
              key={i}
              x={dataPoint.label}
              yAxisId="left"
              stroke={getEventColor(event.type)}
              strokeDasharray={isHovered ? "0" : "3 3"}
              strokeWidth={isHovered ? 3 : (isExpanded ? 2 : 1)}
              strokeOpacity={isDimmed ? 0.15 : (isHovered ? 1 : 0.7)}
              ifOverflow="extendDomain"
              label={isDimmed ? null : <ClickableEventLabel event={event} color={getEventColor(event.type)} />}
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );

  // Event hover tooltip (compact version)
  const EventTooltip = ({ event }) => (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-xl z-50 pointer-events-none">
      <div className="flex items-start gap-2 mb-2">
        <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded flex-shrink-0 ${
          event.type === 'crash' ? 'bg-red-500/80 text-white' :
          event.type === 'positive' ? 'bg-green-500/80 text-white' :
          'bg-purple-500/80 text-white'
        }`}>
          {event.type === 'crash' ? 'Crash' : event.type === 'positive' ? 'Positive' : 'Regulatory'}
        </span>
        <span className="text-[10px] text-gray-400">{format(parseISO(event.date), 'MMM d, yyyy')}</span>
      </div>
      <h4 className="text-sm font-semibold mb-1">{event.event}</h4>
      <p className="text-xs text-gray-300 line-clamp-2 mb-2">{event.description}</p>
      <p className="text-[10px] text-gray-400 italic line-clamp-1">Impact: {event.impact}</p>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full">
        <div className="border-8 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
      </div>
    </div>
  );

  // Event detail modal (full version on click)
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
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Current BTC Price */}
            {currentPrice && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">BTC</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">${currentPrice.price?.toLocaleString()}</span>
              </div>
            )}
            {/* Correlation */}
            {correlation !== null && (
              <div className={`text-sm font-mono font-bold ${
                parseFloat(correlation) > 0 ? 'text-red-500' : 'text-green-500'
              }`}>
                r={correlation}
              </div>
            )}
            {/* Expand Button */}
            <button
              onClick={() => setIsExpanded(true)}
              className="hidden sm:flex p-1.5 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="Expand chart"
            >
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
        </div>

        <div className="relative h-48 sm:h-72 overflow-hidden">
          <ChartContent />
          {/* Floating tooltip when hovering chart markers */}
          {!isMobile && hoveredEvent && (
            <div className="absolute top-2 right-2 w-64 p-2.5 bg-gray-900/95 dark:bg-gray-800/95 text-white rounded-lg shadow-xl z-20 pointer-events-none">
              <div className="flex items-start gap-2 mb-1.5">
                <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded flex-shrink-0 ${
                  hoveredEvent.type === 'crash' ? 'bg-red-500/80 text-white' :
                  hoveredEvent.type === 'positive' ? 'bg-green-500/80 text-white' :
                  'bg-purple-500/80 text-white'
                }`}>
                  {hoveredEvent.type === 'crash' ? 'Crash' : hoveredEvent.type === 'positive' ? 'Positive' : 'Regulatory'}
                </span>
                <span className="text-[10px] text-gray-400">{format(parseISO(hoveredEvent.date), 'MMM d, yyyy')}</span>
              </div>
              <h4 className="text-xs font-semibold mb-1">{hoveredEvent.event}</h4>
              <p className="text-[10px] text-gray-300 line-clamp-2">{hoveredEvent.description}</p>
            </div>
          )}
        </div>

        {/* Clickable Event Tags - Desktop only, newest first, with hover interaction */}
        {!isMobile && (
          <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700/50">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 dark:text-gray-200 flex-shrink-0">Events:</span>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {[...relevantEvents].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8).map((event, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedEvent(event)}
                    onMouseEnter={() => handleEventHover(event)}
                    onMouseLeave={() => handleEventHover(null)}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded whitespace-nowrap flex-shrink-0 cursor-pointer transition-all ${
                      hoveredEvent === event
                        ? 'ring-2 ring-offset-1 ring-blue-500 scale-105'
                        : hoveredEvent ? 'opacity-50' : ''
                    } ${
                      event.type === 'crash'
                        ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                        : event.type === 'positive'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                        : 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400'
                    }`}
                  >
                    <span className="opacity-70">{format(parseISO(event.date), "MMM ''yy")}</span>
                    <span className="max-w-[120px] truncate">{event.event}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}

      {/* Expanded Chart Modal */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-3 py-2 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center z-10">
              <div>
                <h2 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">
                  BTC Price vs Complaint Volume
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  Expanded view
                  {currentPrice && (
                    <span className="ml-1 sm:ml-2">| BTC: <span className="font-medium">${currentPrice.price?.toLocaleString()}</span></span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1.5 sm:p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-2 sm:p-4">
              <div className="h-[60vh] sm:h-[50vh] landscape:h-[55vh]">
                <ChartContent showEventMarkers={true} />
              </div>

              {/* Interactive Event Legend - Show on all screens */}
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                    Chart Events ({relevantEvents.length})
                  </h3>
                  <div className="hidden sm:flex gap-3 text-xs">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 sm:gap-1.5 max-h-32 sm:max-h-48 overflow-y-auto">
                  {relevantEvents
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map((event, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedEvent(event)}
                      onMouseEnter={() => handleEventHover(event)}
                      onMouseLeave={() => handleEventHover(null)}
                      className={`p-1.5 sm:p-2 rounded text-left transition-all border ${
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
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getEventColor(event.type) }}
                        />
                        <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                          {format(parseISO(event.date), "MMM ''yy")}
                        </span>
                        <span className="text-[10px] sm:text-xs text-gray-800 dark:text-gray-200 truncate">
                          {event.event}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="hidden sm:block mt-2 text-xs text-gray-400 dark:text-gray-500">
                  Hover over an event to highlight its line on the chart. Click for details.
                </p>
              </div>

              {/* Correlation Analysis - Hidden on mobile */}
              {correlation !== null && (
                <div className="hidden sm:block mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
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
