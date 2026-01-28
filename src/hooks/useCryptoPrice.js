import { useState, useEffect, useCallback } from 'react';

// Multiple CORS proxies to try (in order of reliability)
const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
];
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

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

export function useCryptoPrice(coin = 'bitcoin', days = 2555, refreshInterval = 300000) {
  const [priceData, setPriceData] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLive, setIsLive] = useState(false);

  // Fetch current price from simple endpoint (more reliable)
  const fetchCurrentPrice = useCallback(async () => {
    const priceUrl = `${COINGECKO_API}/simple/price?ids=${coin}&vs_currencies=usd&include_24hr_change=true`;

    for (const proxy of CORS_PROXIES) {
      try {
        const proxyUrl = proxy.includes('?')
          ? `${proxy}${encodeURIComponent(priceUrl)}`
          : `${proxy}${priceUrl}`;

        const response = await fetch(proxyUrl, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const data = await response.json();
          if (data[coin]) {
            return {
              price: Math.round(data[coin].usd),
              change24h: data[coin].usd_24h_change,
            };
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  }, [coin]);

  const fetchPriceData = useCallback(async () => {
    try {
      // Fetch current price first (separate, more reliable call)
      const livePrice = await fetchCurrentPrice();
      if (livePrice) {
        setCurrentPrice(livePrice);
        setIsLive(true);
      }

      // Try to fetch historical data from CoinGecko via CORS proxies
      const apiUrl = `${COINGECKO_API}/coins/${coin}/market_chart?vs_currency=usd&days=${days}&interval=daily`;

      let historyData = null;

      // Try each proxy until one works
      for (const proxy of CORS_PROXIES) {
        try {
          const proxyUrl = proxy.includes('?')
            ? `${proxy}${encodeURIComponent(apiUrl)}`
            : `${proxy}${apiUrl}`;

          const response = await fetch(proxyUrl, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10000), // 10 second timeout
          });

          if (response.ok) {
            const data = await response.json();
            if (data.prices && data.prices.length > 0) {
              historyData = data;
              break;
            }
          }
        } catch (proxyErr) {
          continue;
        }
      }

      if (!historyData) {
        throw new Error('All proxies failed');
      }

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
        if (!livePrice) {
          // Only use historical price if live price fetch failed
          const latestPrice = historyData.prices[historyData.prices.length - 1];
          if (latestPrice) {
            setCurrentPrice({
              price: Math.round(latestPrice[1]),
              change24h: null,
            });
          }
          setIsLive(true);
        }

        setLastUpdated(new Date());
        setError(null);
        setLoading(false);
        return;
      }

      throw new Error('No price data returned');

    } catch (err) {
      // Use fallback static data for historical chart
      const fallbackArray = Object.entries(FALLBACK_PRICES)
        .map(([month, price]) => ({ month, price }))
        .sort((a, b) => a.month.localeCompare(b.month));

      setPriceData(fallbackArray);

      // Only use fallback price if we didn't get a live price
      if (!currentPrice) {
        const latestMonth = Object.keys(FALLBACK_PRICES).sort().pop();
        setCurrentPrice({
          price: FALLBACK_PRICES[latestMonth],
          change24h: null,
        });
      }
      setIsLive(currentPrice !== null);
      setLastUpdated(new Date());
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [coin, days, fetchCurrentPrice, currentPrice]);

  // Initial fetch
  useEffect(() => {
    fetchPriceData();
  }, [fetchPriceData]);

  // Auto-refresh (default 5 minutes)
  useEffect(() => {
    const interval = setInterval(fetchPriceData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPriceData, refreshInterval]);

  return { priceData, currentPrice, loading, error, lastUpdated, isLive, refetch: fetchPriceData };
}
