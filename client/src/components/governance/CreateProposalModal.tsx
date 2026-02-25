import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface CreateProposalModalProps {
  daoId: string;
  daoType: 'free' | 'short_term' | 'collective' | 'meta';
  userRole: 'member' | 'proposer' | 'elder' | 'admin';
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (proposalId: string) => void;
}

type ProposalType = 'general' | 'budget' | 'poll' | 'emergency';

export function CreateProposalModal({
  daoId,
  daoType,
  userRole,
  isOpen,
  onClose,
  onSuccess
}: CreateProposalModalProps) {
  const [step, setStep] = useState(1);
  const [proposalType, setProposalType] = useState<ProposalType | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [successProposalId, setSuccessProposalId] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check role permissions
  const canCreateProposal = ['proposer', 'elder', 'admin'].includes(userRole);
  const canCreateEmergency = ['elder', 'admin'].includes(userRole);

  // Create proposal mutation
  const createProposalMutation = useMutation({
    mutationFn: async (data: {
      proposalType: ProposalType;
      title: string;
      description: string;
    }) => {
      const response = await apiRequest(
        'POST',
        `/api/governance/${daoId}/proposals`,
        data
      );
      return response;
    },
    onSuccess: (data) => {
      setSuccessProposalId(data.proposalId);
      setStep(5);
      queryClient.invalidateQueries({ queryKey: [`/api/governance/${daoId}/proposals`] });
      toast('Proposal created successfully! 🎉');
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to create proposal');
      toast('Error creating proposal');
    }
  });

  if (!isOpen) return null;

  // ===== PERMISSION CHECK =====
  if (!canCreateProposal) {
    return (
      <PermissionDeniedModal
        daoType={daoType}
        userRole={userRole}
        onClose={onClose}
      />
    );
  }

  const handleNext = () => {
    if (step === 1 && !proposalType) {
      setError('Please select a proposal type');
      return;
    }
    if (step === 2 && !title.trim()) {
      setError('Title is required');
      return;
    }
    if (step === 2 && title.length > 100) {
      setError('Title too long (max 100 characters)');
      return;
    }
    if (step === 3 && !description.trim()) {
      setError('Please explain your proposal');
      return;
    }
    if (step === 3 && description.length > 500) {
      setError('Description too long (max 500 characters)');
      return;
    }

    setError('');
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    if (!proposalType || !title || !description) {
      setError('Missing required information');
      return;
    }
    createProposalMutation.mutate({
      proposalType,
      title: title.trim(),
      description: description.trim()
    });
  };

  const getAvailableProposalTypes = (): Array<{
    type: ProposalType;
    icon: string;
    title: string;
    subtitle: string;
    example: string;
    disabled: boolean;
  }> => {
    const types = [
      {
        type: 'general' as ProposalType,
        icon: '🤔',
        title: 'What should we do?',
        subtitle: 'Best for: General decisions',
        example: 'Example: Change meeting time',
        disabled: false
      },
      {
        type: 'budget' as ProposalType,
        icon: '💰',
        title: 'How should we spend money?',
        subtitle: 'Best for: Treasury decisions',
        example: 'Example: Buy equipment',
        disabled: ['free'].includes(daoType)
      },
      {
        type: 'poll' as ProposalType,
        icon: '🗣️',
        title: 'Quick question for the group',
        subtitle: 'Best for: Feedback & ideas',
        example: 'Example: Which book next month?',
        disabled: false
      },
      {
        type: 'emergency' as ProposalType,
        icon: '⚡',
        title: 'Emergency decision (fast)',
        subtitle: 'Best for: Urgent matters',
        example: 'Example: Respond to crisis',
        disabled: !canCreateEmergency || ['free'].includes(daoType)
      }
    ];

    return types;
  };

  const wordCount = title.split(/\s+/).filter(w => w).length;
  const isLongTitle = wordCount > 10;

  // ===== STEP 1: PROPOSAL TYPE =====
  if (step === 1) {
    const availableTypes = getAvailableProposalTypes();

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-screen overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <h2 className="text-xl font-bold mb-2">Create a Proposal</h2>
            <p className="text-sm text-gray-600 mb-6">
              📌 <strong>What do you want to propose?</strong>
              <br />
              ⓘ Everyone votes on your idea
            </p>

            {/* Progress */}
            <div className="mb-6">
              <div className="text-xs text-gray-500 font-semibold">Step 1 of 4</div>
              <div className="mt-2 bg-gray-200 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full w-1/4 transition-all"></div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Proposal Types */}
            <div className="space-y-3 mb-8">
              {availableTypes.map((typeOption) => (
                <ProposalTypeCard
                  key={typeOption.type}
                  icon={typeOption.icon}
                  title={typeOption.title}
                  subtitle={typeOption.subtitle}
                  example={typeOption.example}
                  selected={proposalType === typeOption.type}
                  onClick={() => {
                    setProposalType(typeOption.type);
                    setError('');
                  }}
                  disabled={typeOption.disabled}
                />
              ))}
            </div>

            {/* Footer */}
            <Button
              onClick={handleNext}
              disabled={!proposalType}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-semibold py-3"
            >
              Next <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ===== STEP 2: TITLE =====
  if (step === 2) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <div className="p-6">
            {/* Header */}
            <h2 className="text-xl font-bold mb-2">Give it a title</h2>

            {/* Progress */}
            <div className="mb-6">
              <div className="text-xs text-gray-500 font-semibold">Step 2 of 4</div>
              <div className="mt-2 bg-gray-200 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full w-2/4 transition-all"></div>
              </div>
            </div>

            {/* Instructions */}
            <p className="text-sm text-gray-600 mb-4">
              Keep it short (1-10 words). Make it clear what you're proposing.
            </p>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Input */}
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError('');
              }}
              placeholder="e.g., 'Change meeting time to 8 PM'"
              maxLength={100}
              className="w-full border-2 border-gray-300 rounded-lg p-3 mb-2 focus:border-blue-500 focus:outline-none text-sm"
            />

            {/* Character count & warning */}
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs text-gray-500">
                {title.length}/100 characters
              </span>
              {isLongTitle && (
                <span className="text-xs text-orange-600">
                  💡 Tip: Try to keep under 15 words
                </span>
              )}
            </div>

            {/* Word count feedback */}
            {isLongTitle && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                <strong>Example:</strong> Instead of "{title}", try "Change meeting to 8 PM"
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-3">
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                className="flex-1"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={!title.trim()}
                className="flex-1 bg-blue-500 hover:bg-blue-600"
              >
                Next <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ===== STEP 3: DESCRIPTION =====
  if (step === 3) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-screen overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <h2 className="text-xl font-bold mb-2">Explain your idea</h2>

            {/* Progress */}
            <div className="mb-6">
              <div className="text-xs text-gray-500 font-semibold">Step 3 of 4</div>
              <div className="mt-2 bg-gray-200 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full w-3/4 transition-all"></div>
              </div>
            </div>

            {/* Instructions */}
            <p className="text-sm text-gray-600 mb-2">
              Help people understand your proposal. Explain:
            </p>
            <ul className="text-sm text-gray-600 mb-4 ml-4 space-y-1">
              <li>✓ <strong>What</strong> you're proposing</li>
              <li>✓ <strong>Why</strong> it matters</li>
              <li>✓ <strong>How</strong> it will help</li>
            </ul>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Textarea */}
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setError('');
              }}
              placeholder="Explain your proposal here..."
              maxLength={500}
              rows={6}
              className="w-full border-2 border-gray-300 rounded-lg p-3 mb-2 focus:border-blue-500 focus:outline-none text-sm resize-none"
            />

            {/* Character count */}
            <div className="text-xs text-gray-500 mb-4">
              {description.length}/500 characters
            </div>

            {/* Good example */}
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
              <strong className="text-green-700">Good explanation:</strong>
              <p className="text-green-700 mt-1">
                "Our meetings are too early. If we move to 8 PM, people with day jobs can come. We tried asking - 5 people said yes."
              </p>
            </div>

            {/* Footer */}
            <div className="flex gap-3">
              <Button
                onClick={() => setStep(2)}
                variant="outline"
                className="flex-1"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={!description.trim()}
                className="flex-1 bg-blue-500 hover:bg-blue-600"
              >
                Next <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ===== STEP 4: REVIEW =====
  if (step === 4) {
    const getProposalTypeLabel = (type: string) => {
      const labels: Record<string, string> = {
        general: 'What should we do?',
        budget: 'How should we spend money?',
        poll: 'Quick question for the group',
        emergency: 'Emergency decision (fast)'
      };
      return labels[type] || type;
    };

    const getVotingDetails = () => {
      return {
        votingDays: proposalType === 'emergency' ? 1 : 3,
        quorumPercent: proposalType === 'emergency' ? 15 : 20,
        approvalPercent: proposalType === 'emergency' ? 50 : 50,
        voters: 'Anyone in the group'
      };
    };

    const votingDetails = getVotingDetails();

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-screen overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <h2 className="text-xl font-bold mb-2">Review & Post</h2>

            {/* Progress */}
            <div className="mb-6">
              <div className="text-xs text-gray-500 font-semibold">Step 4 of 4</div>
              <div className="mt-2 bg-gray-200 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full w-full transition-all"></div>
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Type</p>
                  <p className="text-sm font-semibold">{getProposalTypeLabel(proposalType!)}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Title</p>
                  <p className="text-sm font-semibold">{title}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Details</p>
                  <p className="text-sm text-gray-700">{description.substring(0, 60)}...</p>
                </div>
              </div>
            </div>

            {/* Voting Details */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
              <p className="text-sm font-semibold text-gray-900 mb-3">Voting Details</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Days to vote:</span>
                  <span className="font-semibold">{votingDetails.votingDays} day{votingDetails.votingDays > 1 ? 's' : ''}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Need to vote:</span>
                  <span className="font-semibold">{votingDetails.quorumPercent}% of members</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">To pass:</span>
                  <span className="font-semibold">{votingDetails.approvalPercent}% must say YES</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Who votes:</span>
                  <span className="font-semibold">{votingDetails.voters}</span>
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <p className="text-xs text-gray-600 mb-6 p-3 bg-blue-50 rounded-lg border border-blue-100">
              By posting this proposal, you agree to let members vote on your idea.
            </p>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-3">
              <Button
                onClick={() => setStep(3)}
                variant="outline"
                className="flex-1"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createProposalMutation.isPending}
                className="flex-1 bg-green-500 hover:bg-green-600"
              >
                {createProposalMutation.isPending ? '⏳ Posting...' : 'Post Proposal'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ===== STEP 5: SUCCESS =====
  if (step === 5) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <div className="p-6 text-center">
            <div className="mb-4 text-5xl">✅</div>
            <h2 className="text-2xl font-bold mb-2">Your proposal is live!</h2>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-6">
              <p className="text-sm font-semibold text-gray-900">{title}</p>
            </div>

            <p className="text-gray-700 mb-2">People can start voting now.</p>
            <p className="text-sm text-gray-500 mb-6">Results in 3 days.</p>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  onSuccess(successProposalId);
                  onClose();
                }}
                className="flex-1 bg-blue-500 hover:bg-blue-600"
              >
                View Proposal
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1"
              >
                Back to DAO
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}

// ===== HELPER COMPONENTS =====

interface ProposalTypeCardProps {
  icon: string;
  title: string;
  subtitle: string;
  example: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function ProposalTypeCard({
  icon,
  title,
  subtitle,
  example,
  selected,
  onClick,
  disabled
}: ProposalTypeCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
        disabled
          ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
          : selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <p className="font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-600 mt-1">{subtitle}</p>
          <p className="text-xs text-gray-500 mt-2">{example}</p>
        </div>
        <div
          className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 flex items-center justify-center transition-all ${
            selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 bg-white'
          }`}
        >
          {selected && <div className="w-2 h-2 bg-white rounded-full" />}
        </div>
      </div>
    </button>
  );
}

interface PermissionDeniedModalProps {
  daoType: string;
  userRole: string;
  onClose: () => void;
}

function PermissionDeniedModal({ daoType, userRole, onClose }: PermissionDeniedModalProps) {
  const roleNames: Record<string, string> = {
    member: 'Member',
    proposer: 'Proposer',
    elder: 'Elder',
    admin: 'Admin'
  };

  const nextRole: Record<string, string> = {
    member: 'Proposer',
    proposer: 'Elder',
    elder: 'Admin',
    admin: 'Admin'
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <div className="p-6 text-center">
          <div className="mb-4 text-5xl">🔒</div>
          <h2 className="text-xl font-bold mb-4">You can't create proposals yet</h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-gray-700">
              <strong>Your role:</strong> {roleNames[userRole]}
            </p>
            <p className="text-sm text-gray-700 mt-2">
              <strong>Needed to propose:</strong> {nextRole[userRole]} or higher
            </p>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            Members can't create proposals yet. Show activity and get promoted by a leader, or continue voting on other proposals.
          </p>

          <Button
            onClick={onClose}
            className="w-full bg-blue-500 hover:bg-blue-600"
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
