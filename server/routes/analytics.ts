
import express from 'express';
import { analyticsService } from '../analyticsService';
import { isAuthenticated } from '../auth';
import PDFDocument from 'pdfkit';

const router = express.Router();

// GET /api/analytics/metrics - Real-time metrics
router.get('/metrics', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.query;
    const metrics = await analyticsService.getRealTimeMetrics(daoId as string);
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch real-time metrics',
      error: error.message
    });
  }
});

// GET /api/analytics/historical - Historical data analysis
router.get('/historical', isAuthenticated, async (req, res) => {
  try {
    const { period = 'month', daoId } = req.query;
    
    if (!['week', 'month', 'quarter', 'year'].includes(period as string)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid period. Must be one of: week, month, quarter, year'
      });
    }
    
    const historicalData = await analyticsService.getHistoricalData(
      period as 'week' | 'month' | 'quarter' | 'year',
      daoId as string
    );
    
    res.json({
      success: true,
      data: historicalData,
      period,
      daoId: daoId || 'all'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch historical data',
      error: error.message
    });
  }
});

// GET /api/analytics/benchmarks - Performance benchmarks
router.get('/benchmarks', isAuthenticated, async (req, res) => {
  try {
    const benchmarks = await analyticsService.getPerformanceBenchmarks();
    
    res.json({
      success: true,
      data: benchmarks,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance benchmarks',
      error: error.message
    });
  }
});

// GET /api/analytics/export/csv - Export data as CSV
router.get('/export/csv', isAuthenticated, async (req, res) => {
  try {
    const { type = 'metrics', period = 'month', daoId } = req.query;
    
    if (!['metrics', 'historical', 'benchmarks'].includes(type as string)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export type. Must be one of: metrics, historical, benchmarks'
      });
    }
    
    const csvContent = await analyticsService.exportToCSV(
      type as 'metrics' | 'historical' | 'benchmarks',
      period as 'week' | 'month' | 'quarter' | 'year',
      daoId as string
    );
    
    const filename = `${type}-${period || 'current'}-${daoId || 'all'}-${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to export CSV',
      error: error.message
    });
  }
});

// GET /api/analytics/export/pdf - Export data as PDF report
router.get('/export/pdf', isAuthenticated, async (req, res) => {
  try {
    const { daoId, period = 'month' } = req.query;
    
    // Get data for PDF
    const [metrics, historical, benchmarks] = await Promise.all([
      analyticsService.getRealTimeMetrics(daoId as string),
      analyticsService.getHistoricalData(period as any, daoId as string),
      analyticsService.getPerformanceBenchmarks()
    ]);
    
    // Create PDF document
    const doc = new PDFDocument();
    const filename = `analytics-report-${daoId || 'platform'}-${new Date().toISOString().split('T')[0]}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    doc.pipe(res);
    
    // PDF Header
    doc.fontSize(20).text('Analytics Report', 50, 50);
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, 50, 80);
    doc.text(`Period: ${period}`, 50, 95);
    if (daoId) doc.text(`DAO ID: ${daoId}`, 50, 110);
    
    // Current Metrics Section
    doc.fontSize(16).text('Current Metrics', 50, 140);
    let yPos = 160;
    
    Object.entries(metrics).forEach(([key, value]) => {
      if (key !== 'topPerformingDaos' && typeof value !== 'object') {
        doc.fontSize(10).text(`${key}: ${value}`, 50, yPos);
        yPos += 15;
      }
    });
    
    // Historical Trends Section
    yPos += 20;
    doc.fontSize(16).text('Historical Trends', 50, yPos);
    yPos += 20;
    
    doc.fontSize(10).text('Date | DAOs | Users | Proposals | Volume', 50, yPos);
    yPos += 15;
    
    historical.slice(-10).forEach(item => {
      doc.text(`${item.timestamp} | ${item.daoCount} | ${item.userCount} | ${item.proposalCount} | $${item.transactionVolume.toFixed(2)}`, 50, yPos);
      yPos += 12;
    });
    
    // Benchmarks Section
    yPos += 30;
    doc.fontSize(16).text('Performance Benchmarks', 50, yPos);
    yPos += 20;
    
    doc.fontSize(12).text('Industry Benchmarks:', 50, yPos);
    yPos += 15;
    doc.fontSize(10).text(`Governance Participation: ${benchmarks.industry.avgGovernanceParticipation}%`, 70, yPos);
    yPos += 12;
    doc.text(`Proposal Success Rate: ${benchmarks.industry.avgProposalSuccessRate}%`, 70, yPos);
    yPos += 12;
    doc.text(`Treasury Growth: ${benchmarks.industry.avgTreasuryGrowth}%`, 70, yPos);
    
    doc.end();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF report',
      error: error.message
    });
  }
});

// GET /api/analytics/live - Live metrics with WebSocket support
router.get('/live', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.query;
    
    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    // Send initial data
    const sendMetrics = async () => {
      try {
        const metrics = await analyticsService.getRealTimeMetrics(daoId as string);
        res.write(`data: ${JSON.stringify({
          type: 'metrics',
          data: metrics,
          timestamp: new Date().toISOString()
        })}\n\n`);
      } catch (error) {
        console.error('Error sending live metrics:', error);
      }
    };
    
    // Send initial metrics
    await sendMetrics();
    
    // Update every 30 seconds
    const interval = setInterval(sendMetrics, 30000);
    
    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(interval);
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to start live metrics stream',
      error: error.message
    });
  }
});

// GET /api/analytics/dao/:daoId/summary - DAO-specific analytics summary
router.get('/dao/:daoId/summary', isAuthenticated, async (req, res) => {
  try {
    const { daoId } = req.params;
    const { period = 'month' } = req.query;
    
    const [metrics, historical] = await Promise.all([
      analyticsService.getRealTimeMetrics(daoId),
      analyticsService.getHistoricalData(period as any, daoId)
    ]);
    
    // Calculate growth rates
    const currentMetrics = historical[historical.length - 1];
    const previousMetrics = historical[historical.length - 2];
    
    let growthRates = {};
    if (currentMetrics && previousMetrics) {
      growthRates = {
        userGrowth: ((currentMetrics.userCount - previousMetrics.userCount) / previousMetrics.userCount) * 100,
        proposalGrowth: ((currentMetrics.proposalCount - previousMetrics.proposalCount) / (previousMetrics.proposalCount || 1)) * 100,
        volumeGrowth: ((currentMetrics.transactionVolume - previousMetrics.transactionVolume) / (previousMetrics.transactionVolume || 1)) * 100
      };
    }
    
    res.json({
      success: true,
      data: {
        metrics,
        historical,
        growthRates,
        period
      },
      daoId
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch DAO analytics summary',
      error: error.message
    });
  }
});

export default router;
