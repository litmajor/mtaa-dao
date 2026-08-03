# ADR: Use the Notification Service for Realtime Fanout

**Status:** Accepted

**Date:** 2026-07-07

**Author:** litmajor

## 1. Context and Problem Statement

The notification system had two distinct write paths:

- a storage-backed persistence path for creating notification rows in the database
- a realtime fanout path for pushing updates to connected clients

The admin notification send route was previously writing through storage without necessarily triggering the shared realtime flow. That created a gap where a notification could be persisted but not surface immediately in the UI through the active websocket path.

This was especially problematic for admin-triggered notifications, where the expectation is that a user sees the update promptly without needing a manual refresh.

## 2. Decision

We will use the canonical notification service as the single realtime fanout mechanism for notification creation, while still persisting the notification row in the database.

Concretely:

- the route persists the notification through the storage layer
- the same event is then passed to the notification service
- the notification service emits the shared realtime event for connected clients
- the service call uses `persist: false` so the notification is not double-persisted

This keeps the write path explicit and ensures that realtime delivery is driven by the same service that powers the rest of the notification system.

## 3. Justification

### Consistency

Using the notification service ensures that the same notification creation flow is used for both database-backed and realtime delivery scenarios.

### Reliability

Users receive updates through the same websocket path already used by the application, rather than relying on a one-off route behavior.

### Maintainability

The route no longer needs to know about the transport details of realtime delivery. It simply requests that a notification be created, and the service handles persistence and fanout through the established pipeline.

## 4. Consequences

### Positive

- realtime notifications are delivered consistently for admin-triggered sends
- the code path is easier to reason about because persistence and fanout are coordinated by one service
- the system remains aligned with the existing Socket.IO-based notification architecture

### Trade-offs

- notification creation now involves both storage and the notification service, so the route has a slightly more explicit orchestration step
- failures in the service path could affect realtime fanout even when the database write succeeds, so monitoring and error handling remain important

### Follow-up

- keep the route and service behavior covered by regression tests
- monitor whether any notification sources still bypass the shared service path
- consider centralizing the persistence + fanout behavior in a dedicated helper if more routes adopt the same pattern

## 5. Notes

Relevant implementation points:

- server/routes/notifications.ts — HTTP entrypoint for creating and listing notifications
- server/notificationService.ts — canonical service that persists notifications and emits the realtime event
- server/index.ts — Socket.IO server wiring and fanout listener for notification_created
- server/storage/storage-tasks.ts — persistence layer for notifications and preferences
- server/websocket/websocket-events.ts — shared event and websocket path constants
- client/src/hooks/useNotifications.ts — client listener for realtime notification delivery
- client/src/hooks/useSharedSocket.ts — shared Socket.IO client connection helper
- shared/schema.ts — database schema for notifications and notification preferences
