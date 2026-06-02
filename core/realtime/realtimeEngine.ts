type Handler = (payload: any) => void;

class RealtimeEngine {
  private topics: Map<string, Set<Handler>> = new Map();

  subscribe(topic: string, handler: Handler) {
    if (!this.topics.has(topic)) this.topics.set(topic, new Set());
    this.topics.get(topic)!.add(handler);
    return () => this.unsubscribe(topic, handler);
  }

  unsubscribe(topic: string, handler: Handler) {
    const s = this.topics.get(topic);
    if (!s) return;
    s.delete(handler);
    if (s.size === 0) this.topics.delete(topic);
  }

  publish(topic: string, payload: any) {
    const s = this.topics.get(topic);
    if (!s) return;
    for (const h of Array.from(s)) {
      try {
        h(payload);
      } catch (e) {
        // swallow
      }
    }
  }

  clear() {
    this.topics.clear();
  }
}

export const realtimeEngine = new RealtimeEngine();

export default realtimeEngine;
