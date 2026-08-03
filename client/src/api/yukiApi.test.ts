import { describe, expect, it } from 'vitest';
import { normalizeBacktestJobResponse } from './yukiApi';

describe('normalizeBacktestJobResponse', () => {
  it('unwraps axios-style payloads and preserves polling links', () => {
    const result = normalizeBacktestJobResponse({
      data: {
        success: true,
        data: {
          jobId: 'job-123',
          status: 'queued',
          statusUrl: '/api/jobs/job-123/status',
          resultUrl: '/api/jobs/job-123/result',
          streamUrl: '/api/jobs/job-123/stream',
        },
      },
    });

    expect(result).toEqual({
      jobId: 'job-123',
      status: 'queued',
      statusUrl: '/api/jobs/job-123/status',
      resultUrl: '/api/jobs/job-123/result',
      streamUrl: '/api/jobs/job-123/stream',
    });
  });

  it('handles a raw payload directly', () => {
    const result = normalizeBacktestJobResponse({
      success: true,
      data: {
        jobId: 'job-456',
        status: 'processing',
        statusUrl: '/api/jobs/job-456/status',
        resultUrl: '/api/jobs/job-456/result',
        streamUrl: '/api/jobs/job-456/stream',
      },
    });

    expect(result).toEqual({
      jobId: 'job-456',
      status: 'processing',
      statusUrl: '/api/jobs/job-456/status',
      resultUrl: '/api/jobs/job-456/result',
      streamUrl: '/api/jobs/job-456/stream',
    });
  });
});
