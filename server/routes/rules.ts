import { Router, Request, Response } from "express";
import { isAuthenticated } from "../nextAuthMiddleware";
import { ruleEngine } from "../services/rule-engine";
import { db } from "../db";

const router = Router();

/**
 * GET /api/daos/:daoId/rules
 * List all rules for a DAO
 */
router.get("/daos/:daoId/rules", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;

    if (!daoId) {
      return res.status(400).json({ error: 'Missing daoId' });
    }

    const rules = await ruleEngine.getRulesForDao(daoId);
    res.json({
      success: true,
      data: rules,
      count: rules.length,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error listing rules:", errorMsg);
    res.status(500).json({
      success: false,
      error: "Failed to list rules",
    });
  }
});

/**
 * POST /api/daos/:daoId/rules
 * Create a new rule
 */
router.post("/daos/:daoId/rules", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId } = req.params;
    const { name, description, templateId, config } = req.body;

    if (!daoId) {
      return res.status(400).json({ error: 'Missing daoId' });
    }

    if (!name || !config) {
      return res.status(400).json({ error: 'Missing required fields: name, config' });
    }

    // Validate config structure
    if (!config.conditions || !Array.isArray(config.conditions)) {
      return res.status(400).json({ error: 'config.conditions must be an array' });
    }

    if (!config.actions || !Array.isArray(config.actions)) {
      return res.status(400).json({ error: 'config.actions must be an array' });
    }

    const ruleId = await ruleEngine.createRule(daoId, req.user?.id || 'system', {
      name,
      description: description || '',
      templateId,
      config,
      eventType: req.body.eventType || 'member_create'
    });

    res.status(201).json({
      success: true,
      data: { ruleId },
      message: 'Rule created successfully',
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Error creating rule:', errorMsg);
    res.status(500).json({
      success: false,
      error: 'Failed to create rule',
    });
  }
});

/**
 * GET /api/daos/:daoId/rules/:ruleId
 * Get a specific rule
 */
router.get("/daos/:daoId/rules/:ruleId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;

    if (!ruleId) {
      return res.status(400).json({ error: 'Missing ruleId' });
    }

    const rule = await ruleEngine.getRule(ruleId);

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: "Rule not found",
      });
    }

    res.json({
      success: true,
      data: {
        ...rule,
        rule_config: typeof rule.rule_config === "string"
          ? JSON.parse(rule.rule_config)
          : rule.rule_config,
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error fetching rule:", errorMsg);
    res.status(500).json({
      success: false,
      error: "Failed to fetch rule",
    });
  }
});

/**
 * PUT /api/daos/:daoId/rules/:ruleId
 * Update a rule
 */
router.put("/daos/:daoId/rules/:ruleId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;
    const updates = req.body;

    if (!ruleId) {
      return res.status(400).json({ error: 'Missing ruleId' });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    await ruleEngine.updateRule(ruleId, req.user?.id || 'system', updates);

    res.json({
      success: true,
      message: "Rule updated successfully",
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error updating rule:", errorMsg);
    res.status(500).json({
      success: false,
      error: "Failed to update rule",
    });
  }
});

/**
 * DELETE /api/daos/:daoId/rules/:ruleId
 * Delete a rule
 */
router.delete("/daos/:daoId/rules/:ruleId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;

    if (!ruleId) {
      return res.status(400).json({ error: 'Missing ruleId' });
    }

    await ruleEngine.deleteRule(ruleId);

    res.json({
      success: true,
      message: "Rule deleted successfully",
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error deleting rule:", errorMsg);
    res.status(500).json({
      success: false,
      error: "Failed to delete rule",
    });
  }
});

/**
 * POST /api/daos/:daoId/rules/:ruleId/test
 * Test a rule with sample data
 */
router.post("/daos/:daoId/rules/:ruleId/test", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;
    const { context } = req.body;

    if (!ruleId) {
      return res.status(400).json({ error: 'Missing ruleId' });
    }

    if (!context) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: context",
      });
    }

    const rule = await ruleEngine.getRule(ruleId);

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: "Rule not found",
      });
    }

    const result = await ruleEngine.evaluateRule(rule, context);

    res.json({
      success: true,
      data: result,
      message: "Rule evaluation completed",
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error testing rule:", errorMsg);
    res.status(500).json({
      success: false,
      error: "Failed to test rule",
    });
  }
});

/**
 * GET /api/daos/:daoId/rules/:ruleId/executions
 * Get rule execution history
 */
router.get(
  "/daos/:daoId/rules/:ruleId/executions",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { ruleId } = req.params;
      const { limit = 50 } = req.query;

      if (!ruleId) {
        return res.status(400).json({ error: 'Missing ruleId' });
      }

      const history = await ruleEngine.getExecutionHistory(
        ruleId,
        parseInt(limit as string) || 50
      );

      res.json({
        success: true,
        data: history,
        count: history.length,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Error fetching execution history:", errorMsg);
      res.status(500).json({
        success: false,
        error: "Failed to fetch execution history",
      });
    }
  }
);

/**
 * GET /api/rules/templates
 * Get available rule templates
 */
router.get("/rules/templates", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { category } = req.query;

    const templates = category
      ? await ruleEngine.getTemplates(category as string)
      : await ruleEngine.getTemplates();

    res.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error fetching templates:", errorMsg);
    res.status(500).json({
      success: false,
      error: "Failed to fetch templates",
    });
  }
});

/**
 * GET /api/rules/templates/:templateId
 * Get a specific template
 */
router.get("/rules/templates/:templateId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;

    if (!templateId) {
      return res.status(400).json({ error: 'Missing templateId' });
    }

    const template = await ruleEngine.getTemplate(templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: "Template not found",
      });
    }

    res.json({
      success: true,
      data: {
        ...template,
        default_config: typeof template.default_config === "string"
          ? JSON.parse(template.default_config)
          : template.default_config,
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error fetching template:", errorMsg);
    res.status(500).json({
      success: false,
      error: "Failed to fetch template",
    });
  }
});

/**
 * POST /api/daos/:daoId/rules/evaluate/:eventType
 * Evaluate all rules for an event
 */
router.post("/daos/:daoId/rules/evaluate/:eventType", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { daoId, eventType } = req.params;
    const { context } = req.body;

    if (!daoId || !eventType) {
      return res.status(400).json({ error: 'Missing daoId or eventType' });
    }

    if (!context) {
      return res.status(400).json({ error: 'Missing context for evaluation' });
    }

    const results = await ruleEngine.evaluateAllRules(daoId, eventType, context);
    const allApproved = ruleEngine.checkAllApproved(results);

    res.json({
      success: true,
      data: {
        results,
        allApproved,
        summary: {
          total: results.length,
          approved: results.filter((r: any) => r.status === 'approved').length,
          rejected: results.filter((r: any) => r.status === 'rejected').length,
          errors: results.filter((r: any) => r.status === 'error').length
        }
      }
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error evaluating rules:", errorMsg);
    res.status(500).json({
      success: false,
      error: "Failed to evaluate rules",
    });
  }
});
