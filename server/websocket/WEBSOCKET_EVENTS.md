# WebSocket Events and Rooms

This document lists the canonical WebSocket namespaces, rooms, events, payload shapes, and auth/publishing rules used by the server.

## Overview
- Socket transports used:
  - Socket.IO (namespaces/endpoints): gateway, coordinator, morio, central WebSocketManager
  - Raw `ws` servers: price stream (`/ws/prices`), opportunity stream (`/api/opportunities-stream`)
- Auth:
  - Socket.IO endpoints expect JWT in `handshake.auth.token` by default (see `server/middleware/socketAuth.ts`).
  - Raw `ws` endpoints use `?token=<jwt>` query param on the upgrade URL.
- Server-side publishers should prefer `wsManager.emitToRoom(...)` for direct server broadcasts (these bypass per-socket join checks). Client sockets must `subscribe:room` before publishing to a room unless they are a trusted publisher.

## Room naming conventions
- Personal rooms: `user:${userId}`
- Alerts: `alerts` (global) or `alerts:${entityType}:${entityId}` (entity-scoped)
- Config changes: `config:${entityType}:${entityId}`
- Activity: `activity:${entityType}:${entityId}` or `activity:feed` for global feed
- Presence: `presence:${section}`
- Search results: `search:results`
- Analytics: `analytics` and `dashboard:metrics`

> Note: `hasRoomPermission()` expects exact-segment matches (e.g. `user:${id}`) — do not rely on substring matching.

## Canonical Events
- `subscribe:room` / `unsubscribe:room`
  - Payload: `{ room: string }`
  - Client must call to join/leave.

- `alert:new` (server → clients)
  - Emitted to `alerts` or `alerts:${entityType}:${entityId}`
  - Payload example: `{ id, entityType, entityId, message, severity, triggeredBy, timestamp }

- `config:changed` (client → server → room)
  - Client flow: client should `subscribe` then emit `config:changed` (only allowed if joined OR privileged). Server-side publishers use `emitToRoom`.
  - Payload example: `{ entityType, entityId, changes, changedBy }

- `activity:logged` / `activity:new` (server → clients)
  - Emitted to `activity:${entityType}:${entityId}` and/or `activity:feed`
  - Payload example: `{ entityType, entityId, action, details, user }

- `presence:update` (client → server)
  - Payload: `{ section: string, action: 'viewing'|'editing'|'searching' }`
  - Server rebroadcasts `presence:updated` to `presence:${section}` with `{ userId, email, action, timestamp }

- `search:result-ready` (server → clients)
  - Emitted to `search:results`
  - Payload: `{ queryId, totalResults, results, completed }

- Analytics events: `analytics:updated`, `metrics:updated`

## Auth and publishing rules
- By default clients must provide a JWT in `handshake.auth.token` or `?token=` for raw `ws`.
- `hasRoomPermission(user, room)` rules (source of truth: `server/websocket/websocket.ts`):
  - `user:${id}`: only that user
  - `alerts`: user needs `view:alerts`
  - `analytics`: user needs `view:analytics`
  - `config:*`: user needs `view:configuration`
  - `activity:*`: user needs `view:activity`
- `canPublishToRoom(socket, user, room)` enforces both permission and membership. Exceptions:
  - `socket.data.system === true` (system socket)
  - `user.permissions` includes `publish:system`

Server processes that publish without joining should either set `socket.data.system = true` when connecting, or use a service account with `publish:system` permission.

## Rollout notes
- `priceStream` (`/ws/prices`) now enforces auth at upgrade time; pass `?token=<jwt>` or initialize the server with `requireAuth: false` during rollout.
- `gateway-websocket` has a configurable poll interval via `GATEWAY_WS_POLL_INTERVAL_MS`. Set it to `0` to disable periodic re-polling if your message bus already pushes all updates.

## How to add new rooms/events
1. Add the event/room mapping here.
2. Ensure `hasRoomPermission` is updated with required permissions.
3. Prefer server-side `emitToRoom` for backend-originated broadcasts.
4. Add client `subscribe` before clients publish to the room (or mark the client as `system`).

---

For questions or changes, update this file and the `hasRoomPermission` / `canPublishToRoom` logic in `server/websocket/websocket.ts` accordingly.
