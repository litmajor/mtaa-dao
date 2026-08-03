# Watchlist Infrastructure Confirmation

This note captures the implementation decisions for the YUKI watchlist feature based on the current codebase.

## What exists today

- The server already has a YUKI watchlist router at [server/routes/v1/yuki/watchlist.ts](../server/routes/v1/yuki/watchlist.ts).
- The current implementation stores watchlist rows in a simple table with:
  - `item_type`
  - `target_id`
  - `alert_price`
  - `metadata`
- The client already expects a watchlist fetch entrypoint from [client/src/api/yukiApi.ts](../client/src/api/yukiApi.ts).
- The current UI in [client/src/components/trading/YukiDashboard.tsx](../client/src/components/trading/YukiDashboard.tsx) treats the watchlist as a flat list of symbol-like rows and does not resolve polymorphic entities into live values.
- The market-data stack already exposes real-time push infrastructure via [server/services/marketStreamService.ts](../server/services/marketStreamService.ts) and [server/services/websocketRealTimeFeeds.ts](../server/services/websocketRealTimeFeeds.ts).
- Notifications already exist through [server/notificationService.ts](../server/notificationService.ts), which persists entries and emits realtime events.

## Confirmed product direction

### 1) Use a polymorphic watchlist item model

The unified watchlist goal is to track multiple entity types together, so the schema should be designed around one row per watchlist item with exactly one target reference.

Recommended shape:

- `watchlist_id`
- `item_type` with values such as `symbol`, `pool`, `vault`, `investment_pool`, `strategy`, `creator`
- exactly one target column populated for the selected entity type
- `alert_metric`
- `alert_direction`
- `alert_threshold`
- `alert_active`
- `alert_last_fired_at`
- `metadata`

This is the right fit for the cross-entity view the product is trying to build.

### 2) Generalize alerts beyond price

The current `alert_price` abstraction is too narrow for the intended product surface.

Why:
- Symbols naturally alert on price.
- Vaults and pools more naturally alert on APY, TVL, or utilization.
- A price-only model would force fake semantics onto non-price entities or make the feature incomplete.

Decision for implementation:
- Support `alert_metric` with values such as `price`, `apy`, `tvl`, and `utilization`.
- For v1, implement the main flow around `price`, `apy`, and `tvl` so the schema is still future-proof without overbuilding the first release.

### 3) Use one-shot alerts for v1

The evaluator should not spam repeatedly while a metric oscillates around a threshold.

Decision:
- Ship one-shot alerts in v1.
- When an alert fires, set `alert_active = false` and record `alert_last_fired_at`.
- The user can re-arm the alert manually later.

This is simpler and safer than a cooldown window for the first release.

### 4) Use a scheduled evaluator for v1

The market stack already supports push-style feeds, but the current watchlist implementation does not yet have an evaluator loop.

Decision:
- Implement the initial alert evaluator as a scheduled poller job.
- The job should read the latest values for each active watchlist item, compare them to the configured threshold and direction, and then trigger a notification if crossed.
- Use the existing notification service for delivery.

This keeps the first version low-risk while still aligning with the existing infrastructure.

### 5) The hook should resolve live values, not only raw DB rows

The current UI does not do the important part of the feature: it does not merge a watchlist row with the current market value for the referenced entity.

The correct frontend/backend shape is:
- fetch watchlist rows from the backend
- resolve each item to its live metric value from the market-data layer
- render the current value alongside the configured threshold and alert state

This is the real feature gap, not the refactor itself.

## Recommended implementation plan

1. Create the new watchlist item schema with one-of-six target references and metric/direction/threshold fields.
2. Add CRUD endpoints for creating, updating, and deleting watchlist items with alert configuration.
3. Add a scheduled evaluator job that checks active alerts and triggers notifications.
4. Add a watchlist hook or service layer that resolves each item into a live metric value for rendering.
5. Update the UI to display live metrics instead of only static stored values.

## Bottom line

The codebase supports this direction well:
- the watchlist table already exists,
- the market-data stream already exists,
- the notification system already exists,
- and the missing piece is the polymorphic alert schema plus the evaluator and live-value merge layer.
