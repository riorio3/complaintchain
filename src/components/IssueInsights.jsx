import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { detectFraudComplaints, getComplaintsWithNarratives } from '../utils/textAnalysis';

// Issue patterns with descriptions for QC analysts
const ISSUE_PATTERNS = [
  {
    id: 'locked_account',
    label: 'Account Access',
    keywords: ['locked', 'lock', 'access', 'login', 'disabled', 'restricted', 'suspended', 'frozen'],
    icon: '🔒',
    actionable: 'Review account verification and unlock procedures',
  },
  {
    id: 'verification',
    label: 'Verification Issues',
    keywords: ['verification', 'verify', 'kyc', 'identity', 'documents', 'id', 'selfie', 'photo'],
    icon: '📋',
    actionable: 'Streamline KYC process, improve document requirements clarity',
  },
  {
    id: 'withdrawal',
    label: 'Withdrawal Problems',
    keywords: ['withdraw', 'withdrawal', 'transfer', 'send', 'funds', 'money', 'bank'],
    icon: '💸',
    actionable: 'Review withdrawal processing times and limits',
  },
  {
    id: 'customer_service',
    label: 'Support Response',
    keywords: ['support', 'response', 'contact', 'help', 'waiting', 'ignored', 'no response', 'customer service', 'ticket'],
    icon: '📞',
    actionable: 'Improve response SLAs and ticket routing',
  },
  {
    id: 'fraud',
    label: 'Fraud/Scam Reports',
    keywords: ['scam', 'fraud', 'stolen', 'hacked', 'unauthorized', 'phishing', 'hack'],
    icon: '⚠️',
    actionable: 'Enhance fraud detection and recovery procedures',
  },
  {
    id: 'fees',
    label: 'Fee Disputes',
    keywords: ['fee', 'fees', 'charge', 'charged', 'cost', 'expensive', 'hidden'],
    icon: '💰',
    actionable: 'Improve fee transparency and disclosure',
  },
];

export function IssueInsights({ data, onFilterByKeyword }) {
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Analyze complaints for each pattern - now storing the actual matches
  const patternAnalysis = useMemo(() => {
    const narrativeComplaints = data.filter(c => c.complaint_what_happened?.length > 50);
    const total = narrativeComplaints.length;

    if (total === 0) return [];

    return ISSUE_PATTERNS.map(pattern => {
      const matches = narrativeComplaints.filter(c => {
        const text = c.complaint_what_happened.toLowerCase();
        return pattern.keywords.some(kw => text.includes(kw));
      });

      // Sort matches by date, newest first
      const sortedMatches = matches.sort((a, b) => {
        const dateA = a.date_received || '';
        const dateB = b.date_received || '';
        return dateB.localeCompare(dateA);
      });

      return {
        ...pattern,
        count: matches.length,
        percentage: Math.round((matches.length / total) * 100),
        complaints: sortedMatches, // Store actual complaints
      };
    }).sort((a, b) => b.count - a.count);
  }, [data]);

  // Calculate fraud stats
  const fraudStats = useMemo(() => {
    const fraudComplaints = detectFraudComplaints(data);
    return {
      count: fraudComplaints.length,
      percentage: data.length > 0 ? Math.round((fraudComplaints.length / data.length) * 100) : 0,
    };
  }, [data]);

  // Get total with narratives
  const narrativeCount = useMemo(() => getComplaintsWithNarratives(data).length, [data]);

  // Handle pattern click
  const handlePatternClick = (pattern) => {
    setSelectedPattern(pattern);
    setIsModalOpen(true);
  };

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Issue Insights
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          No data available
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Issue Pattern Analysis
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Based on {narrativeCount.toLocaleString()} of {data.length.toLocaleString()} complaints (with narratives)
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Click any category below to view individual complaints
          </p>
        </div>
        <div className="text-right">
          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
            fraudStats.percentage > 30
              ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
              : fraudStats.percentage > 15
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
              : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
          }`}>
            {fraudStats.percentage}% fraud-related
          </span>
        </div>
      </div>

      {/* Pattern Cards */}
      <div className="space-y-3">
        {patternAnalysis.slice(0, 5).map(pattern => (
          <div
            key={pattern.id}
            className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            onClick={() => handlePatternClick(pattern)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{pattern.icon}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {pattern.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  {pattern.count.toLocaleString()} mentions →
                </span>
                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                  pattern.percentage > 30
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                    : pattern.percentage > 15
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                }`}>
                  {pattern.percentage}%
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-2">
              <div
                className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(pattern.percentage, 100)}%` }}
              />
            </div>

            {/* Actionable insight */}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium">Action:</span> {pattern.actionable}
            </p>
          </div>
        ))}
      </div>

      {/* QC Insight Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium">Key Finding:</span>{' '}
          {patternAnalysis[0] && (
            <>
              {patternAnalysis[0].percentage}% of complaints mention {patternAnalysis[0].label.toLowerCase()} issues.
              {patternAnalysis[0].percentage > 25 && ' This represents a significant process improvement opportunity.'}
            </>
          )}
        </p>
      </div>

      {/* Drill-down Modal */}
      {isModalOpen && selectedPattern && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{selectedPattern.icon}</span>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedPattern.label}
                  </h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {selectedPattern.count} complaint{selectedPattern.count !== 1 ? 's' : ''} matching keywords: {selectedPattern.keywords.slice(0, 5).join(', ')}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  <span className="font-medium">Recommended Action:</span> {selectedPattern.actionable}
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
              {selectedPattern.complaints.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No complaints found</p>
              ) : (
                <div className="space-y-3">
                  {selectedPattern.complaints.map((complaint, index) => (
                    <NarrativeCard
                      key={complaint.complaint_id || index}
                      complaint={complaint}
                      index={index}
                      keywords={selectedPattern.keywords}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t dark:border-gray-700 flex justify-between items-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Showing all {selectedPattern.complaints.length} complaints with {selectedPattern.label.toLowerCase()} keywords
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

// Individual complaint card with narrative highlighting
function NarrativeCard({ complaint, index, keywords }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown date';
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  // Escape HTML entities to prevent XSS
  const escapeHtml = (str) => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Highlight matching keywords in narrative
  const highlightKeywords = (text) => {
    if (!text || !keywords) return escapeHtml(text);

    const escapedText = escapeHtml(text);
    const lowerText = escapedText.toLowerCase();

    // Find all keyword matches and their positions
    const matches = [];
    keywords.forEach(keyword => {
      let pos = lowerText.indexOf(keyword.toLowerCase());
      while (pos !== -1) {
        matches.push({ start: pos, end: pos + keyword.length });
        pos = lowerText.indexOf(keyword.toLowerCase(), pos + 1);
      }
    });

    // Sort by position and merge overlapping
    matches.sort((a, b) => a.start - b.start);

    if (matches.length === 0) return text;

    // Build highlighted string
    let result = [];
    let lastEnd = 0;
    matches.forEach(match => {
      if (match.start >= lastEnd) {
        result.push(escapedText.slice(lastEnd, match.start));
        result.push(`<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">${escapedText.slice(match.start, match.end)}</mark>`);
        lastEnd = match.end;
      }
    });
    result.push(escapedText.slice(lastEnd));

    return result.join('');
  };

  const narrative = complaint.complaint_what_happened || '';
  const previewLength = 200;
  const hasMoreContent = narrative.length > previewLength;

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
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
            {complaint.state || 'N/A'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatDate(complaint.date_received)}
          </span>
        </div>
      </div>

      {/* Issue & Sub-issue */}
      <div className="flex flex-wrap gap-2 mb-2">
        {complaint.issue && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300">
            {complaint.issue}
          </span>
        )}
        {complaint.sub_issue && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
            {complaint.sub_issue}
          </span>
        )}
      </div>

      {/* Company Response */}
      {complaint.company_response && (
        <div className="flex items-center gap-2 mb-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            complaint.company_response.toLowerCase().includes('relief')
              ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300'
              : complaint.company_response.toLowerCase().includes('closed')
              ? 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-300'
              : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300'
          }`}>
            {complaint.company_response}
          </span>
          {complaint.timely === 'Yes' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300">
              Timely
            </span>
          )}
          {complaint.consumer_disputed === 'Yes' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300">
              Disputed
            </span>
          )}
        </div>
      )}

      {/* Narrative with keyword highlighting */}
      <div className="mt-2 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
        <p
          className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap"
          dangerouslySetInnerHTML={{
            __html: highlightKeywords(
              isExpanded ? narrative : narrative.slice(0, previewLength) + (hasMoreContent ? '...' : '')
            )
          }}
        />
        {hasMoreContent && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            {isExpanded ? 'Show less' : 'Read full narrative →'}
          </button>
        )}
      </div>

      {/* Complaint ID */}
      {complaint.complaint_id && (
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          ID: {complaint.complaint_id}
        </p>
      )}
    </div>
  );
}
