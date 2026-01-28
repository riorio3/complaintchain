import { useState, useEffect, useCallback, useRef } from 'react';

// Multiple CORS proxies - race them for fastest response
const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
];
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Cache configuration
const CACHE_KEY = 'btc_price_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Reduced timeout for faster failure detection
const REQUEST_TIMEOUT = 3000;

// Fallback static data in case API fails (2019 through Jan 2026)
const FALLBACK_PRICES = {
  // 2019 - Bear Market Recovery
  '2019-01': 3600, '2019-02': 3800, '2019-03': 4000, '2019-04': 5200,
  '2019-05': 7500, '2019-06': 10800, '2019-07': 10500, '2019-08': 10200,
  '2019-09': 8500, '2019-10': 8300, '2019-11': 7500, '2019-12': 7200,
  // 2020 - COVID Crash & Recovery
  '2020-01': 8500, '2020-02': 9500, '2020-03': 6500, '2020-04': 7500,
  '2020-05': 9000, '2020-06': 9300, '2020-07': 9800, '2020-08': 11500,
  '2020-09': 10700, '2020-10': 13000, '2020-11': 17500, '2020-12': 24000,
  // 2021 - Bull Run & ATH
  '2021-01': 34000, '2021-02': 46000, '2021-03': 55000, '2021-04': 57000,
  '2021-05': 40000, '2021-06': 35000, '2021-07': 33000, '2021-08': 44000,
  '2021-09': 45000, '2021-10': 55000, '2021-11': 60000, '2021-12': 48000,
  // 2022 - Crypto Winter
  '2022-01': 41500, '2022-02': 39500, '2022-03': 44000, '2022-04': 40000,
  '2022-05': 31500, '2022-06': 21500, '2022-07': 22500, '2022-08': 21500,
  '2022-09': 19500, '2022-10': 20500, '2022-11': 17000, '2022-12': 16800,
  // 2023 - Recovery Year
  '2023-01': 21500, '2023-02': 23500, '2023-03': 28000, '2023-04': 29500,
  '2023-05': 27500, '2023-06': 30500, '2023-07': 29500, '2023-08': 26000,
  '2023-09': 27000, '2023-10': 34500, '2023-11': 37500, '2023-12': 42500,
  // 2024 - ETF Approval & Bull Run
  '2024-01': 43000, '2024-02': 52000, '2024-03': 70000, '2024-04': 65000,
  '2024-05': 67000, '2024-06': 62000, '2024-07': 66000, '2024-08': 59000,
  '2024-09': 63000, '2024-10': 68000, '2024-11': 90000, '2024-12': 97000,
  // 2025 - Post-Election Rally & Correction
  '2025-01': 102000, '2025-02': 96000, '2025-03': 82000, '2025-04': 84000,
  '2025-05': 103000, '2025-06': 106000, '2025-07': 97000, '2025-08': 59000,
  '2025-09': 63000, '2025-10': 69000, '2025-11': 96000, '2025-12': 94000,
  // 2026 - Current Year
  '2026-01': 102000,
};

// Pre-computed fallback array (optimization: avoid repeated conversion)
const FALLBACK_ARRAY = Object.entries(FALLBACK_PRICES)
  .map(([month, price]) => ({ month, price }))
  .sort((a, b) => a.month.localeCompare(b.month));

// Race multiple proxies - first successful response wins
async function fetchWithProxyRace(url, timeout = REQUEST_TIMEOUT) {
  const fetchPromises = CORS_PROXIES.map(async (proxy) => {
    const proxyUrl = proxy.includes('?')
      ? `${proxy}${encodeURIComponent(url)}`
      : `${proxy}${url}`;

    const response = await fetch(proxyUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) throw new Error('Response not ok');
    return response.json();
  });

  // Promise.any returns first fulfilled promise
  return Promise.any(fetchPromises);
}

// Load cached data from localStorage
function loadFromCache() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) {
        return data;
      }
    }
  } catch {
    // Ignore cache errors
  }
  return null;
}

// Save data to localStorage cache
function saveToCache(priceData, currentPrice) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: { priceData, currentPrice },
      timestamp: Date.now(),
    }));
  } catch {
    // Ignore cache errors (quota exceeded, etc.)
  }
}

export function useCryptoPrice(coin = 'bitcoin', days = 2555, refreshInterval = 300000) {
  const [priceData, setPriceData] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const isFetching = useRef(false);

  // Load cached data on mount (instant display)
  useEffect(() => {
    const cached = loadFromCache();
    if (cached) {
      setPriceData(cached.priceData);
      setCurrentPrice(cached.currentPrice);
      setLoading(false);
      setIsLive(true);
    }
  }, []);

  // Fetch current price (races all proxies)
  const fetchCurrentPrice = useCallback(async () => {
    const priceUrl = `${COINGECKO_API}/simple/price?ids=${coin}&vs_currencies=usd&include_24hr_change=true`;

    try {
      const data = await fetchWithProxyRace(priceUrl);
      if (data[coin]) {
        return {
          price: Math.round(data[coin].usd),
          change24h: data[coin].usd_24h_change,
        };
      }
    } catch {
      // All proxies failed
    }
    return null;
  }, [coin]);

  // Fetch historical data (races all proxies)
  const fetchHistoricalData = useCallback(async () => {
    const apiUrl = `${COINGECKO_API}/coins/${coin}/market_chart?vs_currency=usd&days=${days}&interval=daily`;

    try {
      const data = await fetchWithProxyRace(apiUrl, 5000); // Slightly longer for historical
      if (data.prices && data.prices.length > 0) {
        return data;
      }
    } catch {
      // All proxies failed
    }
    return null;
  }, [coin, days]);

  const fetchPriceData = useCallback(async () => {
    // Prevent duplicate requests
    if (isFetching.current) return;
    isFetching.current = true;

    let gotLivePrice = false;
    let gotHistoricalData = false;

    try {
      // PARALLEL: Fetch both current price and historical data simultaneously
      const [priceResult, historyResult] = await Promise.allSettled([
        fetchCurrentPrice(),
        fetchHistoricalData(),
      ]);

      // Process current price result
      if (priceResult.status === 'fulfilled' && priceResult.value) {
        setCurrentPrice(priceResult.value);
        setIsLive(true);
        gotLivePrice = true;
      }

      // Process historical data result
      if (historyResult.status === 'fulfilled' && historyResult.value) {
        const historyData = historyResult.value;

        // Process price data into monthly averages
        const monthlyPrices = {};
        historyData.prices.forEach(([timestamp, price]) => {
          const date = new Date(timestamp);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

          if (!monthlyPrices[monthKey]) {
            monthlyPrices[monthKey] = { sum: 0, count: 0 };
          }
          monthlyPrices[monthKey].sum += price;
          monthlyPrices[monthKey].count++;
        });

        // Convert to array format
        const processed = Object.entries(monthlyPrices)
          .map(([month, data]) => ({
            month,
            price: Math.round(data.sum / data.count),
          }))
          .sort((a, b) => a.month.localeCompare(b.month));

        if (processed.length > 0) {
          setPriceData(processed);
          gotHistoricalData = true;

          // Use historical latest price as fallback if live price failed
          if (!gotLivePrice) {
            const latestPrice = historyData.prices[historyData.prices.length - 1];
            if (latestPrice) {
              setCurrentPrice({
                price: Math.round(latestPrice[1]),
                change24h: null,
              });
            }
            setIsLive(true);
          }

          // Cache successful data
          saveToCache(processed, priceResult.value || { price: Math.round(historyData.prices[historyData.prices.length - 1][1]), change24h: null });
        }
      }

      // If historical data failed, use fallback
      if (!gotHistoricalData) {
        setPriceData(FALLBACK_ARRAY);

        if (!gotLivePrice) {
          const latestMonth = Object.keys(FALLBACK_PRICES).sort().pop();
          setCurrentPrice({
            price: FALLBACK_PRICES[latestMonth],
            change24h: null,
          });
        }
      }

      setIsLive(gotLivePrice || gotHistoricalData);
      setLastUpdated(new Date());
      setError(null);

    } catch (err) {
      // Complete failure - use fallback
      setPriceData(FALLBACK_ARRAY);
      const latestMonth = Object.keys(FALLBACK_PRICES).sort().pop();
      setCurrentPrice({
        price: FALLBACK_PRICES[latestMonth],
        change24h: null,
      });
      setIsLive(false);
      setLastUpdated(new Date());
      setError(null);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [fetchCurrentPrice, fetchHistoricalData]);

  // Initial fetch (skip if we have valid cache)
  useEffect(() => {
    const cached = loadFromCache();
    if (!cached) {
      fetchPriceData();
    } else {
      // Still fetch in background to update cache
      fetchPriceData();
    }
  }, [fetchPriceData]);

  // Auto-refresh (default 5 minutes)
  useEffect(() => {
    const interval = setInterval(fetchPriceData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPriceData, refreshInterval]);

  return { priceData, currentPrice, loading, error, lastUpdated, isLive, refetch: fetchPriceData };
}
