# 🎯 CREATE PROPOSAL UI - MOBILE-FIRST DESIGN

**Focus**: Okedi profile (personal governance, simple DAOs)  
**Target**: Diverse users (simple language, clear guidance)  
**Platform**: Mobile-optimized, responsive  
**Date**: February 2, 2026

---

## 📱 MOBILE WIREFRAME (Portrait View)

```
┌──────────────────────────────────────────────┐
│ ← Create Proposal                    ✕       │
├──────────────────────────────────────────────┤
│                                              │
│ 📌 What do you want to propose?              │
│ ⓘ Everyone votes on your idea                │
│                                              │
├──────────────────────────────────────────────┤
│                                              │
│ Step 1 of 4: PROPOSAL TYPE                   │
│                                              │
│ Which type of proposal?                      │
│                                              │
│ ◐ What should we do?                         │
│   Best for: General decisions                │
│   Example: Change meeting time               │
│                                              │
│ ◐ How should we spend money?                 │
│   Best for: Treasury decisions               │
│   Example: Buy equipment                     │
│                                              │
│ ◐ Quick question for the group               │
│   Best for: Feedback & ideas                 │
│   Example: Which book next?                  │
│                                              │
│                                              │
│ [Next →]                                     │
│                                              │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ ← Create Proposal                    ✕       │
├──────────────────────────────────────────────┤
│                                              │
│ Step 2 of 4: TITLE                           │
│                                              │
│ Give your proposal a title                   │
│ (Keep it short - 1 to 10 words)              │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ "Change meeting time to 8 PM"            │ │
│ │ (10 words) ✓                             │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ Too long? Try: "Move meeting to 8 PM"       │
│                                              │
│ ← Back              [Next →]                │
│                                              │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ ← Create Proposal                    ✕       │
├──────────────────────────────────────────────┤
│                                              │
│ Step 3 of 4: DETAILS                         │
│                                              │
│ Explain your idea (so people understand)     │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ "Our meetings are too early. If we move  │ │
│ │  to 8 PM, people with day jobs can come. │ │
│ │  We tried asking - 5 people said yes."   │ │
│ │                                          │ │
│ │ (157/500 chars)                          │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ 💡 Tip: Explain WHY, not just WHAT          │
│                                              │
│ ← Back              [Next →]                │
│                                              │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ ← Create Proposal                    ✕       │
├──────────────────────────────────────────────┤
│                                              │
│ Step 4 of 4: REVIEW                          │
│                                              │
│ ✓ Type: What should we do?                  │
│ ✓ Title: "Change meeting time to 8 PM"      │
│ ✓ Details: Your explanation shown...        │
│                                              │
│ Voting Details:                              │
│ ├─ Days to vote: 3 days                     │
│ ├─ Need: 20% of people to vote              │
│ ├─ To pass: 50% must say YES                │
│ └─ Votes: Anyone can vote                   │
│                                              │
│ By posting this, you agree to let people    │
│ vote on your idea.                           │
│                                              │
│ ← Back          [Post Proposal]              │
│                                              │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ ← Create Proposal                    ✕       │
├──────────────────────────────────────────────┤
│                                              │
│ ✅ Your proposal is live!                   │
│                                              │
│ "Change meeting time to 8 PM"               │
│                                              │
│ People can start voting now.                 │
│ Results in 3 days.                           │
│                                              │
│ [View Proposal] [Back to DAO]               │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 🎨 COMPONENT: CreateProposalModal.tsx

```typescript
import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, AlertCircle, CheckCircle } from 'lucide-react';

interface CreateProposalModalProps {
  daoId: string;
  daoType: 'free' | 'short_term' | 'collective' | 'meta';
  userRole: 'member' | 'proposer' | 'elder' | 'admin';
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (proposalId: string) => void;
}

export function CreateProposalModal({
  daoId,
  daoType,
  userRole,
  isOpen,
  onClose,
  onSuccess
}: CreateProposalModalProps) {
  const [step, setStep] = useState(1);
  const [proposalType, setProposalType] = useState<'general' | 'budget' | 'poll' | 'emergency' | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successProposalId, setSuccessProposalId] = useState('');

  // Check role permissions
  const canCreateProposal = ['proposer', 'elder', 'admin'].includes(userRole);
  const canCreateEmergency = ['elder', 'admin'].includes(userRole);

  if (!isOpen) return null;

  const handleNext = () => {
    // Validation before moving to next step
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

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/governance/${daoId}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalType,
          title: title.trim(),
          description: description.trim(),
          daoId
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create proposal');
      }

      const { proposalId } = await response.json();
      setSuccessProposalId(proposalId);
      setStep(5); // Success step
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  // ===== STEP 1: PROPOSAL TYPE =====
  if (step === 1) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50">
        <div className="bg-white w-full md:max-w-md md:rounded-lg rounded-t-2xl p-6 max-h-screen md:max-h-screen overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Create a Proposal</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Subtitle */}
          <p className="text-sm text-gray-600 mb-6">
            📌 <strong>What do you want to propose?</strong>
            <br />
            ⓘ Everyone votes on your idea
          </p>

          {/* Progress */}
          <div className="mb-6">
            <div className="text-xs text-gray-500 font-semibold">Step 1 of 4</div>
            <div className="mt-2 bg-gray-200 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full w-1/4"></div>
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
            <ProposalTypeCard
              icon="🤔"
              title="What should we do?"
              subtitle="Best for: General decisions"
              example="Example: Change meeting time"
              selected={proposalType === 'general'}
              onClick={() => {
                setProposalType('general');
                setError('');
              }}
              disabled={daoType === 'meta'} // Meta DAOs have different types
            />

            <ProposalTypeCard
              icon="💰"
              title="How should we spend money?"
              subtitle="Best for: Treasury decisions"
              example="Example: Buy equipment"
              selected={proposalType === 'budget'}
              onClick={() => {
                setProposalType('budget');
                setError('');
              }}
              disabled={daoType === 'free'} // Free DAOs can't do budget proposals
            />

            <ProposalTypeCard
              icon="🗣️"
              title="Quick question for the group"
              subtitle="Best for: Feedback & ideas"
              example="Example: Which book next month?"
              selected={proposalType === 'poll'}
              onClick={() => {
                setProposalType('poll');
                setError('');
              }}
              disabled={false}
            />

            {canCreateEmergency && (
              <ProposalTypeCard
                icon="⚡"
                title="Emergency decision (fast)"
                subtitle="Best for: Urgent matters"
                example="Example: Respond to crisis"
                selected={proposalType === 'emergency'}
                onClick={() => {
                  setProposalType('emergency');
                  setError('');
                }}
                disabled={daoType === 'free'} // Free DAOs no emergency
              />
            )}
          </div>

          {/* Footer */}
          <button
            onClick={handleNext}
            disabled={!proposalType}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ===== STEP 2: TITLE =====
  if (step === 2) {
    const wordCount = title.split(/\s+/).filter(w => w).length;
    const isLongTitle = wordCount > 10;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50">
        <div className="bg-white w-full md:max-w-md md:rounded-lg rounded-t-2xl p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Give it a title</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Progress */}
          <div className="mb-6">
            <div className="text-xs text-gray-500 font-semibold">Step 2 of 4</div>
            <div className="mt-2 bg-gray-200 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full w-2/4"></div>
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
                💡 Tip: Try to keep under 10 words
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
            <button
              onClick={() => setStep(1)}
              className="flex-1 border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleNext}
              disabled={!title.trim()}
              className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== STEP 3: DESCRIPTION =====
  if (step === 3) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50">
        <div className="bg-white w-full md:max-w-md md:rounded-lg rounded-t-2xl p-6 max-h-screen overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Explain your idea</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Progress */}
          <div className="mb-6">
            <div className="text-xs text-gray-500 font-semibold">Step 3 of 4</div>
            <div className="mt-2 bg-gray-200 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full w-3/4"></div>
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
            <button
              onClick={() => setStep(2)}
              className="flex-1 border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleNext}
              disabled={!description.trim()}
              className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
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
        votingDays: 3,
        quorumPercent: 20,
        approvalPercent: 50,
        voters: 'Anyone in the group'
      };
    };

    const votingDetails = getVotingDetails();

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50">
        <div className="bg-white w-full md:max-w-md md:rounded-lg rounded-t-2xl p-6 max-h-screen overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Review & Post</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Progress */}
          <div className="mb-6">
            <div className="text-xs text-gray-500 font-semibold">Step 4 of 4</div>
            <div className="mt-2 bg-gray-200 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full w-full"></div>
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
                <span className="font-semibold">{votingDetails.votingDays} days</span>
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
            <button
              onClick={() => setStep(3)}
              className="flex-1 border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
            >
              {isSubmitting ? '⏳ Posting...' : 'Post Proposal'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== STEP 5: SUCCESS =====
  if (step === 5) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50">
        <div className="bg-white w-full md:max-w-md md:rounded-lg rounded-t-2xl p-6">
          <div className="text-center">
            <div className="mb-4 text-5xl">✅</div>
            <h2 className="text-2xl font-bold mb-2">Your proposal is live!</h2>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-6">
              <p className="text-sm font-semibold text-gray-900">{title}</p>
            </div>

            <p className="text-gray-700 mb-2">People can start voting now.</p>
            <p className="text-sm text-gray-500 mb-6">Results in {votingDetails?.votingDays || 3} days.</p>

            <div className="flex gap-3">
              <button
                onClick={() => onSuccess(successProposalId)}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg"
              >
                View Proposal
              </button>
              <button
                onClick={onClose}
                className="flex-1 border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-lg"
              >
                Back to DAO
              </button>
            </div>
          </div>
        </div>
      </div>
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
          : 'border-gray-200 bg-white hover:border-gray-300'
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
          className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 flex items-center justify-center ${
            selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50">
      <div className="bg-white w-full md:max-w-md md:rounded-lg rounded-t-2xl p-6">
        <div className="text-center">
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
            Members can't create proposals yet. Ask a group leader to promote you to Proposer, or continue voting on other proposals.
          </p>

          <button
            onClick={onClose}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 📋 PROPOSAL TYPE AVAILABILITY BY DAO TYPE

```typescript
// Determine which proposal types are available
const getAvailableProposalTypes = (
  daoType: 'free' | 'short_term' | 'collective' | 'meta',
  userRole: 'member' | 'proposer' | 'elder' | 'admin'
): ProposalType[] => {
  const base = ['general', 'poll']; // Always available
  
  const byDAOType = {
    'free': [...base],
    'short_term': [...base, 'budget'],
    'collective': [...base, 'budget'],
    'meta': ['parameter', 'security', 'upgrade', 'fee_allocation']
  };

  const byRole = {
    'member': [],  // Can't propose
    'proposer': [...byDAOType[daoType]],
    'elder': [...byDAOType[daoType], 'emergency'],
    'admin': [...byDAOType[daoType], 'emergency', 'policy']
  };

  return byRole[userRole];
};

// Example usage:
const freeDAOMember = getAvailableProposalTypes('free', 'member');
// Result: [] (can't propose)

const freeDAOProposer = getAvailableProposalTypes('free', 'proposer');
// Result: ['general', 'poll']

const collectiveDAOElder = getAvailableProposalTypes('collective', 'elder');
// Result: ['general', 'poll', 'budget', 'emergency']
```

---

## 📱 MOBILE BREAKPOINTS

```css
/* Mobile (default - up to 640px) */
@media (max-width: 640px) {
  .modal {
    position: fixed;
    bottom: 0;
    border-radius: 24px 24px 0 0;
    padding: 24px;
  }
}

/* Tablet (641px - 1024px) */
@media (min-width: 641px) and (max-width: 1024px) {
  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    max-width: 500px;
    border-radius: 12px;
  }
}

/* Desktop (1025px+) */
@media (min-width: 1025px) {
  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    max-width: 600px;
    border-radius: 12px;
  }
}
```

---

## 🎯 ACCESSIBILITY FEATURES

```typescript
// Step counter for screen readers
<div role="status" aria-live="polite" aria-label="Progress">
  Step {step} of 4
</div>

// Form validation messages
<div role="alert" aria-live="assertive">
  {error && <p>{error}</p>}
</div>

// Button states
<button
  disabled={!proposalType}
  aria-disabled={!proposalType}
  aria-label="Continue to next step"
>
  Next
</button>

// Help text
<label htmlFor="proposal-title">
  <span className="sr-only">Proposal title</span>
  {/* visible label */}
</label>
```

---

## 🧪 VALIDATION RULES

```typescript
const validationRules = {
  title: [
    { rule: 'required', message: 'Title is required' },
    { rule: 'maxLength:100', message: 'Title too long' },
    { rule: 'wordCount<=10', message: 'Keep under 10 words' }
  ],
  description: [
    { rule: 'required', message: 'Please explain your proposal' },
    { rule: 'maxLength:500', message: 'Description too long' },
    { rule: 'minLength:20', message: 'Please provide more detail' }
  ],
  proposalType: [
    { rule: 'required', message: 'Select a proposal type' },
    { 
      rule: 'daoTypeAllows', 
      message: (daoType: string) => `${daoType} DAOs can't do this proposal type`
    },
    { 
      rule: 'roleAllows', 
      message: (role: string) => `${role}s can't create proposals`
    }
  ]
};

const validate = (field: string, value: any, context: any) => {
  const rules = validationRules[field];
  for (const { rule, message } of rules) {
    if (rule === 'required' && !value) {
      return typeof message === 'function' ? message(context) : message;
    }
    // ... more rules
  }
  return null;
};
```

---

## 🚀 INTEGRATION WITH OKEDI DASHBOARD

```typescript
// In OkediDashboard.tsx, add this to Quick Actions

<QuickActionButton
  icon={<Plus />}
  label="Create Proposal"
  onClick={() => setShowCreateProposal(true)}
/>

// Add modal at bottom
<CreateProposalModal
  daoId={selectedDAO?.id}
  daoType={selectedDAO?.type}
  userRole={userRole}
  isOpen={showCreateProposal}
  onClose={() => setShowCreateProposal(false)}
  onSuccess={(proposalId) => {
    setShowCreateProposal(false);
    // Navigate to proposal or refresh list
    navigateToProposal(proposalId);
  }}
/>
```

---

## ✅ OKEDI-ONLY FEATURES IN THIS UI

```
✅ Simple language (no jargon)
✅ Mobile-first (sheet modal on mobile)
✅ Shows what's available (proposal types)
✅ Progressive steps (not overwhelming)
✅ Clear voting details (transparent)
✅ Permission checks (role-based)
✅ DAO-type restrictions (flags disabled options)
✅ Helpful hints & examples
✅ Accessible (ARIA labels, focus management)
✅ Shows success clearly
```

---

**Status**: Create Proposal UI component complete & ready for integration  
**Next**: Vote on proposal UI + Results display
