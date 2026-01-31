import { useState, useMemo, useRef } from 'react';
import { format, parseISO } from 'date-fns';

// Colors for bars
const COLORS = ['#1d4ed8', '#2563eb', '#3b82f6', '#0369a1', '#0891b2', '#0d9488', '#059669'];

// Fraud keywords for detection (matches textAnalysis.js)
const FRAUD_KEYWORDS = [
  'scam', 'scammed', 'scammer',
  'fraud', 'fraudulent', 'defrauded',
  'stolen', 'stole', 'stealing', 'theft',
  'hacked', 'hack', 'hacker', 'hacking',
  'unauthorized', 'unauthorised',
  'phishing', 'phished',
  'fake', 'impersonator', 'impersonation',
  'identity theft', 'criminals', 'criminal',
  'compromised', 'breached'
];

export function CompanyComparison({ data, rawData = [] }) {
  const [sortBy, setSortBy] = useState('total');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showAll, setShowAll] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showAllComplaints, setShowAllComplaints] = useState(false);
  const [showReliefTooltip, setShowReliefTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const reliefBtnRef = useRef(null);

  // Enhanced data with fraud rate and trends
  const enhancedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map(company => {
      // Get complaints for this company
      const companyComplaints = rawData.filter(c => c.company === company.company);

      // Calculate fraud rate
      const fraudCount = companyComplaints.filter(c => {
        const narrative = (c.complaint_what_happened || '').toLowerCase();
        const issue = (c.issue || '').toLowerCase();
        return FRAUD_KEYWORDS.some(kw => narrative.includes(kw) || issue.includes(kw));
      }).length;
      const fraudRate = companyComplaints.length > 0
        ? Math.round((fraudCount / companyComplaints.length) * 100)
        : 0;

      // Calculate 30-day trend
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const recentCount = companyComplaints.filter(c => {
        const date = new Date(c.date_received);
        return date >= thirtyDaysAgo;
      }).length;

      const previousCount = companyComplaints.filter(c => {
        const date = new Date(c.date_received);
        return date >= sixtyDaysAgo && date < thirtyDaysAgo;
      }).length;

      let trend = 'neutral';
      let trendPercent = 0;
      if (previousCount > 0) {
        trendPercent = Math.round(((recentCount - previousCount) / previousCount) * 100);
        trend = trendPercent > 5 ? 'up' : trendPercent < -5 ? 'down' : 'neutral';
      }

      // Get date range
      const dates = companyComplaints
        .map(c => c.date_received)
        .filter(Boolean)
        .sort();
      const dateRange = dates.length > 0
        ? { oldest: dates[0], newest: dates[dates.length - 1] }
        : null;

      return {
        ...company,
        fraudRate,
        trend,
        trendPercent: Math.abs(trendPercent),
        recentCount,
        previousCount,
        dateRange,
        complaints: companyComplaints,
      };
    });
  }, [data, rawData]);

  // Sort data
  const sortedData = useMemo(() => {
    return [...enhancedData].sort((a, b) => {
      const aVal = a[sortBy] ?? 0;
      const bVal = b[sortBy] ?? 0;
      // Handle string comparison (company names) vs numeric comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'desc'
          ? bVal.localeCompare(aVal)
          : aVal.localeCompare(bVal);
      }
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [enhancedData, sortBy, sortOrder]);

  // Visible companies
  const visibleCompanies = showAll ? sortedData : sortedData.slice(0, 8);

  // Handle sort
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Sort indicator
  const SortIcon = ({ column }) => {
    if (sortBy !== column) {
      return (
        <svg className="w-3.5 h-3.5 ml-1 text-gray-300 dark:text-gray-600 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortOrder === 'desc' ? (
      <svg className="w-3.5 h-3.5 ml-1 text-blue-500 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    ) : (
      <svg className="w-3.5 h-3.5 ml-1 text-blue-500 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    );
  };

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Company Comparison</h3>
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
      <div className="flex justify-between items-start mb-3 sm:mb-4">
        <div>
          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Company Comparison</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Tap row for details <span className="hidden sm:inline">• Tap headers to sort</span>
          </p>
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {sortedData.length} companies
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th
                className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                onClick={() => handleSort('company')}
              >
                <span className="hidden sm:inline">Company</span>
                <span className="sm:hidden">Co.</span>
                <SortIcon column="company" />
              </th>
              <th
                className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                onClick={() => handleSort('total')}
              >
                <span className="hidden sm:inline">Complaints</span>
                <span className="sm:hidden">#</span>
                <SortIcon column="total" />
              </th>
              <th
                className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap"
                onClick={() => handleSort('timelyRate')}
              >
                Timely % <SortIcon column="timelyRate" />
              </th>
              <th
                className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap"
                onClick={() => handleSort('disputeRate')}
              >
                Disputed % <SortIcon column="disputeRate" />
              </th>
              <th
                className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                onClick={() => handleSort('fraudRate')}
              >
                <span className="hidden sm:inline">Fraud %</span>
                <span className="sm:hidden">Fraud</span>
                <SortIcon column="fraudRate" />
              </th>
              <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                <span
                  className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => handleSort('reliefRate')}
                >
                  Relief % <SortIcon column="reliefRate" />
                </span>
                <button
                  type="button"
                  ref={reliefBtnRef}
                  className="ml-1 align-middle"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!showReliefTooltip && reliefBtnRef.current) {
                      const rect = reliefBtnRef.current.getBoundingClientRect();
                      setTooltipPos({ top: rect.top - 8, left: rect.left - 160 });
                    }
                    setShowReliefTooltip(!showReliefTooltip);
                  }}
                  onMouseEnter={() => {
                    if (reliefBtnRef.current) {
                      const rect = reliefBtnRef.current.getBoundingClientRect();
                      setTooltipPos({ top: rect.top - 8, left: rect.left - 160 });
                    }
                    setShowReliefTooltip(true);
                  }}
                  onMouseLeave={() => setShowReliefTooltip(false)}
                >
                  <svg className="w-3.5 h-3.5 text-gray-400 hover:text-blue-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </th>
              <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <span className="hidden sm:inline">30d Trend</span>
                <span className="sm:hidden">Trend</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {visibleCompanies.map((company, index) => (
              <tr
                key={company.company}
                onClick={() => setSelectedCompany(company)}
                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
              >
                <td className="px-2 sm:px-3 py-2 sm:py-3">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-4 sm:w-5">
                      {index + 1}
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate max-w-[100px] sm:max-w-[180px]">
                      {company.company}
                    </span>
                  </div>
                </td>
                <td className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-right">
                  <div className="flex items-center justify-end gap-1 sm:gap-2">
                    <div className="hidden sm:block w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min((company.total / sortedData[0].total) * 100, 100)}%`,
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      />
                    </div>
                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 w-8 sm:w-12 text-right">
                      {company.total.toLocaleString()}
                    </span>
                  </div>
                </td>
                <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right whitespace-nowrap">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${
                    company.timelyRate >= 90
                      ? 'bg-emerald-600 text-white'
                      : company.timelyRate >= 70
                      ? 'bg-amber-500 text-white'
                      : 'bg-red-600 text-white'
                  }`}>
                    {company.timelyRate}%
                  </span>
                </td>
                <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right whitespace-nowrap">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${
                    company.disputeRate <= 10
                      ? 'bg-emerald-600 text-white'
                      : company.disputeRate <= 25
                      ? 'bg-amber-500 text-white'
                      : 'bg-red-600 text-white'
                  }`}>
                    {company.disputeRate}%
                  </span>
                </td>
                <td className="px-2 sm:px-3 py-2 sm:py-3 text-sm text-right">
                  <span className={`inline-flex px-1.5 sm:px-2 py-0.5 text-xs font-bold rounded-full ${
                    company.fraudRate <= 15
                      ? 'bg-emerald-600 text-white'
                      : company.fraudRate <= 30
                      ? 'bg-amber-500 text-white'
                      : 'bg-red-600 text-white'
                  }`}>
                    {company.fraudRate}%
                  </span>
                </td>
                <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {company.reliefRate}%
                </td>
                <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right">
                  {company.trend === 'up' && company.recentCount >= 3 ? (
                    <span className="text-red-600 dark:text-red-400 font-semibold">↑{company.trendPercent}%</span>
                  ) : company.trend === 'down' && company.recentCount + (company.previousCount || 0) >= 3 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">↓{company.trendPercent}%</span>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Show more/less button */}
      {sortedData.length > 8 && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-blue-500 hover:text-blue-400 transition-colors"
          >
            {showAll ? `Show less` : `Show all ${sortedData.length} companies`}
          </button>
        </div>
      )}

      {/* Relief % Tooltip */}
      {showReliefTooltip && (
        <div
          className="fixed z-[100] w-52 p-3 text-xs font-normal text-left bg-gray-900 text-white rounded-lg shadow-lg pointer-events-none transform -translate-y-full"
          style={{
            top: tooltipPos.top,
            left: Math.max(8, Math.min(tooltipPos.left, window.innerWidth - 220)),
          }}
        >
          % of complaints where company provided monetary or non-monetary relief. Most are "Closed with explanation" (no relief). Only ~9% result in actual relief.
          <div className="absolute top-full right-4 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-gray-900" />
        </div>
      )}

      {/* Company Detail Modal */}
      {selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setSelectedCompany(null); setShowAllComplaints(false); }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedCompany.company}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {selectedCompany.total.toLocaleString()} total complaints
                    {selectedCompany.dateRange && (
                      <span className="ml-2">
                        • {format(parseISO(selectedCompany.dateRange.oldest), 'MMM yyyy')} - {format(parseISO(selectedCompany.dateRange.newest), 'MMM yyyy')}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => { setSelectedCompany(null); setShowAllComplaints(false); }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{selectedCompany.timelyRate}%</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Timely Response</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{selectedCompany.disputeRate}%</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Disputed</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{selectedCompany.fraudRate}%</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Fraud-Related</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{selectedCompany.reliefRate}%</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Relief Provided</div>
                </div>
              </div>

              {/* Trend */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">30-Day Trend</div>
                <div className="flex items-center gap-2">
                  {selectedCompany.trend === 'up' && selectedCompany.recentCount >= 3 ? (
                    <>
                      <span className="text-red-600 dark:text-red-400 text-lg font-bold">↑ {selectedCompany.trendPercent}%</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">increase in complaints</span>
                    </>
                  ) : selectedCompany.trend === 'down' && selectedCompany.recentCount + (selectedCompany.previousCount || 0) >= 3 ? (
                    <>
                      <span className="text-emerald-600 dark:text-emerald-400 text-lg font-bold">↓ {selectedCompany.trendPercent}%</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">decrease in complaints</span>
                    </>
                  ) : (
                    <span className="text-gray-600 dark:text-gray-400">No significant change ({selectedCompany.recentCount} complaints in last 30 days)</span>
                  )}
                </div>
              </div>

              {/* Recent Complaints Preview */}
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Recent Complaints ({selectedCompany.complaints?.length || 0})
                </div>
                <div className={`space-y-2 overflow-y-auto ${showAllComplaints ? 'max-h-96' : 'max-h-64'}`}>
                  {(showAllComplaints ? selectedCompany.complaints : selectedCompany.complaints?.slice(0, 5))?.map((complaint, i) => (
                    <div
                      key={i}
                      className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => setSelectedComplaint(complaint)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-gray-900 dark:text-white">{complaint.issue}</span>
                        <span className="text-xs text-gray-400">{complaint.date_received?.slice(0, 10)}</span>
                      </div>
                      {complaint.sub_issue && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{complaint.sub_issue}</div>
                      )}
                      {complaint.company_response && (
                        <div className="mt-1">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                            complaint.company_response.toLowerCase().includes('relief')
                              ? 'bg-emerald-600 text-white'
                              : 'bg-gray-500 text-white'
                          }`}>
                            {complaint.company_response}
                          </span>
                        </div>
                      )}
                      <div className="text-xs text-blue-500 dark:text-blue-400 mt-1">Click to view details →</div>
                    </div>
                  ))}
                </div>
                {selectedCompany.complaints?.length > 5 && (
                  <button
                    onClick={() => setShowAllComplaints(!showAllComplaints)}
                    className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                  >
                    {showAllComplaints ? 'Show less' : `Show all ${selectedCompany.complaints.length} complaints`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complaint Detail Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-start sticky top-0 bg-white dark:bg-gray-800">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Complaint Details
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedComplaint.company} • {selectedComplaint.date_received?.slice(0, 10)}
                </p>
              </div>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Issue & Sub-issue */}
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Issue</div>
                <div className="text-gray-900 dark:text-white font-medium">{selectedComplaint.issue}</div>
                {selectedComplaint.sub_issue && (
                  <div className="text-gray-600 dark:text-gray-300 text-sm mt-1">{selectedComplaint.sub_issue}</div>
                )}
              </div>

              {/* Product & Sub-product */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Product</div>
                  <div className="text-gray-900 dark:text-white">{selectedComplaint.product || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Sub-product</div>
                  <div className="text-gray-900 dark:text-white">{selectedComplaint.sub_product || 'N/A'}</div>
                </div>
              </div>

              {/* State & Submitted via */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">State</div>
                  <div className="text-gray-900 dark:text-white">{selectedComplaint.state || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Submitted via</div>
                  <div className="text-gray-900 dark:text-white">{selectedComplaint.submitted_via || 'N/A'}</div>
                </div>
              </div>

              {/* Response Status */}
              <div className="flex flex-wrap gap-2">
                {selectedComplaint.company_response && (
                  <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                    selectedComplaint.company_response.toLowerCase().includes('relief')
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}>
                    {selectedComplaint.company_response}
                  </span>
                )}
                {selectedComplaint.timely === 'Yes' && (
                  <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Timely Response
                  </span>
                )}
                {selectedComplaint.consumer_disputed === 'Yes' && (
                  <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                    Consumer Disputed
                  </span>
                )}
              </div>

              {/* Narrative */}
              {selectedComplaint.complaint_what_happened && (
                <div>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Consumer Narrative</div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {selectedComplaint.complaint_what_happened}
                  </div>
                </div>
              )}

              {/* Complaint ID */}
              {selectedComplaint.complaint_id && (
                <div className="text-xs text-gray-400 dark:text-gray-500 pt-2 border-t dark:border-gray-700">
                  Complaint ID: {selectedComplaint.complaint_id}
                </div>
              )}
            </div>

            <div className="p-4 border-t dark:border-gray-700">
              <button
                onClick={() => setSelectedComplaint(null)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
