import { t } from './uiLabels';

describe('uiLabels mapping', () => {
  test('dao maps to Chama', () => {
    expect(t('dao')).toBe('Chama');
  });

  test('proposals maps to Decisions', () => {
    expect(t('proposals')).toBe('Decisions');
  });

  test('proposal maps to Decision', () => {
    expect(t('proposal')).toBe('Decision');
  });
});
