import { healthRegistry } from './HealthRegistryConsolidation';

const HEALTH_COMPONENTS = [
  { name: 'PostgreSQL Database', type: 'database' as const },
  { name: 'Redis Cache', type: 'redis' as const },
  { name: 'File Storage', type: 'custom' as const },
  { name: 'Node.js Memory', type: 'custom' as const },
  { name: 'Disk I/O', type: 'custom' as const },
];

function registerComponentIfMissing(name: string, type: 'exchange' | 'oracle' | 'database' | 'redis' | 'blockchain' | 'custom') {
  const existing = healthRegistry.getComponentHealth(name);
  if (!existing) {
    healthRegistry.registerComponent(name, type);
  }
}

export function initializeHealthRegistryComponents(): void {
  HEALTH_COMPONENTS.forEach((component) => {
    registerComponentIfMissing(component.name, component.type);
  });
}
