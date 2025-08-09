# Gate.io P2P Scraper

Scrapes Gate.io P2P buy listings with Puppeteer and saves merchant data to JSON/CSV. Ships with auto-scroll, robust logging, environment-based config, and an optional filtered view around a target merchant.

## Features

- Headless scraping with Puppeteer (uses bundled Chromium by default)
- Configurable target URL (USDT-KES by default)
- Auto-scroll to load dynamic content
- One-off or continuous runs (configurable interval)
- Outputs in JSON and CSV
- Logs for activity, warnings, and errors
- Optional filtered output for the merchant adjacent to a target (default: "coinftw")

## Requirements

- Node.js 18+ and npm
- Internet access
- Optional: Google Chrome/Chromium (if you prefer a system browser instead of bundled Chromium)

## Install

```bash
npm install
```

## Configuration

- Copy `.env.example` to `.env` and adjust as needed:

```bash
TARGET_URL=https://www.gate.io/p2p/buy/USDT-KES
SCRAPE_INTERVAL_MS=60000
TARGET_MERCHANT=coinftw
# CHROME_EXECUTABLE=/usr/bin/google-chrome-stable
```

- URL: change `TARGET_URL` to the P2P page you want.
- Browser binary: set `CHROME_EXECUTABLE` to use a system Chrome/Chromium; otherwise the bundled Chromium is used.

```bash
export CHROME_EXECUTABLE=/usr/bin/google-chrome-stable
```

> Note: The filtered output looks for merchant name `coinftw` by default (see `scraper/filterMerchant.js`).

## Usage

Run a single scrape:

```bash
npm run scrape:once
```

Run continuously (default interval from `.env`):

```bash
npm start
```

## Outputs

- `data/gateio_p2p_merchants.json`
- `data/gateio_p2p_merchants.csv`
- `data/filtered_merchants.json` (adjacent to the target merchant)
- `data/filtered_merchants.csv` (adjacent to the target merchant)

## Logs

- `logs/activity.log` — high-level steps
- `logs/errors.log` — errors and stack traces
- `logs/warnings.log` — non-fatal warnings

## Troubleshooting

- Browser not found at executablePath
	- Clear `CHROME_EXECUTABLE` or point it to a valid path; by default the bundled Chromium is used.
- Timeouts waiting for selectors or no data extracted
	- The site may have changed. Update selectors in `scraper/extract.js` and the `waitForSelector` in `scraper/scraper.js`.
- Permission errors writing files
	- Ensure the process can write to `data/` and `logs/` folders.

## Development

- Lint:

```bash
npm run lint
```

- Format:

```bash
npm run format
```

- Tests (none added yet):

```bash
npm test
```

## Project structure

- `index.js` — schedules the scraper to run every 60s
- `scraper/scraper.js` — orchestrates launch, navigation, scroll, extraction, and save
- `scraper/config.js` — target URL and optional Chrome executable path (via env)
- `scraper/autoScroll.js` — helper to load all dynamic items
- `scraper/extract.js` — DOM selectors and extraction logic
- `scraper/dataSaver.js` — writes JSON/CSV files to `data/`
- `scraper/filterMerchant.js` — returns adjacent records for a target merchant and saves filtered outputs
- `scraper/logger.js` — writes to `logs/`

## Notes on maintainability and robustness

- Extraction selectors are centralized in `scraper/extract.js` and include fallbacks; if the site changes, update them there.
- Config and intervals are environment-driven via `.env` to avoid code changes.
- CSV writing escapes values and ensures directories exist.
- Graceful shutdown on SIGINT/SIGTERM to stop intervals cleanly.

## License

ISC
