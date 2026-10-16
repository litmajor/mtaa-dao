# Valuation asset candidate pipeline

The pipeline suggests assets for human review; it never adds an asset to
`valuation_assets`. Promotion is performed only by an authenticated admin using
the candidate approval endpoint or the existing direct admin asset-creation
endpoint. Discovery and market-data refreshes cannot change valuation
eligibility.

## Daily refresh

The server schedules the refresh for 00:15 UTC daily. A PostgreSQL advisory lock
prevents duplicate work when multiple server instances are running. The job:

1. Reads the top 150 CoinGecko markets and creates or refreshes candidate
   records, excluding active valuation assets.
2. Collects a bounded number of ticker and genesis-date detail records per run.
   The default is 25 assets per run, paced to avoid exhausting provider limits.
   Manually proposed assets are included even when they are outside the current
   top-150 market feed.
3. Counts only recent tickers with positive USD volume; only CoinGecko
   `green`-trust ticker volume contributes to daily volume history. Exchange
   count and mean trust score are recorded in the criteria snapshot.
4. Scores from rank, exchanges, trusted rolling volume, and trust. Trusted
   volume scoring is withheld until at least 20 daily observations exist in the
   preceding 30 days. Genesis age must be verified and at least 90 days for a
   candidate to score 60 or higher. Missing metrics earn no points.
5. Re-validates active allowlisted assets using
   `priceOracle.getValuationPrice()`. A missing quorum starts a persisted
   failure window. After the configured duration, the asset is flagged for
   review but remains active. Regaining quorum does not clear an existing flag;
   an administrator must resolve it.

The score is an ordering aid, not an approval condition. No score or set of
criteria can promote an asset automatically. CoinGecko ticker/market data is
not a substitute for valuation-oracle quorum.

## Configuration

- `VALUATION_CANDIDATE_DETAIL_LIMIT`: maximum candidate detail refreshes per
  daily run; defaults to `25`.
- `VALUATION_QUORUM_REVIEW_DAYS`: consecutive days without quorum before an
  active asset is flagged; defaults to `7`.
- `COINGECKO_API_BASE_URL`: optional API base URL override.
- `COINGECKO_PRO_API_KEY`: optional Pro API key; when set without a base URL,
  the Pro API endpoint is used.
- `COINGECKO_API_KEY`: optional Demo API key, used when no Pro key is set.

Migration `041-valuation-asset-candidates` creates the candidate and daily
market-observation tables, records provenance/review state on valuation assets,
and seeds the provided 62-symbol CoinMarketCap watchlist as manual candidates.
Symbols already actively allowlisted are labeled `already_allowlisted`, not
approved by the seed.

## Admin API

All endpoints are mounted under `/api/admin/valuation-assets` and require an
admin, super-admin, or governance role:

- `GET /candidates?status=proposed&min_score=60&limit=50` lists candidates in
  score order. Lower scores remain available by lowering `min_score`.
- `POST /candidates` creates a manual proposal. `symbol` and an auditable
  `reason` are required; `coingeckoId` and `name` are optional.
- `POST /candidates/:id/approve` promotes a proposed candidate in a database
  transaction. The request requires `assetClass` and an explicit
  `addedReason`; it accepts optional `coingeckoId`, risk settings, chain,
  contract address, and notes. The allowlist cache is reloaded after commit.
- `POST /candidates/:id/reject` records the admin’s rejection reason. The
  pipeline does not reject candidates automatically.
- `GET /health/review` lists active assets that need review.
- `POST /health/:symbol/resolve` acknowledges the review and restarts the
  failure window. It does not deactivate the asset.

Run the database migration before enabling the scheduled job. The job logs
provider failures and will continue the independent quorum re-validation pass
when market-data candidate discovery fails.
