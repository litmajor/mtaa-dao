/**
 * Database Seeding Script
 * Phase 5.1 - Seeds Elders and Agents data
 */

import { db } from '../client';
import {
  elders,
  agents,
  systemConfiguration,
} from '../schema/agents-elders';
import { generateId } from '../../utils/id-generator';

/**
 * Seed Elders
 */
export async function seedElders() {
  console.log('🌱 Seeding Elders...');

  const eldersData = [
    {
      id: 'eld-kaizen',
      name: 'KAIZEN',
      emoji: '⚙️',
      role: 'Process Optimization',
      description: 'Analyzes and optimizes DAO processes for efficiency and effectiveness',
      capabilities: [
        'Process analysis and modeling',
        'Efficiency recommendations',
        'Workflow optimization',
        'Performance benchmarking',
      ],
      status: 'active',
      uptime: 0.99,
      proposalsAnalyzed: 245,
      optimizationsSuggested: 87,
      implementationRate: 0.72,
      color: '#667eea',
      configuration: {
        threshold: 0.8,
        reviewPeriod: 7,
        maxRecommendations: 5,
      },
      tags: ['optimization', 'efficiency', 'process'],
      metadata: {
        specialization: 'operational-efficiency',
        lastUpdated: new Date().toISOString(),
      },
    },
    {
      id: 'eld-scry',
      name: 'SCRY',
      emoji: '🔍',
      role: 'Security & Threat Detection',
      description: 'Detects threats, vulnerabilities, and compliance issues across the DAO',
      capabilities: [
        'Real-time threat detection',
        'Vulnerability assessment',
        'Risk scoring and analysis',
        'Compliance monitoring',
      ],
      status: 'active',
      uptime: 0.995,
      threatsDetected: 156,
      risksIdentified: 342,
      complianceIssues: 12,
      color: '#f59e0b',
      configuration: {
        threatLevel: 'high',
        alertThreshold: 0.7,
        scanFrequency: 'hourly',
      },
      tags: ['security', 'risk', 'compliance'],
      metadata: {
        specialization: 'security-oversight',
        lastUpdated: new Date().toISOString(),
      },
    },
    {
      id: 'eld-lumen',
      name: 'LUMEN',
      emoji: '⚖️',
      role: 'Ethics & Fairness Review',
      description: 'Reviews proposals and decisions for ethical concerns and fairness implications',
      capabilities: [
        'Ethical impact assessment',
        'Fairness evaluation',
        'Bias detection and mitigation',
        'Values alignment checking',
      ],
      status: 'active',
      uptime: 0.998,
      proposalsReviewed: 198,
      ethicalConcerns: 34,
      approvalRate: 0.91,
      color: '#10b981',
      configuration: {
        ethicsScore: 0.85,
        flagConcerns: true,
        recommendationWeight: 0.8,
      },
      tags: ['ethics', 'fairness', 'values'],
      metadata: {
        specialization: 'ethical-oversight',
        lastUpdated: new Date().toISOString(),
      },
    },
  ];

  try {
    for (const elder of eldersData) {
      // Check if already exists
      const existing = await db.select().from(elders).where(
        // @ts-ignore
        (table) => table.id.eq(elder.id)
      );

      if (existing.length === 0) {
        await db.insert(elders).values(elder);
        console.log(`✅ Created Elder: ${elder.name}`);
      } else {
        console.log(`⏭️  Elder already exists: ${elder.name}`);
      }
    }
    console.log('✨ Elders seeding completed\n');
  } catch (error) {
    console.error('❌ Error seeding elders:', error);
    throw error;
  }
}

/**
 * Seed Agents
 */
export async function seedAgents() {
  console.log('🌱 Seeding Agents...');

  const agentsData = [
    {
      id: 'agent-analyzer',
      name: 'Analyzer Agent',
      type: 'analyzer',
      emoji: '📊',
      description: 'Analyzes proposals and evaluates their impact on the DAO',
      status: 'online',
      uptime: 0.995,
      messagesProcessed: 1243,
      averageResponseTime: 245,
      errorRate: 0.01,
      capabilities: [
        'Proposal analysis',
        'Impact evaluation',
        'Risk assessment',
        'Data processing',
      ],
      version: '1.0.0',
      configuration: {
        analysisDepth: 'comprehensive',
        timeout: 30000,
        retries: 3,
      },
      tags: ['analysis', 'proposals', 'evaluation'],
      metadata: {
        deployedAt: new Date().toISOString(),
        region: 'primary',
      },
    },
    {
      id: 'agent-defender',
      name: 'Defender Agent',
      type: 'defender',
      emoji: '🛡️',
      description: 'Monitors security, detects threats, and prevents attacks',
      status: 'online',
      uptime: 0.997,
      messagesProcessed: 892,
      averageResponseTime: 187,
      errorRate: 0.008,
      capabilities: [
        'Security monitoring',
        'Threat detection',
        'Attack prevention',
        'Vulnerability scanning',
      ],
      version: '1.0.0',
      configuration: {
        alertLevel: 'critical',
        scanMode: 'continuous',
        responseTime: 'immediate',
      },
      tags: ['security', 'defense', 'monitoring'],
      metadata: {
        deployedAt: new Date().toISOString(),
        region: 'primary',
      },
    },
    {
      id: 'agent-scout',
      name: 'Scout Agent',
      type: 'scout',
      emoji: '👀',
      description: 'Monitors system health and collects performance metrics',
      status: 'online',
      uptime: 0.992,
      messagesProcessed: 2156,
      averageResponseTime: 156,
      errorRate: 0.005,
      capabilities: [
        'System monitoring',
        'Metrics collection',
        'Health checking',
        'Performance tracking',
      ],
      version: '1.0.0',
      configuration: {
        updateFrequency: '5m',
        metricDepth: 'full',
        alertThreshold: 0.85,
      },
      tags: ['monitoring', 'metrics', 'health'],
      metadata: {
        deployedAt: new Date().toISOString(),
        region: 'primary',
      },
    },
    {
      id: 'agent-coordinator',
      name: 'Coordinator Agent',
      type: 'coordinator',
      emoji: '🔄',
      description: 'Coordinates interactions between multiple agents and services',
      status: 'online',
      uptime: 0.999,
      messagesProcessed: 543,
      averageResponseTime: 158,
      errorRate: 0.002,
      capabilities: [
        'Task orchestration',
        'Agent coordination',
        'Workflow management',
        'Load balancing',
      ],
      version: '1.0.0',
      configuration: {
        orchestrationMode: 'distributed',
        loadBalance: true,
        priority: 'high',
      },
      tags: ['coordination', 'orchestration', 'workflow'],
      metadata: {
        deployedAt: new Date().toISOString(),
        region: 'primary',
      },
    },
    {
      id: 'agent-kwetu',
      name: 'Kwetu Agent',
      type: 'community',
      emoji: '💬',
      description: 'Engages with the community and handles communications',
      status: 'online',
      uptime: 0.985,
      messagesProcessed: 456,
      averageResponseTime: 234,
      errorRate: 0.012,
      capabilities: [
        'Community engagement',
        'Communication handling',
        'Feedback collection',
        'Updates distribution',
      ],
      version: '1.0.0',
      configuration: {
        engagementMode: 'interactive',
        responseStyle: 'friendly',
        updateFrequency: 'hourly',
      },
      tags: ['community', 'communication', 'engagement'],
      metadata: {
        deployedAt: new Date().toISOString(),
        region: 'primary',
      },
    },
  ];

  try {
    for (const agent of agentsData) {
      // Check if already exists
      const existing = await db.select().from(agents).where(
        // @ts-ignore
        (table) => table.id.eq(agent.id)
      );

      if (existing.length === 0) {
        await db.insert(agents).values(agent);
        console.log(`✅ Created Agent: ${agent.name}`);
      } else {
        console.log(`⏭️  Agent already exists: ${agent.name}`);
      }
    }
    console.log('✨ Agents seeding completed\n');
  } catch (error) {
    console.error('❌ Error seeding agents:', error);
    throw error;
  }
}

/**
 * Seed System Configuration
 */
export async function seedSystemConfiguration() {
  console.log('🌱 Seeding System Configuration...');

  try {
    // Check if config already exists
    const existing = await db.select().from(systemConfiguration);

    if (existing.length === 0) {
      const configData = {
        id: 'sys-config-1',
        elderSettings: {
          kaizen: {
            enabled: true,
            priority: 'high',
            updateFrequency: '24h',
          },
          scry: {
            enabled: true,
            priority: 'critical',
            updateFrequency: '1h',
          },
          lumen: {
            enabled: true,
            priority: 'high',
            updateFrequency: '24h',
          },
        },
        agentSettings: {
          analyzer: {
            enabled: true,
            maxConcurrent: 5,
            timeout: 30000,
          },
          defender: {
            enabled: true,
            maxConcurrent: 10,
            timeout: 60000,
          },
          scout: {
            enabled: true,
            maxConcurrent: 3,
            timeout: 15000,
          },
          coordinator: {
            enabled: true,
            maxConcurrent: 2,
            timeout: 45000,
          },
          kwetu: {
            enabled: true,
            maxConcurrent: 5,
            timeout: 30000,
          },
        },
        systemSettings: {
          maintenanceMode: false,
          debugMode: false,
          alertsEnabled: true,
          metricsCollection: true,
          activityLogging: true,
        },
        elderFeatureFlags: {
          recommendationEngine: true,
          realTimeAnalysis: true,
          historicalTracking: true,
        },
        agentFeatureFlags: {
          autonomousMode: true,
          errorRecovery: true,
          performanceOptimization: true,
        },
      };

      await db.insert(systemConfiguration).values(configData);
      console.log('✅ Created System Configuration');
    } else {
      console.log('⏭️  System Configuration already exists');
    }
    console.log('✨ System Configuration seeding completed\n');
  } catch (error) {
    console.error('❌ Error seeding system configuration:', error);
    throw error;
  }
}

/**
 * Main seeding function
 */
export async function seed() {
  console.log('\n🚀 Starting database seeding for Phase 5.1...\n');
  try {
    await seedElders();
    await seedAgents();
    await seedSystemConfiguration();
    console.log('🎉 Database seeding completed successfully!\n');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  seed().then(() => process.exit(0));
}
