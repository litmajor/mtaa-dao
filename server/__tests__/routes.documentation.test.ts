import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import exportRoutes from '../../scripts/exportRoutes.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('route documentation exporter', () => {
  it('preserves named parameters in nested router mounts and states middleware scope', () => {
    const app = express();
    const daoRouter = express.Router();
    const scopedRouter = express.Router();
    scopedRouter.get('/members/:memberId', function authenticate() {}, function handler() {});
    daoRouter.use('/:daoId', scopedRouter);
    app.use('/api/v1/daos', daoRouter);
    const outputDirectory = mkdtempSync(path.join(os.tmpdir(), 'route-map-'));
    temporaryDirectories.push(outputDirectory);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = exportRoutes(app, outputDirectory);

    expect(result?.endpoints).toContainEqual(expect.objectContaining({
      path: '/api/v1/daos/:daoId/members/:memberId',
      methods: 'GET',
      middlewareCount: 2,
      middlewareScope: expect.stringContaining('Direct route handlers only'),
      domain: 'daos',
      fullDomain: '/api/v1/daos',
    }));
  });
});
