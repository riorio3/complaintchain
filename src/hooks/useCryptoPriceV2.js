import { useState, useEffect, useCallback, useRef } from 'react';

// Multiple CORS proxies - race them for fastest response
const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
];
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Primary APIs (no CORS issues, more reliable)
const BINANCE_API = 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT';
const COINCAP_API = 'https://api.coincap.io/v2/assets/bitcoin';
const KRAKEN_API = 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD';
const CRYPTOCOMPARE_API = 'https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD';

// Cache configuration - reduced to 1 minute for more frequent updates
const CACHE_KEY = 'btc_price_cache_v2';
const CACHE_TTL = 60 * 1000; // 1 minute (was 5 minutes)

// Increased timeout for better reliability
const REQUEST_TIMEOUT = 5000; // 5 seconds (was 2 seconds)

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

// Fallback static data in case API fails (2019 through Feb 2026)
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
  // 2026 - Current Year (updated to current market price)
  '2026-01': 95000,
  '2026-02': 71000, // Updated from $78k to ~$71k based on current market
};

// Pre-computed fallback array (optimization: avoid repeated conversion)
const FALLBACK_ARRAY = Object.entries(FALLBACK_PRICES)
  .map(([month, price]) => ({ month, price }))
  .sort((a, b) => a.month.localeCompare(b.month));

// Utility: sleep for retry delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Utility: fetch with retry and exponential backoff
async function fetchWithRetry(fetchFn, apiName) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await fetchFn();
      if (result) {
        if (attempt > 0) {
          console.log(`[BTC Price] ${apiName} succeeded on attempt ${attempt + 1}`);
        }
        return result;
      }
    } catch (error) {
      lastError = error;
      console.warn(`[BTC Price] ${apiName} attempt ${attempt + 1} failed:`, error.message);

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt];
        console.log(`[BTC Price] Retrying ${apiName} in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  console.error(`[BTC Price] ${apiName} failed after ${MAX_RETRIES + 1} attempts`);
  throw lastError;
}

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

// Fetch current price from CoinCap (no CORS, includes 24h change)
async function fetchFromCoinCap(timeout = REQUEST_TIMEOUT) {
  const response = await fetch(COINCAP_API, {
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`CoinCap API error: ${response.status}`);
  const data = await response.json();
  return {
    price: Math.round(parseFloat(data.data.priceUsd)),
    change24h: parseFloat(data.data.changePercent24Hr),
    source: 'coincap',
  };
}

// Fetch current price from Binance (no CORS, very reliable)
async function fetchFromBinance(timeout = REQUEST_TIMEOUT) {
  const response = await fetch(BINANCE_API, {
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`Binance API error: ${response.status}`);
  const data = await response.json();
  return {
    price: Math.round(parseFloat(data.price)),
    change24h: null, // Binance ticker doesn't include 24h change
    source: 'binance',
  };
}

// Fetch current price from Kraken (no CORS, very reliable)
async function fetchFromKraken(timeout = REQUEST_TIMEOUT) {
  const response = await fetch(KRAKEN_API, {
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`Kraken API error: ${response.status}`);
  const data = await response.json();
  if (data.error && data.error.length > 0) {
    throw new Error(`Kraken API error: ${data.error.join(', ')}`);
  }
  // Kraken returns data under XXBTZUSD key
  const tickerData = data.result.XXBTZUSD || data.result.XBTUSD;
  if (!tickerData) throw new Error('Kraken: No ticker data found');
  return {
    price: Math.round(parseFloat(tickerData.c[0])), // 'c' is last trade closed array [price, lot volume]
    change24h: null,
    source: 'kraken',
  };
}

// Fetch current price from CryptoCompare (no CORS, generous free tier)
async function fetchFromCryptoCompare(timeout = REQUEST_TIMEOUT) {
  const response = await fetch(CRYPTOCOMPARE_API, {
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`CryptoCompare API error: ${response.status}`);
  const data = await response.json();
  if (!data.USD) throw new Error('CryptoCompare: No USD price found');
  return {
    price: Math.round(data.USD),
    change24h: null,
    source: 'cryptocompare',
  };
}

// Load cached data from localStorage
function loadFromCache() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) {
        console.log('[BTC Price] Using cached data, age:', Math.round((Date.now() - timestamp) / 1000), 'seconds');
        return data;
      } else {
        console.log('[BTC Price] Cache expired, age:', Math.round((Date.now() - timestamp) / 1000), 'seconds');
      }
    }
  } catch (error) {
    console.warn('[BTC Price] Cache read error:', error.message);
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
    console.log('[BTC Price] Data cached successfully');
  } catch (error) {
    console.warn('[BTC Price] Cache write error:', error.message);
  }
}

export function useCryptoPriceV2(coin = 'bitcoin', days = 2555, refreshInterval = 60000) {
  const [priceData, setPriceData] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [dataSource, setDataSource] = useState(null);
  const isFetching = useRef(false);

  // Load cached data on mount (instant display)
  useEffect(() => {
    const cached = loadFromCache();
    if (cached) {
      setPriceData(cached.priceData);
      setCurrentPrice(cached.currentPrice);
      setLoading(false);
      setIsLive(true);
      setDataSource('cache');
    }
  }, []);

  // Fetch current price with cascading fallback and retry logic
  // Priority: CoinCap → Binance → Kraken → CryptoCompare → CoinGecko
  const fetchCurrentPrice = useCallback(async () => {
    console.log('[BTC Price] Fetching current price...');

    // Try CoinCap first (no CORS, includes 24h change)
    try {
      const result = await fetchWithRetry(() => fetchFromCoinCap(), 'CoinCap');
      if (result?.price) {
        console.log('[BTC Price] Got price from CoinCap:', result.price);
        return result;
      }
    } catch {
      console.warn('[BTC Price] CoinCap failed, trying Binance...');
    }

    // Try Binance second (no CORS, very reliable)
    try {
      const result = await fetchWithRetry(() => fetchFromBinance(), 'Binance');
      if (result?.price) {
        console.log('[BTC Price] Got price from Binance:', result.price);
        return result;
      }
    } catch {
      console.warn('[BTC Price] Binance failed, trying Kraken...');
    }

    // Try Kraken third (no CORS, very reliable)
    try {
      const result = await fetchWithRetry(() => fetchFromKraken(), 'Kraken');
      if (result?.price) {
        console.log('[BTC Price] Got price from Kraken:', result.price);
        return result;
      }
    } catch {
      console.warn('[BTC Price] Kraken failed, trying CryptoCompare...');
    }

    // Try CryptoCompare fourth (no CORS, generous free tier)
    try {
      const result = await fetchWithRetry(() => fetchFromCryptoCompare(), 'CryptoCompare');
      if (result?.price) {
        console.log('[BTC Price] Got price from CryptoCompare:', result.price);
        return result;
      }
    } catch {
      console.warn('[BTC Price] CryptoCompare failed, trying CoinGecko with proxies...');
    }

    // Try CoinGecko with CORS proxies as last resort
    const priceUrl = `${COINGECKO_API}/simple/price?ids=${coin}&vs_currencies=usd&include_24hr_change=true`;
    try {
      const data = await fetchWithProxyRace(priceUrl);
      if (data[coin]) {
        const result = {
          price: Math.round(data[coin].usd),
          change24h: data[coin].usd_24h_change,
          source: 'coingecko',
        };
        console.log('[BTC Price] Got price from CoinGecko:', result.price);
        return result;
      }
    } catch {
      console.error('[BTC Price] All API sources failed!');
    }

    return null;
  }, [coin]);

  // Fetch historical data (races all proxies)
  const fetchHistoricalData = useCallback(async () => {
    console.log('[BTC Price] Fetching historical data...');
    const apiUrl = `${COINGECKO_API}/coins/${coin}/market_chart?vs_currency=usd&days=${days}&interval=daily`;

    try {
      const data = await fetchWithProxyRace(apiUrl, 8000); // Longer timeout for historical data
      if (data.prices && data.prices.length > 0) {
        console.log('[BTC Price] Got historical data:', data.prices.length, 'data points');
        return data;
      }
    } catch (error) {
      console.warn('[BTC Price] Historical data fetch failed:', error.message);
    }
    return null;
  }, [coin, days]);

  const fetchPriceData = useCallback(async () => {
    // Prevent duplicate requests
    if (isFetching.current) {
      console.log('[BTC Price] Fetch already in progress, skipping...');
      return;
    }
    isFetching.current = true;
    console.log('[BTC Price] Starting price fetch at', new Date().toLocaleTimeString());

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
        setDataSource(priceResult.value.source || 'api');
        gotLivePrice = true;
        console.log('[BTC Price] Live price updated:', priceResult.value.price, 'from', priceResult.value.source);
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
              console.log('[BTC Price] Using latest historical price:', Math.round(latestPrice[1]));
            }
            setIsLive(true);
          }

          // Cache successful data
          saveToCache(processed, priceResult.value || { price: Math.round(historyData.prices[historyData.prices.length - 1][1]), change24h: null });
        }
      }

      // If historical data failed, use fallback
      if (!gotHistoricalData) {
        console.warn('[BTC Price] Using fallback historical data');
        setPriceData(FALLBACK_ARRAY);

        if (!gotLivePrice) {
          const latestMonth = Object.keys(FALLBACK_PRICES).sort().pop();
          console.warn('[BTC Price] Using fallback price:', FALLBACK_PRICES[latestMonth]);
          setCurrentPrice({
            price: FALLBACK_PRICES[latestMonth],
            change24h: null,
          });
          setDataSource('fallback');
        }
      }

      setIsLive(gotLivePrice || gotHistoricalData);
      setLastUpdated(new Date());
      setError(null);

    } catch (err) {
      console.error('[BTC Price] Complete failure:', err.message);
      // Complete failure - use fallback
      setPriceData(FALLBACK_ARRAY);
      const latestMonth = Object.keys(FALLBACK_PRICES).sort().pop();
      setCurrentPrice({
        price: FALLBACK_PRICES[latestMonth],
        change24h: null,
      });
      setIsLive(false);
      setDataSource('fallback');
      setLastUpdated(new Date());
      setError(null);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [fetchCurrentPrice, fetchHistoricalData]);

  // Initial fetch
  useEffect(() => {
    fetchPriceData();
  }, [fetchPriceData]);

  // Auto-refresh (default 1 minute)
  useEffect(() => {
    console.log('[BTC Price] Setting up refresh interval:', refreshInterval / 1000, 'seconds');
    const interval = setInterval(fetchPriceData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPriceData, refreshInterval]);

  return { priceData, currentPrice, loading, error, lastUpdated, isLive, dataSource, refetch: fetchPriceData };
}
