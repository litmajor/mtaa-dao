import { describe, expect, it } from 'vitest';
import { daoDeploySchema } from '../validators/dao_deploy';

describe('DAO deployment validation', () => {
  it('preserves the fixed KES contribution in merry-go-round requests', () => {
    const parsed = daoDeploySchema.parse({
      daoData: {
        name: 'Weekly Chama',
        daoType: 'merryGoRound',
        rotationFrequency: 'weekly',
        rotationContributionAmountKes: 1200,
      },
      founderWallet: '0x0000000000000000000000000000000000000001',
      selectedElders: ['00000000-0000-4000-8000-000000000001'],
    });

    expect(parsed.daoData.rotationContributionAmountKes).toBe(1200);
  });

  it('rejects fractional or out-of-range fixed KES contributions', () => {
    const request = {
      daoData: {
        name: 'Weekly Chama',
        daoType: 'merryGoRound',
        rotationContributionAmountKes: 1200.5,
      },
      founderWallet: '0x0000000000000000000000000000000000000001',
      selectedElders: ['00000000-0000-4000-8000-000000000001'],
    };

    expect(daoDeploySchema.safeParse(request).success).toBe(false);
    expect(daoDeploySchema.safeParse({
      ...request,
      daoData: {
        ...request.daoData,
        rotationContributionAmountKes: 2_147_483_648,
      },
    }).success).toBe(false);
  });
});
