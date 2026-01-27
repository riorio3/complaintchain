import { useState, useEffect, useCallback } from 'react';

// RSS-to-JSON proxy (free, no auth)
const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json?rss_url=';

// News sources - mix of official and crypto news
const NEWS_SOURCES = [
  // Official government sources
  {
    name: 'SEC Press Releases',
    url: 'https://www.sec.gov/news/pressreleases.rss',
    agency: 'SEC',
    filterCrypto: true, // Only show crypto-related
  },
  // Crypto news - regulation focused
  {
    name: 'Cointelegraph Regulation',
    url: 'https://cointelegraph.com/rss/tag/regulation',
    agency: 'NEWS',
    filterCrypto: false, // Already crypto-focused
    filterRegulation: true, // Filter for regulatory news
  },
  {
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    agency: 'NEWS',
    filterCrypto: false,
    filterRegulation: true,
  },
  {
    name: 'Decrypt',
    url: 'https://decrypt.co/feed',
    agency: 'NEWS',
    filterCrypto: false,
    filterRegulation: true,
  },
];

// Keywords to filter for crypto-related news (for SEC)
const CRYPTO_KEYWORDS = [
  'crypto', 'bitcoin', 'digital asset', 'virtual currency', 'blockchain',
  'coinbase', 'binance', 'kraken', 'gemini', 'ftx', 'celsius', 'voyager',
  'defi', 'nft', 'token', 'stablecoin', 'exchange', 'trading platform',
  'cryptocurrency', 'ethereum', 'ripple', 'tether', 'usdc'
];

// Keywords to filter for regulatory news (for crypto news sources)
const REGULATION_KEYWORDS = [
  'sec', 'cftc', 'doj', 'fbi', 'treasury', 'regulation', 'regulatory',
  'lawsuit', 'enforcement', 'fine', 'penalty', 'charged', 'indicted',
  'settlement', 'court', 'judge', 'ruling', 'ban', 'crackdown',
  'investigation', 'subpoena', 'compliance', 'license', 'approved',
  'senator', 'congress', 'bill', 'law', 'legislation', 'hearing'
];

function isCryptoRelated(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  return CRYPTO_KEYWORDS.some(keyword => text.includes(keyword));
}

function isRegulationRelated(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  return REGULATION_KEYWORDS.some(keyword => text.includes(keyword));
}

export function useRegulatoryNews(refreshInterval = 60000) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchNews = useCallback(async () => {
    try {
      const allNews = [];

      // Fetch from all sources in parallel
      const promises = NEWS_SOURCES.map(async (source) => {
        try {
          const response = await fetch(`${RSS2JSON_API}${encodeURIComponent(source.url)}`);
          if (!response.ok) return [];

          const data = await response.json();
          if (data.status !== 'ok') return [];

          return (data.items || [])
            .filter(item => {
              const title = item.title || '';
              const desc = item.description || '';
              // Apply filters based on source settings
              if (source.filterCrypto && !isCryptoRelated(title, desc)) return false;
              if (source.filterRegulation && !isRegulationRelated(title, desc)) return false;
              return true;
            })
            .map(item => ({
              title: item.title,
              description: item.description?.replace(/<[^>]*>/g, '').slice(0, 200) + '...',
              date: item.pubDate,
              url: item.link,
              agency: source.agency,
              source: source.name,
            }));
        } catch (err) {
          return [];
        }
      });

      const results = await Promise.all(promises);
      results.forEach(items => allNews.push(...items));

      // Sort by date (newest first)
      allNews.sort((a, b) => new Date(b.date) - new Date(a.date));

      setNews(allNews.slice(0, 20)); // Keep top 20
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(fetchNews, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchNews, refreshInterval]);

  return { news, loading, error, lastUpdated, refetch: fetchNews };
}
