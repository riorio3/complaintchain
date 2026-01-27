export function Filters({ filters, setFilters, companies, issues }) {
  const handleChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const activeFiltersCount = Object.values(filters).filter(v => v && v !== 'all').length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-4 items-end">
        <div className="col-span-2 sm:flex-1 sm:min-w-[200px]">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company</label>
          <select
            value={filters.company || 'all'}
            onChange={e => handleChange('company', e.target.value)}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Companies</option>
            {companies.map(company => (
              <option key={company} value={company}>
                {company.length > 30 ? `${company.substring(0, 30)}...` : company}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2 sm:flex-1 sm:min-w-[200px]">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Issue Type</label>
          <select
            value={filters.issue || 'all'}
            onChange={e => handleChange('issue', e.target.value)}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Issues</option>
            {issues.map(issue => (
              <option key={issue} value={issue}>
                {issue.length > 30 ? `${issue.substring(0, 30)}...` : issue}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-1">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={e => handleChange('dateFrom', e.target.value)}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div className="col-span-1">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={e => handleChange('dateTo', e.target.value)}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <button
          onClick={() => setFilters({})}
          className="col-span-2 sm:col-span-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Reset {activeFiltersCount > 0 && `(${activeFiltersCount})`}
        </button>
      </div>

      {/* Active state filter indicator */}
      {filters.state && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Filtering by state:{' '}
            <span className="font-medium text-blue-600 dark:text-blue-400">{filters.state}</span>
            <button
              onClick={() => handleChange('state', null)}
              className="ml-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
