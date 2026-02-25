/**
 * Elders & Agents Database Service
 * Handles all database operations for Elders and Agents
 */

import { db } from '../client';
import {
  elders,
  agents,
  elderActivity,
  agentLogs,
  elderAgentInteraction,
  systemConfiguration,
  performanceMetrics,
} from '../schema/agents-elders';
import { eq, desc, gte, lte, and, or } from 'drizzle-orm';

// ============================================================================
// ELDERS OPERATIONS
// ============================================================================

/**
 * Get all elders
 */
export async function getAllElders() {
  try {
    return await db.select().from(elders);
  } catch (error) {
    console.error('Error fetching all elders:', error);
    throw error;
  }
}

/**
 * Get elder by ID
 */
export async function getElderById(elderId: string) {
  try {
    const result = await db.select().from(elders).where(eq(elders.id, elderId)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Error fetching elder:', error);
    throw error;
  }
}

/**
 * Get elder by name
 */
export async function getElderByName(name: string) {
  try {
    const result = await db.select().from(elders).where(eq(elders.name, name)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Error fetching elder by name:', error);
    throw error;
  }
}

/**
 * Create new elder
 */
export async function createElder(elderData: typeof elders.$inferInsert) {
  try {
    const result = await db.insert(elders).values(elderData).returning();
    return result[0];
  } catch (error) {
    console.error('Error creating elder:', error);
    throw error;
  }
}

/**
 * Update elder
 */
export async function updateElder(elderId: string, updates: Partial<typeof elders.$inferInsert>) {
  try {
    const result = await db
      .update(elders)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(elders.id, elderId))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Error updating elder:', error);
    throw error;
  }
}

/**
 * Update elder heartbeat
 */
export async function updateElderHeartbeat(elderId: string, uptime: number) {
  try {
    const result = await db
      .update(elders)
      .set({
        lastHeartbeat: new Date(),
        uptime: uptime.toString(),
      })
      .where(eq(elders.id, elderId))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Error updating elder heartbeat:', error);
    throw error;
  }
}

/**
 * Delete elder
 */
export async function deleteElder(elderId: string) {
  try {
    const result = await db.delete(elders).where(eq(elders.id, elderId)).returning();
    return result[0];
  } catch (error) {
    console.error('Error deleting elder:', error);
    throw error;
  }
}

// ============================================================================
// AGENTS OPERATIONS
// ============================================================================

/**
 * Get all agents
 */
export async function getAllAgents() {
  try {
    return await db.select().from(agents);
  } catch (error) {
    console.error('Error fetching all agents:', error);
    throw error;
  }
}

/**
 * Get agent by ID
 */
export async function getAgentById(agentId: string) {
  try {
    const result = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Error fetching agent:', error);
    throw error;
  }
}

/**
 * Get agents by type
 */
export async function getAgentsByType(type: string) {
  try {
    return await db.select().from(agents).where(eq(agents.type, type));
  } catch (error) {
    console.error('Error fetching agents by type:', error);
    throw error;
  }
}

/**
 * Create new agent
 */
export async function createAgent(agentData: typeof agents.$inferInsert) {
  try {
    const result = await db.insert(agents).values(agentData).returning();
    return result[0];
  } catch (error) {
    console.error('Error creating agent:', error);
    throw error;
  }
}

/**
 * Update agent
 */
export async function updateAgent(agentId: string, updates: Partial<typeof agents.$inferInsert>) {
  try {
    const result = await db
      .update(agents)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Error updating agent:', error);
    throw error;
  }
}

/**
 * Update agent heartbeat and metrics
 */
export async function updateAgentHeartbeat(agentId: string, uptime: number, responseTime: number) {
  try {
    const result = await db
      .update(agents)
      .set({
        lastHeartbeat: new Date(),
        uptime: uptime.toString(),
        averageResponseTime: responseTime,
      })
      .where(eq(agents.id, agentId))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Error updating agent heartbeat:', error);
    throw error;
  }
}

/**
 * Delete agent
 */
export async function deleteAgent(agentId: string) {
  try {
    const result = await db.delete(agents).where(eq(agents.id, agentId)).returning();
    return result[0];
  } catch (error) {
    console.error('Error deleting agent:', error);
    throw error;
  }
}

// ============================================================================
// ELDER ACTIVITY OPERATIONS
// ============================================================================

/**
 * Create elder activity
 */
export async function createElderActivity(
  activityData: typeof elderActivity.$inferInsert
) {
  try {
    const result = await db.insert(elderActivity).values(activityData).returning();
    return result[0];
  } catch (error) {
    console.error('Error creating elder activity:', error);
    throw error;
  }
}

/**
 * Get elder activity history
 */
export async function getElderActivityHistory(elderId: string, limit: number = 50) {
  try {
    return await db
      .select()
      .from(elderActivity)
      .where(eq(elderActivity.elderId, elderId))
      .orderBy(desc(elderActivity.occurredAt))
      .limit(limit);
  } catch (error) {
    console.error('Error fetching elder activity history:', error);
    throw error;
  }
}

/**
 * Get elder activities by type
 */
export async function getElderActivitiesByType(
  elderId: string,
  activityType: string,
  limit: number = 50
) {
  try {
    return await db
      .select()
      .from(elderActivity)
      .where(
        and(eq(elderActivity.elderId, elderId), eq(elderActivity.activityType, activityType))
      )
      .orderBy(desc(elderActivity.occurredAt))
      .limit(limit);
  } catch (error) {
    console.error('Error fetching elder activities by type:', error);
    throw error;
  }
}

// ============================================================================
// AGENT LOGS OPERATIONS
// ============================================================================

/**
 * Create agent log entry
 */
export async function createAgentLog(logData: typeof agentLogs.$inferInsert) {
  try {
    const result = await db.insert(agentLogs).values(logData).returning();
    return result[0];
  } catch (error) {
    console.error('Error creating agent log:', error);
    throw error;
  }
}

/**
 * Get agent logs
 */
export async function getAgentLogs(agentId: string, limit: number = 100) {
  try {
    return await db
      .select()
      .from(agentLogs)
      .where(eq(agentLogs.agentId, agentId))
      .orderBy(desc(agentLogs.timestamp))
      .limit(limit);
  } catch (error) {
    console.error('Error fetching agent logs:', error);
    throw error;
  }
}

/**
 * Get agent logs by result
 */
export async function getAgentLogsByResult(
  agentId: string,
  result: string,
  limit: number = 50
) {
  try {
    return await db
      .select()
      .from(agentLogs)
      .where(and(eq(agentLogs.agentId, agentId), eq(agentLogs.result, result)))
      .orderBy(desc(agentLogs.timestamp))
      .limit(limit);
  } catch (error) {
    console.error('Error fetching agent logs by result:', error);
    throw error;
  }
}

/**
 * Get agent logs within time range
 */
export async function getAgentLogsInTimeRange(
  agentId: string,
  startTime: Date,
  endTime: Date,
  limit: number = 100
) {
  try {
    return await db
      .select()
      .from(agentLogs)
      .where(
        and(
          eq(agentLogs.agentId, agentId),
          gte(agentLogs.timestamp, startTime),
          lte(agentLogs.timestamp, endTime)
        )
      )
      .orderBy(desc(agentLogs.timestamp))
      .limit(limit);
  } catch (error) {
    console.error('Error fetching agent logs in time range:', error);
    throw error;
  }
}

// ============================================================================
// ELDER-AGENT INTERACTION OPERATIONS
// ============================================================================

/**
 * Create interaction record
 */
export async function createInteraction(
  interactionData: typeof elderAgentInteraction.$inferInsert
) {
  try {
    const result = await db.insert(elderAgentInteraction).values(interactionData).returning();
    return result[0];
  } catch (error) {
    console.error('Error creating interaction:', error);
    throw error;
  }
}

/**
 * Get interactions between elder and agent
 */
export async function getInteractionsBetween(
  elderId: string,
  agentId: string,
  limit: number = 50
) {
  try {
    return await db
      .select()
      .from(elderAgentInteraction)
      .where(
        and(
          eq(elderAgentInteraction.elderId, elderId),
          eq(elderAgentInteraction.agentId, agentId)
        )
      )
      .orderBy(desc(elderAgentInteraction.timestamp))
      .limit(limit);
  } catch (error) {
    console.error('Error fetching interactions:', error);
    throw error;
  }
}

// ============================================================================
// SYSTEM CONFIGURATION OPERATIONS
// ============================================================================

/**
 * Get system configuration
 */
export async function getSystemConfiguration() {
  try {
    const result = await db.select().from(systemConfiguration).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Error fetching system configuration:', error);
    throw error;
  }
}

/**
 * Update system configuration
 */
export async function updateSystemConfiguration(
  configId: string,
  updates: Partial<typeof systemConfiguration.$inferInsert>
) {
  try {
    const result = await db
      .update(systemConfiguration)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(systemConfiguration.id, configId))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Error updating system configuration:', error);
    throw error;
  }
}

/**
 * Create or get system configuration
 */
export async function ensureSystemConfiguration() {
  try {
    let config = await getSystemConfiguration();
    if (!config) {
      const result = await db
        .insert(systemConfiguration)
        .values({
          id: 'sys-config-1',
          elderSettings: {},
          agentSettings: {},
          systemSettings: {},
        })
        .returning();
      config = result[0];
    }
    return config;
  } catch (error) {
    console.error('Error ensuring system configuration:', error);
    throw error;
  }
}

// ============================================================================
// PERFORMANCE METRICS OPERATIONS
// ============================================================================

/**
 * Create performance metric record
 */
export async function createPerformanceMetric(
  metricData: typeof performanceMetrics.$inferInsert
) {
  try {
    const result = await db.insert(performanceMetrics).values(metricData).returning();
    return result[0];
  } catch (error) {
    console.error('Error creating performance metric:', error);
    throw error;
  }
}

/**
 * Get performance metrics for entity
 */
export async function getPerformanceMetrics(
  entityType: string,
  entityId: string,
  limit: number = 100
) {
  try {
    return await db
      .select()
      .from(performanceMetrics)
      .where(
        and(
          eq(performanceMetrics.entityType, entityType),
          eq(performanceMetrics.entityId, entityId)
        )
      )
      .orderBy(desc(performanceMetrics.recordedAt))
      .limit(limit);
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    throw error;
  }
}

/**
 * Get recent performance metrics
 */
export async function getRecentPerformanceMetrics(
  entityType: string,
  entityId: string,
  hours: number = 24,
  limit: number = 100
) {
  try {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return await db
      .select()
      .from(performanceMetrics)
      .where(
        and(
          eq(performanceMetrics.entityType, entityType),
          eq(performanceMetrics.entityId, entityId),
          gte(performanceMetrics.recordedAt, startTime)
        )
      )
      .orderBy(desc(performanceMetrics.recordedAt))
      .limit(limit);
  } catch (error) {
    console.error('Error fetching recent performance metrics:', error);
    throw error;
  }
}

// ============================================================================
// STATISTICS & AGGREGATIONS
// ============================================================================

/**
 * Get elder statistics
 */
export async function getElderStats(elderId: string) {
  try {
    const elder = await getElderById(elderId);
    if (!elder) return null;

    const activities = await getElderActivityHistory(elderId, 1000);
    const metrics = await getPerformanceMetrics('elder', elderId, 100);

    return {
      elder,
      activityCount: activities.length,
      recentActivities: activities.slice(0, 10),
      metricsCount: metrics.length,
      recentMetrics: metrics.slice(0, 10),
    };
  } catch (error) {
    console.error('Error getting elder stats:', error);
    throw error;
  }
}

/**
 * Get agent statistics
 */
export async function getAgentStats(agentId: string) {
  try {
    const agent = await getAgentById(agentId);
    if (!agent) return null;

    const logs = await getAgentLogs(agentId, 1000);
    const metrics = await getPerformanceMetrics('agent', agentId, 100);

    const successCount = logs.filter((l) => l.result === 'success').length;
    const errorCount = logs.filter((l) => l.result === 'error').length;

    return {
      agent,
      logCount: logs.length,
      successCount,
      errorCount,
      successRate: logs.length > 0 ? successCount / logs.length : 0,
      recentLogs: logs.slice(0, 10),
      metricsCount: metrics.length,
      recentMetrics: metrics.slice(0, 10),
    };
  } catch (error) {
    console.error('Error getting agent stats:', error);
    throw error;
  }
}

/**
 * Get all elders with stats
 */
export async function getAllEldersWithStats() {
  try {
    const allElders = await getAllElders();
    return Promise.all(allElders.map((e) => getElderStats(e.id)));
  } catch (error) {
    console.error('Error getting all elders with stats:', error);
    throw error;
  }
}

/**
 * Get all agents with stats
 */
export async function getAllAgentsWithStats() {
  try {
    const allAgents = await getAllAgents();
    return Promise.all(allAgents.map((a) => getAgentStats(a.id)));
  } catch (error) {
    console.error('Error getting all agents with stats:', error);
    throw error;
  }
}
