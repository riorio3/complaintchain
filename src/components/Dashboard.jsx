import { useState, useMemo } from 'react';
import { useComplaints } from '../hooks/useComplaints';
import {
  groupByMonth,
  groupByCompany,
  calculateMetrics,
  getUniqueIssues,
  getUniqueCompanies,
} from '../utils/dataProcessing';
import { getComplaintsWithNarratives } from '../utils/textAnalysis';
import aiClassifications from '../data/classifications.json';
import { MetricCard } from './MetricCard';
import { TrendChart } from './TrendChart';
import { CompanyComparison } from './CompanyComparison';
import { Filters } from './Filters';
import StateHeatmap from './StateHeatmap';
import { IssueInsights } from './IssueInsights';
import { PriceCorrelation } from './PriceCorrelation';
import { RegulatoryTimeline } from './RegulatoryTimeline';
import { ThemeToggle } from './ThemeToggle';

export function Dashboard() {
  const [filters, setFilters] = useState({});
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [searchedComplaint, setSearchedComplaint] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const { data, loading, error, lastUpdated, isLive, totalCount } = useComplaints(filters);

  // Search for complaint by ID
  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchId.trim()) return;
    const found = data.find(c => String(c.complaint_id) === searchId.trim());
    if (found) {
      setSearchedComplaint(found);
      setSearchError(null);
    } else {
      setSearchError(`Complaint #${searchId} not found`);
      setSearchedComplaint(null);
    }
  };

  // Get most recent complaint date
  const latestDate = useMemo(() => {
    if (data.length === 0) return null;
    const dates = data.map(c => c.date_received).filter(Boolean).sort();
    return dates[dates.length - 1];
  }, [data]);

  // Group complaints by week for history view
  const weeklyHistory = useMemo(() => {
    const weeks = {};
    data.forEach(c => {
      if (!c.date_received) return;
      const date = new Date(c.date_received);
      // Get Monday of that week
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date.setDate(diff));
      const weekKey = monday.toISOString().slice(0, 10);
      weeks[weekKey] = (weeks[weekKey] || 0) + 1;
    });
    return Object.entries(weeks)
      .sort((a, b) => b[0].localeCompare(a[0]));
  }, [data]);

  // Process data for charts
  const trendData = useMemo(() => groupByMonth(data), [data]);
  const companyData = useMemo(() => groupByCompany(data), [data]);
  const metrics = useMemo(() => calculateMetrics(data), [data]);
  const fraudRate = useMemo(() => {
    if (!data || data.length === 0) return 0;
    const fraudCount = data.filter(c => aiClassifications[String(c.complaint_id)] === 'fraud').length;
    return Math.round((fraudCount / data.length) * 100);
  }, [data]);
  const narrativeData = useMemo(() => getComplaintsWithNarratives(data), [data]);

  // Get filter options from data
  const companies = useMemo(() => getUniqueCompanies(data), [data]);
  const issues = useMemo(() => getUniqueIssues(data), [data]);

  // Handle state filter from heatmap
  const handleStateClick = (state) => {
    setFilters(prev => ({
      ...prev,
      state: state,
    }));
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 dark:text-gray-300">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-base sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                ComplaintSignal
              </h1>
              <p className="text-[9px] sm:text-sm text-blue-600 dark:text-blue-400 font-medium">
                Crypto Complaint Intelligence
              </p>
              <p className="text-[8px] sm:text-xs text-gray-400 dark:text-gray-500">
                Built by Rio
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={() => setShowHistoryModal(true)}
                className="flex flex-col items-center px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors cursor-pointer"
              >
                <span className="font-semibold">{data.length.toLocaleString()} Complaints</span>
                {latestDate && (
                  <span className="text-[10px] font-normal text-blue-600 dark:text-blue-300 opacity-80">
                    {new Date(latestDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · weekly
                  </span>
                )}
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Complaint Search Bar */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-3 py-2 sm:px-6">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Search:</label>
            <input
              type="text"
              value={searchId}
              onChange={(e) => { setSearchId(e.target.value); setSearchError(null); }}
              placeholder="Complaint ID (e.g. 17918037)"
              className="flex-1 max-w-xs px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Find
            </button>
            {searchError && (
              <span className="text-xs text-red-500">{searchError}</span>
            )}
          </form>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-2 py-4 sm:px-6 sm:py-6 lg:px-8">
        {/* Filters */}
        <Filters
          filters={filters}
          setFilters={setFilters}
          companies={companies}
          issues={issues}
        />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-300">Loading complaints data...</span>
          </div>
        ) : (
          <>
            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <MetricCard
                title="Total Complaints"
                value={metrics.total.toLocaleString()}
                trend={metrics.trend}
                trendValue={metrics.trendPercent}
              />
              <MetricCard
                title="Timely Response Rate"
                value={`${metrics.timelyRate}%`}
                subtitle="Responses within 15 days"
              />
              <MetricCard
                title="Fraud-Related"
                value={`${fraudRate}%`}
                subtitle="Fraud-related complaints"
              />
              <MetricCard
                title="With Narratives"
                value={narrativeData.length.toLocaleString()}
                subtitle="Consumer descriptions available"
              />
            </div>

            {/* Hero: BTC Price Correlation (full width) */}
            <div className="mb-6">
              <PriceCorrelation trendData={trendData} />
            </div>

            {/* Row 1: State Heatmap + Issue Insights (equal height) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <StateHeatmap
                data={data}
                selectedState={filters.state}
                onStateClick={handleStateClick}
              />
              <IssueInsights data={data} />
            </div>

            {/* Row 2: Regulatory Timeline */}
            <div className="mb-6">
              <RegulatoryTimeline />
            </div>

            {/* Row 3: Company Comparison */}
            <CompanyComparison data={companyData} rawData={data} />

            {/* Footer */}
            <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
              <p>
                Data from{' '}
                <a
                  href="https://www.consumerfinance.gov/data-research/consumer-complaints/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  CFPB Consumer Complaint Database
                </a>
                {' | '}
                <a
                  href="https://www.coingecko.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  CoinGecko
                </a>
                {' | '}
                SEC, DOJ, CFTC
              </p>
              <p className="mt-1 text-xs">
                Data refreshes weekly • Covers Coinbase, Block, Robinhood, Kraken, Gemini & more
              </p>
              <p className="mt-2 text-xs font-medium">
                Built by Rio
              </p>
            </div>
          </>
        )}
      </main>

      {/* Weekly History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowHistoryModal(false); setHistoryExpanded(false); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Weekly Complaint History</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{weeklyHistory.length} weeks of data</p>
              </div>
              <button
                onClick={() => { setShowHistoryModal(false); setHistoryExpanded(false); }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-1">
                {(historyExpanded ? weeklyHistory : weeklyHistory.slice(0, 20)).map(([week, count]) => {
                  const maxCount = Math.max(...weeklyHistory.map(([, c]) => c));
                  const percentage = (count / maxCount) * 100;
                  return (
                    <div key={week} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">
                        {new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </span>
                      <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-900 dark:text-white w-10 text-right">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
              {weeklyHistory.length > 20 && (
                <button
                  onClick={() => setHistoryExpanded(!historyExpanded)}
                  className="w-full mt-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  {historyExpanded ? 'Show less' : `Show all (${weeklyHistory.length - 20} more weeks)`}
                </button>
              )}
            </div>
            <div className="p-4 border-t dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Total: {data.length.toLocaleString()} complaints
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Searched Complaint Modal */}
      {searchedComplaint && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSearchedComplaint(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-start sticky top-0 bg-white dark:bg-gray-800">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Complaint #{searchedComplaint.complaint_id}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {searchedComplaint.date_received && new Date(searchedComplaint.date_received).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => setSearchedComplaint(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Company</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{searchedComplaint.company || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Product</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{searchedComplaint.product || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Issue</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{searchedComplaint.issue || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">State</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{searchedComplaint.state || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Company Response</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{searchedComplaint.company_response || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Timely?</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{searchedComplaint.timely || 'N/A'}</p>
                </div>
              </div>
              {searchedComplaint.complaint_what_happened && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Consumer Narrative</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg max-h-64 overflow-y-auto">
                    {searchedComplaint.complaint_what_happened}
                  </p>
                </div>
              )}
            </div>
            <div className="p-4 border-t dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setSearchedComplaint(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
