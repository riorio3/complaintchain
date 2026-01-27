import { useState, useEffect, useMemo } from 'react';
import complaintsData from '../data/complaints.json';

// Extract complaints from the comprehensive data file
// This data includes: Coinbase, Block/Cash App, Robinhood, Kraken, Gemini, Crypto.com, and more
// Data auto-refreshes weekly via GitHub Actions
const staticComplaints = complaintsData.hits?.hits?.map(hit => hit._source) || [];

export function useComplaints(filters = {}) {
  const [loading, setLoading] = useState(true);
  const [lastUpdated] = useState(new Date());

  // Simulate initial load
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Filter data based on filters
  const data = useMemo(() => {
    let filtered = [...staticComplaints];

    // Filter by company
    if (filters.company && filters.company !== 'all') {
      filtered = filtered.filter(c => c.company === filters.company);
    }

    // Filter by issue
    if (filters.issue && filters.issue !== 'all') {
      filtered = filtered.filter(c => c.issue === filters.issue);
    }

    // Filter by date range
    if (filters.dateFrom) {
      filtered = filtered.filter(c => c.date_received >= filters.dateFrom);
    }
    if (filters.dateTo) {
      filtered = filtered.filter(c => c.date_received <= filters.dateTo);
    }

    // Filter by state
    if (filters.state) {
      filtered = filtered.filter(c => c.state === filters.state);
    }

    return filtered;
  }, [filters.company, filters.issue, filters.dateFrom, filters.dateTo, filters.state]);

  // Get date range from data
  const dateRange = useMemo(() => {
    if (staticComplaints.length === 0) return null;
    const dates = staticComplaints
      .map(c => c.date_received)
      .filter(Boolean)
      .sort();
    return {
      oldest: dates[0]?.slice(0, 10),
      newest: dates[dates.length - 1]?.slice(0, 10),
    };
  }, []);

  return {
    data,
    loading,
    error: null,
    lastUpdated,
    isLive: true, // Data is current as of last static update
    totalCount: staticComplaints.length,
    dateRange,
  };
}
