import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { format, parseISO } from 'date-fns';

const COLORS = ['#1d4ed8', '#2563eb', '#3b82f6', '#0369a1', '#0891b2', '#0d9488', '#059669'];

export function IssueBreakdown({ data, rawData = [] }) {
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Issues by Category</h3>
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data available</p>
      </div>
    );
  }

  // Take top 7 issues
  const topIssues = data.slice(0, 7);

  // Get complaints for a specific issue, sorted newest first
  const getComplaintsForIssue = (issue) => {
    return rawData
      .filter(c => c.issue === issue)
      .sort((a, b) => {
        const dateA = a.date_received || '';
        const dateB = b.date_received || '';
        return dateB.localeCompare(dateA); // Descending (newest first)
      });
  };

  // Handle bar click
  const handleBarClick = (data) => {
    if (data && data.issue) {
      setSelectedIssue(data.issue);
      setIsModalOpen(true);
    }
  };

  // Get selected complaints
  const selectedComplaints = selectedIssue ? getComplaintsForIssue(selectedIssue) : [];

  // Get date range for display
  const getDateRange = () => {
    if (rawData.length === 0) return '';
    const dates = rawData
      .map(c => c.date_received)
      .filter(Boolean)
      .sort();
    if (dates.length === 0) return '';
    const start = format(parseISO(dates[0]), 'MMM yyyy');
    const end = format(parseISO(dates[dates.length - 1]), 'MMM yyyy');
    return `${start} - ${end}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Top Issues by Category</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Tap to see complaints {getDateRange() && <span className="hidden sm:inline">• {getDateRange()}</span>}
          </p>
        </div>
      </div>

      {/* Issue list with bars */}
      <div className="space-y-2">
        {topIssues.map((item, index) => {
          const maxCount = topIssues[0]?.count || 1;
          const percentage = (item.count / maxCount) * 100;

          return (
            <button
              key={item.issue}
              onClick={() => handleBarClick(item)}
              className="w-full group active:bg-gray-100 dark:active:bg-gray-700 rounded-lg p-1 -m-1 transition-colors"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Color indicator */}
                <div
                  className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                {/* Issue name */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {item.issue}
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white flex-shrink-0">
                      {item.count.toLocaleString()}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-1 h-1.5 sm:h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300 group-hover:opacity-80"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Drill-down Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedIssue}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {selectedComplaints.length} complaint{selectedComplaints.length !== 1 ? 's' : ''} total
                  {getDateRange() && ` • ${getDateRange()}`}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body - Scrollable List */}
            <div className="flex-1 overflow-y-auto p-4">
              {selectedComplaints.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No complaints found</p>
              ) : (
                <div className="space-y-3">
                  {selectedComplaints.map((complaint, index) => (
                    <ComplaintCard key={complaint.complaint_id || index} complaint={complaint} index={index} />
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t dark:border-gray-700 flex justify-between items-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Showing all {selectedComplaints.length} complaints
              </p>
              <button
                onClick={() => setIsModalOpen(false)}
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

// Individual complaint card component
function ComplaintCard({ complaint, index }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown date';
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const hasNarrative = complaint.complaint_what_happened &&
    complaint.complaint_what_happened.trim().length > 0;

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
            #{index + 1}
          </span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {complaint.company || 'Unknown Company'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-600 text-white">
            {complaint.state || 'N/A'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatDate(complaint.date_received)}
          </span>
        </div>
      </div>

      {/* Sub-issue */}
      {complaint.sub_issue && (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Sub-issue:</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-purple-600 text-white">
            {complaint.sub_issue}
          </span>
        </div>
      )}

      {/* Company Response */}
      {complaint.company_response && (
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
            complaint.company_response.toLowerCase().includes('relief')
              ? 'bg-emerald-600 text-white'
              : complaint.company_response.toLowerCase().includes('closed')
              ? 'bg-slate-600 text-white'
              : 'bg-amber-500 text-white'
          }`}>
            {complaint.company_response}
          </span>
          {complaint.timely === 'Yes' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-600 text-white">
              Timely Response
            </span>
          )}
          {complaint.consumer_disputed === 'Yes' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
              Consumer Disputed
            </span>
          )}
        </div>
      )}

      {/* Narrative (expandable) */}
      {hasNarrative && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {isExpanded ? 'Hide' : 'Show'} Consumer Narrative
          </button>
          {isExpanded && (
            <div className="mt-2 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                {complaint.complaint_what_happened}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Complaint ID */}
      {complaint.complaint_id && (
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          ID: {complaint.complaint_id}
        </p>
      )}
    </div>
  );
}
