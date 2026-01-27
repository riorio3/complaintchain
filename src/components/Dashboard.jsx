import { useState, useMemo } from 'react';
import { useComplaints } from '../hooks/useComplaints';
import {
  groupByMonth,
  groupByIssue,
  groupByCompany,
  calculateMetrics,
  getUniqueIssues,
  getUniqueCompanies,
} from '../utils/dataProcessing';
import { calculateFraudRate, getComplaintsWithNarratives } from '../utils/textAnalysis';
import { MetricCard } from './MetricCard';
import { TrendChart } from './TrendChart';
import { IssueBreakdown } from './IssueBreakdown';
import { CompanyComparison } from './CompanyComparison';
import { Filters } from './Filters';
import StateHeatmap from './StateHeatmap';
import { IssueInsights } from './IssueInsights';
import { PriceCorrelation } from './PriceCorrelation';
import { RegulatoryTimeline } from './RegulatoryTimeline';
import { ThemeToggle } from './ThemeToggle';

export function Dashboard() {
  const [filters, setFilters] = useState({});
  const { data, loading, error, lastUpdated, isLive, totalCount } = useComplaints(filters);

  // Process data for charts
  const trendData = useMemo(() => groupByMonth(data), [data]);
  const issueData = useMemo(() => groupByIssue(data), [data]);
  const companyData = useMemo(() => groupByCompany(data), [data]);
  const metrics = useMemo(() => calculateMetrics(data), [data]);
  const fraudRate = useMemo(() => calculateFraudRate(data), [data]);
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
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                ComplaintChain
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Crypto Complaint Intelligence by Rio Zelaya
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                {data.length.toLocaleString()} Complaints
              </span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
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
                subtitle="Mentions scam, hack, stolen"
              />
              <MetricCard
                title="With Narratives"
                value={narrativeData.length.toLocaleString()}
                subtitle="Consumer descriptions available"
              />
            </div>

            {/* Row 1: Price Correlation + State Heatmap */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <PriceCorrelation trendData={trendData} />
              <StateHeatmap
                data={data}
                selectedState={filters.state}
                onStateClick={handleStateClick}
              />
            </div>

            {/* Row 2: Issue Breakdown + Issue Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <IssueBreakdown data={issueData} rawData={data} />
              <IssueInsights data={data} />
            </div>

            {/* Row 3: Regulatory Timeline */}
            <div className="mb-6">
              <RegulatoryTimeline />
            </div>

            {/* Row 4: Company Comparison */}
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
                Built by Rio Zelaya
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
