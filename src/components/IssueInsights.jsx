import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { getComplaintsWithNarratives } from '../utils/textAnalysis';

// SVG Icon components
const LockIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const ClipboardIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
  </svg>
);

const ArrowUpTrayIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

const ChatBubbleIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
  </svg>
);

const ExclamationTriangleIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

const CurrencyDollarIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const DocumentTextIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

// Issue patterns with descriptions for QC analysts
// Keywords are ordered by specificity - more specific phrases first
const ISSUE_PATTERNS = [
  {
    id: 'locked_account',
    label: 'Account Access',
    keywords: [
      'locked', 'locked out', 'lock',
      'suspended', 'suspension',
      'frozen', 'freeze',
      'disabled', 'deactivated',
      'restricted', 'restriction',
      'blocked', 'closed my account',
      'cant login', 'cannot login', 'login issue',
      'access denied', 'no access'
    ],
    Icon: LockIcon,
    actionable: 'Review account verification and unlock procedures',
    color: 'blue',
    barClass: 'bg-blue-500',
    textClass: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'verification',
    label: 'Verification Issues',
    keywords: [
      'verification', 'verify', 'verified',
      'kyc', 'know your customer',
      'identity', 'id verification',
      'documents', 'document', 'documentation',
      'selfie', 'photo id', 'drivers license', 'passport',
      'proof of address', 'utility bill',
      'ssn', 'social security',
      'rejected', 'failed verification'
    ],
    Icon: ClipboardIcon,
    actionable: 'Streamline KYC process, improve document requirements clarity',
    color: 'purple',
    barClass: 'bg-purple-500',
    textClass: 'text-purple-600 dark:text-purple-400',
  },
  {
    id: 'withdrawal',
    label: 'Withdrawal Problems',
    keywords: [
      'withdraw', 'withdrawal', 'withdrawing',
      'transfer out', 'send out',
      'cash out', 'cashing out',
      'ach', 'wire transfer', 'bank transfer',
      'pending withdrawal', 'stuck', 'processing',
      'cant get my money', 'wont release',
      'holding my funds', 'held hostage'
    ],
    Icon: ArrowUpTrayIcon,
    actionable: 'Review withdrawal processing times and limits',
    color: 'emerald',
    barClass: 'bg-emerald-500',
    textClass: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'customer_service',
    label: 'Support Response',
    keywords: [
      'support', 'customer support', 'customer service',
      'no response', 'not responding', 'never responded',
      'waiting', 'waited', 'still waiting',
      'ignored', 'ignoring',
      'ticket', 'case number', 'reference number',
      'cant reach', 'no one', 'nobody',
      'unhelpful', 'useless', 'runaround',
      'automated', 'bot', 'generic response'
    ],
    Icon: ChatBubbleIcon,
    actionable: 'Improve response SLAs and ticket routing',
    color: 'amber',
    barClass: 'bg-amber-500',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'fraud',
    label: 'Fraud/Scam Reports',
    keywords: [
      'scam', 'scammed', 'scammer',
      'fraud', 'fraudulent', 'defrauded',
      'stolen', 'stole', 'stealing', 'theft',
      'hacked', 'hack', 'hacker', 'hacking',
      'unauthorized', 'unauthorised',
      'phishing', 'phished',
      'fake', 'impersonator', 'impersonation',
      'identity theft', 'criminals', 'criminal',
      'compromised', 'breached',
      'someone accessed', 'not me', 'didnt authorize'
    ],
    Icon: ExclamationTriangleIcon,
    actionable: 'Enhance fraud detection and recovery procedures',
    color: 'red',
    barClass: 'bg-red-500',
    textClass: 'text-red-600 dark:text-red-400',
  },
  {
    id: 'fees',
    label: 'Fee Disputes',
    keywords: [
      'fee', 'fees',
      'charge', 'charged', 'charges',
      'cost', 'costs',
      'expensive', 'overcharged',
      'hidden', 'hidden fees', 'undisclosed',
      'commission', 'spread',
      'converted', 'conversion fee',
      'unexpected charge', 'surprise fee'
    ],
    Icon: CurrencyDollarIcon,
    actionable: 'Improve fee transparency and disclosure',
    color: 'teal',
    barClass: 'bg-teal-500',
    textClass: 'text-teal-600 dark:text-teal-400',
  },
  {
    id: 'other',
    label: 'Other Issues',
    keywords: [],
    Icon: DocumentTextIcon,
    actionable: 'Review for emerging issue patterns',
    color: 'gray',
    barClass: 'bg-gray-400',
    textClass: 'text-gray-600 dark:text-gray-400',
  },
];

export function IssueInsights({ data, onFilterByKeyword }) {
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);

  // Analyze complaints for each pattern with 30-day trend (exclusive categorization)
  const patternAnalysis = useMemo(() => {
    const narrativeComplaints = data.filter(c => c.complaint_what_happened?.length > 50);
    const total = narrativeComplaints.length;

    if (total === 0) return [];

    // Calculate date thresholds for trend analysis
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Step 1: Assign each complaint to exactly ONE category (highest keyword match count)
    const categorizedComplaints = new Map();
    ISSUE_PATTERNS.forEach(p => categorizedComplaints.set(p.id, []));

    narrativeComplaints.forEach(complaint => {
      const text = complaint.complaint_what_happened.toLowerCase();

      let bestPatternId = 'other';
      let bestScore = 0;

      // Find category with most keyword matches (excluding 'other' which has no keywords)
      ISSUE_PATTERNS.forEach(pattern => {
        if (pattern.id === 'other') return;
        const score = pattern.keywords.filter(kw => text.includes(kw)).length;
        if (score > bestScore) {
          bestScore = score;
          bestPatternId = pattern.id;
        }
      });

      categorizedComplaints.get(bestPatternId).push(complaint);
    });

    // Step 2: Build pattern analysis from categorized complaints
    return ISSUE_PATTERNS.map(pattern => {
      const matches = categorizedComplaints.get(pattern.id) || [];

      // Calculate trend: last 30 days vs previous 30 days
      const recentMatches = matches.filter(c => {
        const date = new Date(c.date_received);
        return date >= thirtyDaysAgo;
      }).length;

      const previousMatches = matches.filter(c => {
        const date = new Date(c.date_received);
        return date >= sixtyDaysAgo && date < thirtyDaysAgo;
      }).length;

      let trendPercent = 0;
      let trend = 'neutral';
      if (previousMatches > 0) {
        trendPercent = Math.round(((recentMatches - previousMatches) / previousMatches) * 100);
        trend = trendPercent > 0 ? 'up' : trendPercent < 0 ? 'down' : 'neutral';
      } else if (recentMatches > 0) {
        trend = 'up';
        trendPercent = 100;
      }

      // Sort matches by date, newest first
      const sortedMatches = [...matches].sort((a, b) => {
        const dateA = a.date_received || '';
        const dateB = b.date_received || '';
        return dateB.localeCompare(dateA);
      });

      return {
        ...pattern,
        count: matches.length,
        trend,
        trendPercent: Math.abs(trendPercent),
        complaints: sortedMatches,
      };
    }).sort((a, b) => b.count - a.count);
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 lg:h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
              Issue Pattern Analysis
            </h3>
            <button
              onClick={() => setShowAllModal(true)}
              className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              View All ({data.length})
            </button>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
            Based on {narrativeCount.toLocaleString()} of {data.length.toLocaleString()} complaints
            <span className="group relative hidden sm:inline">
              <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 top-6 w-64 p-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded shadow-lg z-50">
                Only complaints with consumer narratives can be analyzed for keyword patterns. Some consumers don't provide details or don't consent to publish.
              </span>
            </span>
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            Tap any category to view complaints
          </p>
        </div>
      </div>

      {/* Pattern Cards */}
      <div className="space-y-3 flex-grow">
        {patternAnalysis.map(pattern => (
          <div
            key={pattern.id}
            className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer active:bg-gray-200 dark:active:bg-gray-600"
            onClick={() => handlePatternClick(pattern)}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <pattern.Icon className={`w-5 h-5 flex-shrink-0 ${pattern.textClass}`} />
                <span className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">
                  {pattern.label}
                </span>
              </div>
              <span className={`text-sm sm:text-base font-bold ${pattern.textClass}`}>
                {pattern.count.toLocaleString()}
              </span>
            </div>

            {/* Progress bar - relative to total complaints with narratives */}
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full transition-all ${pattern.barClass}`}
                style={{ width: `${narrativeCount > 0 ? Math.round((pattern.count / narrativeCount) * 100) : 0}%` }}
              />
            </div>

            {/* Actionable insight - hide on very small screens */}
            <p className="hidden sm:block text-xs text-gray-700 dark:text-gray-300">
              <span className="font-semibold">Action:</span> {pattern.actionable}
            </p>
          </div>
        ))}
      </div>

      {/* Drill-down Modal */}
      {isModalOpen && selectedPattern && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <selectedPattern.Icon className={`w-6 h-6 ${selectedPattern.textClass}`} />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedPattern.label}
                  </h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {selectedPattern.count} complaint{selectedPattern.count !== 1 ? 's' : ''}{' '}
                  {selectedPattern.keywords.length > 0
                    ? `matching keywords: ${selectedPattern.keywords.slice(0, 5).join(', ')}`
                    : '(no specific keyword matches)'}
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
                Showing all {selectedPattern.complaints.length} complaints categorized as {selectedPattern.label.toLowerCase()}
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

      {/* View All Complaints Modal */}
      {showAllModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  All Complaints
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {data.length} complaint{data.length !== 1 ? 's' : ''} matching current filters
                </p>
              </div>
              <button
                onClick={() => setShowAllModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body - Scrollable List */}
            <div className="flex-1 overflow-y-auto p-4">
              {data.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No complaints found</p>
              ) : (
                <div className="space-y-3">
                  {[...data]
                    .sort((a, b) => (b.date_received || '').localeCompare(a.date_received || ''))
                    .map((complaint, index) => (
                      <AllComplaintCard key={complaint.complaint_id || index} complaint={complaint} index={index} />
                    ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t dark:border-gray-700 flex justify-between items-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Sorted by date (newest first)
              </p>
              <button
                onClick={() => setShowAllModal(false)}
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

// Simplified complaint card for View All modal
function AllComplaintCard({ complaint, index }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown date';
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const narrative = complaint.complaint_what_happened || '';
  const hasNarrative = narrative.length > 0;

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">#{index + 1}</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {complaint.company || 'Unknown Company'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-600 text-white">
            {complaint.state || 'N/A'}
          </span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {formatDate(complaint.date_received)}
          </span>
        </div>
      </div>

      {/* Issue */}
      <div className="flex flex-wrap gap-2 mb-2">
        {complaint.issue && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-purple-600 text-white">
            {complaint.issue}
          </span>
        )}
        {complaint.sub_issue && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-gray-600 text-white">
            {complaint.sub_issue}
          </span>
        )}
      </div>

      {/* Response */}
      {complaint.company_response && (
        <div className="flex items-center gap-2 mb-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
            complaint.company_response.toLowerCase().includes('relief')
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-600 text-white'
          }`}>
            {complaint.company_response}
          </span>
          {complaint.timely === 'Yes' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-600 text-white">
              Timely
            </span>
          )}
        </div>
      )}

      {/* Narrative */}
      {hasNarrative && (
        <div className="mt-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700"
          >
            {isExpanded ? 'Hide narrative ↑' : 'Show narrative →'}
          </button>
          {isExpanded && (
            <div className="mt-2 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {narrative}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ID */}
      {complaint.complaint_id && (
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">ID: {complaint.complaint_id}</p>
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
        result.push(`<mark class="bg-yellow-300 dark:bg-yellow-600 text-gray-900 dark:text-white px-0.5 rounded font-semibold">${escapedText.slice(match.start, match.end)}</mark>`);
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
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
            #{index + 1}
          </span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {complaint.company || 'Unknown Company'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-600 text-white">
            {complaint.state || 'N/A'}
          </span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {formatDate(complaint.date_received)}
          </span>
        </div>
      </div>

      {/* Issue & Sub-issue */}
      <div className="flex flex-wrap gap-2 mb-2">
        {complaint.issue && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-purple-600 text-white">
            {complaint.issue}
          </span>
        )}
        {complaint.sub_issue && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-gray-600 text-white">
            {complaint.sub_issue}
          </span>
        )}
      </div>

      {/* Company Response */}
      {complaint.company_response && (
        <div className="flex items-center gap-2 mb-3">
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
              Timely
            </span>
          )}
          {complaint.consumer_disputed === 'Yes' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
              Disputed
            </span>
          )}
        </div>
      )}

      {/* Narrative with keyword highlighting */}
      <div className="mt-2 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
        <p
          className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap"
          dangerouslySetInnerHTML={{
            __html: highlightKeywords(
              isExpanded ? narrative : narrative.slice(0, previewLength) + (hasMoreContent ? '...' : '')
            )
          }}
        />
        {hasMoreContent && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
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
