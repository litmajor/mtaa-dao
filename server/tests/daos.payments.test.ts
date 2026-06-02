import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';

// Ensure JWT env vars exist so auth module doesn't throw on import
process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refreshsecret';

// Mock authenticate to allow requests during tests
const authModulePath = require.resolve('../auth');
jest.mock(authModulePath, () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user', claims: { sub: 'test-user', role: 'member' } };
    return next();
  }
}));

let app: express.Express;
beforeAll(() => {
  // Import router after mocks are set
  const daosRouter = require('../routes/daos').default || require('../routes/daos');
  app = express();
  app.use(bodyParser.json());
  app.use('/api/daos', daosRouter);
});

describe('DAOs payments endpoints', () => {
  it('rejects invalid record payload', async () => {
    const res = await request(app).post('/api/daos/test-dao/payments/record').send({});
    expect(res.status).toBe(400);
  });

  // Additional tests could be added with DB mocks and fixtures
});
