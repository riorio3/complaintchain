import { useMemo, useState } from 'react';
import { useRegulatoryNews } from '../hooks/useRegulatoryNews';
import regulatoryActions from '../data/regulatoryActions.json';

const AGENCY_COLORS = {
  SEC: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  DOJ: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  CFTC: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  NYAG: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  FTC: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  CFPB: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  OFAC: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  NEWS: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
};

export function RegulatoryTimeline() {
  const [selectedAgency, setSelectedAgency] = useState('all');
  const [showLive, setShowLive] = useState(true);

  // Fetch live news with 60-second refresh
  const { news: liveNews, loading, lastUpdated } = useRegulatoryNews(60000);

  // Get unique agencies from both sources
  const agencies = useMemo(() => {
    const agencySet = new Set([
      ...regulatoryActions.map(a => a.agency),
      ...liveNews.map(n => n.agency)
    ]);
    return ['all', ...Array.from(agencySet).sort()];
  }, [liveNews]);

  // Combine and filter actions
  const displayItems = useMemo(() => {
    const items = showLive && liveNews.length > 0
      ? liveNews.map(item => ({
          date: item.date,
          agency: item.agency,
          target: item.title.slice(0, 50),
          description: item.description,
          url: item.url,
          isLive: true,
        }))
      : regulatoryActions.map(item => ({ ...item, isLive: false }));

    return items
      .filter(item => selectedAgency === 'all' || item.agency === selectedAgency)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [showLive, liveNews, selectedAgency]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-4">
        <div>
          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
            Regulatory Actions
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
            {showLive ? 'Live SEC + crypto regulatory news' : 'Major enforcement'}
            {lastUpdated && showLive && (
              <span className="ml-1 sm:ml-2 text-xs">
                ({formatTime(lastUpdated)})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Live/Archive Toggle */}
          <button
            onClick={() => setShowLive(!showLive)}
            className={`px-2 sm:px-3 py-1 text-xs rounded-full transition-colors ${
              showLive
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {showLive ? '● Live' : 'Archive'}
          </button>
          <select
            value={selectedAgency}
            onChange={(e) => setSelectedAgency(e.target.value)}
            className="text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md px-1 sm:px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {agencies.map(agency => (
              <option key={agency} value={agency}>
                {agency === 'all' ? 'All' : agency}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && showLive && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">Fetching latest news...</span>
        </div>
      )}

      {/* News Items */}
      <div className="space-y-2 sm:space-y-3 max-h-64 sm:max-h-80 overflow-y-auto">
        {displayItems.length === 0 ? (
          <p className="text-center text-gray-600 dark:text-gray-300 py-6 sm:py-8 text-sm">
            {showLive ? 'No crypto regulatory news found' : 'No actions found'}
          </p>
        ) : (
          displayItems.map((item, index) => (
            <div
              key={`${item.date}-${index}`}
              className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
            >
              <div className="flex-shrink-0 w-16 sm:w-20 text-xs font-medium text-gray-700 dark:text-gray-200 pt-0.5 sm:pt-1">
                {formatDate(item.date)}
                {item.isLive && (
                  <span className="block text-green-600 dark:text-green-400 mt-1">● Live</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${AGENCY_COLORS[item.agency] || 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200'}`}>
                    {item.agency}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white truncate">
                    {item.target}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                  {item.description}
                </p>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                  >
                    View source →
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Agency Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-2">
          {Object.keys(AGENCY_COLORS).map(agency => (
            <button
              key={agency}
              onClick={() => setSelectedAgency(selectedAgency === agency ? 'all' : agency)}
              className={`inline-flex px-2 py-1 text-xs rounded transition-opacity ${AGENCY_COLORS[agency]} ${
                selectedAgency !== 'all' && selectedAgency !== agency ? 'opacity-50' : ''
              }`}
            >
              {agency}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
