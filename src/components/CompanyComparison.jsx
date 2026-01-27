import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';

// Fraud keywords for detection
const FRAUD_KEYWORDS = ['scam', 'fraud', 'stolen', 'hacked', 'unauthorized', 'phishing'];

export function CompanyComparison({ data, rawData = [] }) {
  const [sortBy, setSortBy] = useState('total');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showAll, setShowAll] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);

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
        dateRange,
        complaints: companyComplaints,
      };
    });
  }, [data, rawData]);

  // Sort data
  const sortedData = useMemo(() => {
    return [...enhancedData].sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
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
    if (sortBy !== column) return <span className="text-gray-300 dark:text-gray-600 ml-1">↕</span>;
    return <span className="text-blue-500 ml-1">{sortOrder === 'desc' ? '↓' : '↑'}</span>;
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
          {sortedData.length} cos
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                onClick={() => handleSort('company')}
              >
                Company <SortIcon column="company" />
              </th>
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                onClick={() => handleSort('total')}
              >
                Complaints <SortIcon column="total" />
              </th>
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                onClick={() => handleSort('timelyRate')}
              >
                Timely % <SortIcon column="timelyRate" />
              </th>
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                onClick={() => handleSort('disputeRate')}
              >
                Disputed % <SortIcon column="disputeRate" />
              </th>
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                onClick={() => handleSort('fraudRate')}
              >
                Fraud % <SortIcon column="fraudRate" />
              </th>
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                onClick={() => handleSort('reliefRate')}
              >
                Relief % <SortIcon column="reliefRate" />
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                30d Trend
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
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-5">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[180px]">
                      {company.company}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 text-sm text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min((company.total / sortedData[0].total) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-gray-700 dark:text-gray-300 w-12 text-right">
                      {company.total.toLocaleString()}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 text-sm text-right">
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
                <td className="px-3 py-3 text-sm text-right">
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
                <td className="px-3 py-3 text-sm text-right">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full ${
                    company.fraudRate <= 15
                      ? 'bg-emerald-600 text-white'
                      : company.fraudRate <= 30
                      ? 'bg-amber-500 text-white'
                      : 'bg-red-600 text-white'
                  }`}>
                    {company.fraudRate}%
                  </span>
                </td>
                <td className="px-3 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                  {company.reliefRate}%
                </td>
                <td className="px-3 py-3 text-sm text-right">
                  {company.trend === 'up' ? (
                    <span className="text-red-600 dark:text-red-400 font-semibold">↑ {company.trendPercent}%</span>
                  ) : company.trend === 'down' ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">↓ {company.trendPercent}%</span>
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

      {/* Company Detail Modal */}
      {selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedCompany(null)}>
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
                  onClick={() => setSelectedCompany(null)}
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
                  {selectedCompany.trend === 'up' ? (
                    <>
                      <span className="text-red-600 dark:text-red-400 text-lg font-bold">↑ {selectedCompany.trendPercent}%</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">increase in complaints</span>
                    </>
                  ) : selectedCompany.trend === 'down' ? (
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
                  Recent Complaints ({Math.min(5, selectedCompany.complaints?.length || 0)} of {selectedCompany.complaints?.length || 0})
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selectedCompany.complaints?.slice(0, 5).map((complaint, i) => (
                    <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-sm">
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
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
