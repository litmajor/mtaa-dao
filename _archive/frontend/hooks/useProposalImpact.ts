import { useState, useCallback, useEffect } from 'react';

interface ImpactChange {
  metric: string;
  current: string;
  proposed: string;
  change: string;
}

interface Impact {
  summary: string;
  changes: ImpactChange[];
  risks: string[];
  benefits: string[];
}

interface ProposalVoteData {
  proposalId: string;
  vote: 'yes' | 'no' | 'abstain';
}

interface ProposalImpactState {
  loading: boolean;
  error: string | null;
  impactData: {
    impactIfYes: Impact;
    impactIfNo: Impact;
  } | null;
  submitting: boolean;
  submitted: boolean;
}

export function useProposalImpact(proposalId: string) {
  const [state, setState] = useState<ProposalImpactState>({
    loading: true,
    error: null,
    impactData: null,
    submitting: false,
    submitted: false
  });

  // Fetch proposal impact data
  useEffect(() => {
    const fetchImpact = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));

        // Mock API call - replace with real endpoint
        const response = await new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              impactIfYes: {
                summary: 'If this proposal passes, the DAO will increase its treasury allocation toward sustainability initiatives by 25%, resulting in increased long-term viability.',
                changes: [
                  {
                    metric: 'Treasury Allocation',
                    current: '60% Operations, 40% Reserve',
                    proposed: '60% Operations, 35% Reserve, 25% Sustainability',
                    change: '+25% Sustainability'
                  },
                  {
                    metric: 'Annual Budget',
                    current: '$2.4M',
                    proposed: '$2.9M',
                    change: '+$500K'
                  }
                ],
                benefits: [
                  'Stronger long-term sustainability positioning',
                  'Attracts environmental-conscious partners',
                  'Competitive advantage in market',
                  'Demonstrates governance maturity'
                ],
                risks: [
                  'Requires approval from compliance team',
                  'May impact short-term operational funds',
                  'Needs executive sponsor assignment'
                ]
              },
              impactIfNo: {
                summary: 'If this proposal fails, current resource allocation will remain unchanged, maintaining the status quo for sustainability initiatives.',
                changes: [
                  {
                    metric: 'Treasury Allocation',
                    current: '60% Operations, 40% Reserve',
                    proposed: '60% Operations, 40% Reserve (unchanged)',
                    change: 'No change'
                  }
                ],
                benefits: [
                  'Maintains current operational stability',
                  'Preserves contingency reserves',
                  'No compliance re-review needed'
                ],
                risks: [
                  'Missed opportunity for growth',
                  'Competitors may capture market share',
                  'May be seen as lack of vision'
                ]
              }
            });
          }, 800);
        });

        setState(prev => ({
          ...prev,
          loading: false,
          impactData: response as any
        }));
      } catch (err) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to load proposal impact data'
        }));
      }
    };

    fetchImpact();
  }, [proposalId]);

  const submitVote = useCallback(async (vote: 'yes' | 'no' | 'abstain') => {
    try {
      setState(prev => ({ ...prev, submitting: true, error: null }));

      // Mock API call - replace with real endpoint
      const response = await new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true, transactionHash: '0x' + Math.random().toString(16).slice(2) });
        }, 1500);
      });

      setState(prev => ({
        ...prev,
        submitting: false,
        submitted: true
      }));

      return response;
    } catch (err) {
      setState(prev => ({
        ...prev,
        submitting: false,
        error: 'Failed to submit vote. Please try again.'
      }));
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      submitted: false,
      error: null
    }));
  }, []);

  return {
    ...state,
    submitVote,
    reset
  };
}
