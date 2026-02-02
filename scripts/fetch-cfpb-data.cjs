#!/usr/bin/env node

/**
 * CFPB Crypto Complaints Data Fetcher
 *
 * Incrementally fetches new crypto-related complaints from the CFPB Consumer
 * Complaint Database API. Merges new complaints into the existing dataset,
 * deduplicating by complaint ID.
 *
 * Usage: node scripts/fetch-cfpb-data.cjs
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  API_BASE: 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/',
  PAGE_SIZE: 100,
  OUTPUT_FILE: path.join(__dirname, '..', 'src', 'data', 'complaints.json'),
  REQUEST_DELAY_MS: 500,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000,
};

// Crypto-related companies to fetch
const CRYPTO_COMPANIES = [
  'Block, Inc.',
  'Coinbase, Inc.',
  'ROBINHOOD MARKETS INC.',
  'Foris DAX, Inc.',
  'Paypal Holdings, Inc',
  'Winklevoss Exchange LLC',
  'BAM Management US Holdings Inc.',
  'Payward Ventures Inc. dba Kraken',
  'Blockchain.com, Inc.',
  'Abra',
  'BlockFi Inc',
  'Paxos Trust Company, LLC',
  'Voyager Digital (Canada) Ltd.',
  'Celsius Network LLC',
  'FTX Trading Ltd.',
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildUrl(params = {}) {
  const url = new URL(CONFIG.API_BASE);

  // Add company filters
  CRYPTO_COMPANIES.forEach(company => {
    url.searchParams.append('company', company);
  });

  // Also include Virtual currency sub_product
  url.searchParams.append('sub_product', 'Virtual currency');

  // Pagination
  url.searchParams.set('size', CONFIG.PAGE_SIZE.toString());
  url.searchParams.set('sort', 'created_date_desc');

  // Date filter for incremental fetching
  if (params.date_received_min) {
    url.searchParams.set('date_received_min', params.date_received_min);
  }

  if (params.frm) {
    url.searchParams.set('frm', params.frm.toString());
  }
  if (params.search_after) {
    url.searchParams.set('search_after', params.search_after);
  }

  return url.toString();
}

async function fetchPage(params = {}) {
  const url = buildUrl(params);

  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      console.log(`  Fetching: frm=${params.frm || 0}, search_after=${params.search_after || 'none'}`);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CryptoComplaintsDashboard/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle API returning a flat array (format=json style) vs ES format
      if (Array.isArray(data)) {
        return {
          hits: {
            total: { value: data.length },
            hits: data,
          },
        };
      }

      return data;

    } catch (error) {
      console.error(`  Attempt ${attempt}/${CONFIG.MAX_RETRIES} failed: ${error.message}`);

      if (attempt < CONFIG.MAX_RETRIES) {
        console.log(`  Retrying in ${CONFIG.RETRY_DELAY_MS}ms...`);
        await sleep(CONFIG.RETRY_DELAY_MS);
      } else {
        throw error;
      }
    }
  }
}

function extractSearchAfter(hits) {
  if (!hits || hits.length === 0) return null;

  const lastHit = hits[hits.length - 1];
  if (!lastHit.sort || lastHit.sort.length < 2) return null;

  return `${lastHit.sort[0]}_${lastHit.sort[1]}`;
}

function loadExistingData() {
  if (!fs.existsSync(CONFIG.OUTPUT_FILE)) {
    return { hits: [], ids: new Set(), latestDate: null };
  }

  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG.OUTPUT_FILE, 'utf8'));
    const hits = raw.hits?.hits || [];
    const ids = new Set(hits.map(h => h._id));

    // Find the latest date_received
    let latestDate = null;
    for (const h of hits) {
      const d = h._source?.date_received;
      if (d && (!latestDate || d > latestDate)) {
        latestDate = d;
      }
    }

    return { hits, ids, latestDate };
  } catch (e) {
    console.error('Warning: Could not parse existing data file, starting fresh.');
    return { hits: [], ids: new Set(), latestDate: null };
  }
}

async function fetchNewComplaints(dateMin) {
  const mode = dateMin ? `incremental (since ${dateMin})` : 'full';
  console.log(`Starting CFPB complaint data fetch (${mode})...\n`);
  console.log(`Target companies: ${CRYPTO_COMPANIES.length}`);
  console.log(`Page size: ${CONFIG.PAGE_SIZE}\n`);

  const allHits = [];
  let frm = 0;
  let searchAfter = null;
  let totalExpected = null;
  let pageCount = 0;

  while (true) {
    pageCount++;
    console.log(`\nPage ${pageCount}:`);

    const params = { frm };
    if (dateMin) {
      params.date_received_min = dateMin;
    }
    if (searchAfter) {
      params.search_after = searchAfter;
    }

    const response = await fetchPage(params);

    if (totalExpected === null) {
      totalExpected = response.hits?.total?.value || response.hits?.total || 0;
      console.log(`  Total new complaints available: ${totalExpected}`);
    }

    const hits = response.hits?.hits || [];
    console.log(`  Retrieved: ${hits.length} complaints`);

    if (hits.length === 0) {
      console.log('  No more results, pagination complete.');
      break;
    }

    allHits.push(...hits);
    console.log(`  Running total: ${allHits.length}/${totalExpected}`);

    searchAfter = extractSearchAfter(hits);
    frm += hits.length;

    if (allHits.length >= totalExpected) {
      console.log('  Reached expected total, stopping.');
      break;
    }

    await sleep(CONFIG.REQUEST_DELAY_MS);
  }

  return allHits;
}

function formatOutput(hits) {
  return {
    hits: {
      total: {
        value: hits.length,
      },
      hits: hits,
    },
  };
}

async function main() {
  const startTime = Date.now();

  try {
    // Load existing data
    const existing = loadExistingData();
    console.log(`Existing data: ${existing.hits.length} complaints`);
    if (existing.latestDate) {
      console.log(`Latest date in existing data: ${existing.latestDate}`);
    }

    // Fetch new complaints (incremental if we have existing data)
    // Use a date 7 days before the latest to catch any late-arriving complaints
    let dateMin = null;
    if (existing.latestDate) {
      const latest = new Date(existing.latestDate);
      latest.setDate(latest.getDate() - 7);
      dateMin = latest.toISOString().split('T')[0];
    }

    const newHits = await fetchNewComplaints(dateMin);

    if (existing.hits.length === 0 && newHits.length === 0) {
      console.error('\nERROR: Fetch returned 0 complaints - API may be down or query failed.');
      console.error('Aborting to preserve existing data.');
      process.exit(1);
    }

    // Merge: deduplicate by _id
    let addedCount = 0;
    for (const hit of newHits) {
      if (!existing.ids.has(hit._id)) {
        existing.hits.push(hit);
        existing.ids.add(hit._id);
        addedCount++;
      }
    }

    // Sort by date_received descending
    existing.hits.sort((a, b) => {
      const da = a._source?.date_received || '';
      const db = b._source?.date_received || '';
      return db.localeCompare(da);
    });

    const totalCount = existing.hits.length;
    console.log(`\nNew complaints added: ${addedCount}`);
    console.log(`Total complaints after merge: ${totalCount}`);

    const output = formatOutput(existing.hits);

    console.log(`Writing ${totalCount} complaints to ${CONFIG.OUTPUT_FILE}...`);
    fs.writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify(output), 'utf8');

    const fileSizeMB = (fs.statSync(CONFIG.OUTPUT_FILE).size / (1024 * 1024)).toFixed(2);
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\nComplete!`);
    console.log(`  Total complaints: ${totalCount}`);
    console.log(`  New complaints added: ${addedCount}`);
    console.log(`  File size: ${fileSizeMB} MB`);
    console.log(`  Elapsed time: ${elapsedSec}s`);

    // Output for GitHub Actions
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `complaint_count=${totalCount}\n`);
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_complaints=${addedCount}\n`);
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `file_size_mb=${fileSizeMB}\n`);
    }

  } catch (error) {
    console.error('\nFatal error:', error.message);
    process.exit(1);
  }
}

main();
