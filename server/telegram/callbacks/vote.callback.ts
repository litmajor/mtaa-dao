import { db } from '../../db';
import { daos, daoMemberships, proposals, users, votes } from '../../../shared/schema';
import { and, eq } from 'drizzle-orm';

interface TelegramCallbackQuery {
  id: string;
  from: { id: number };
  message?: { chat: { id: number }; message_id: number };
  data?: string;
}

interface VoteCallbackResult {
  text: string;
  showAlert?: boolean;
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function answerCallbackQuery(queryId: string, result: VoteCallbackResult): Promise<void> {
  const response = await fetch(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: queryId, ...result }),
  });

  if (!response.ok) {
    throw new Error(`Telegram callback response failed: ${response.status}`);
  }
}

export async function handleVoteCallback(query: TelegramCallbackQuery): Promise<VoteCallbackResult> {
  const match = /^vote_(yes|no|abstain)_([0-9a-f-]{36})$/i.exec(query.data || '');
  if (!match) {
    return { text: 'Unsupported vote action.', showAlert: true };
  }

  const voteType = match[1].toLowerCase();
  const proposalId = match[2];
  const telegramId = String(query.from.id);

  const user = await db.query.users.findFirst({ where: eq(users.telegramChatId, telegramId) });
  if (!user) return { text: 'Link your MtaaDAO account before voting.', showAlert: true };

  const proposal = await db.query.proposals.findFirst({ where: eq(proposals.id, proposalId) });
  if (!proposal || proposal.status !== 'active') {
    return { text: 'This proposal is no longer open for voting.', showAlert: true };
  }

  if (proposal.voteEndTime && new Date(proposal.voteEndTime).getTime() <= Date.now()) {
    return { text: 'Voting on this proposal has ended.', showAlert: true };
  }

  const membership = await db.query.daoMemberships.findFirst({
    where: and(
      eq(daoMemberships.daoId, proposal.daoId),
      eq(daoMemberships.userId, user.id),
      eq(daoMemberships.status, 'approved'),
      eq(daoMemberships.isBanned, false),
    ),
  });
  if (!membership) return { text: 'You are not an active member of this DAO.', showAlert: true };

  const votingPower = Number(user.votingPower || '1');
  if (!Number.isFinite(votingPower) || votingPower <= 0) {
    return { text: 'You do not have voting power for this proposal.', showAlert: true };
  }

  const existingVote = await db.query.votes.findFirst({
    where: and(eq(votes.proposalId, proposalId), eq(votes.userId, user.id)),
  });
  if (existingVote) return { text: 'You have already voted on this proposal.', showAlert: true };

  await db.transaction(async (tx) => {
    await tx.insert(votes).values({
      proposalId,
      userId: user.id,
      daoId: proposal.daoId,
      voteType,
      weight: '1.00',
      votingPower: String(votingPower),
      isDelegated: false,
    });

    const countField = voteType === 'yes' ? 'yesVotes' : voteType === 'no' ? 'noVotes' : 'abstainVotes';
    const currentCount = Number(proposal[countField] || 0);
    await tx.update(proposals)
      .set({ [countField]: currentCount + 1, updatedAt: new Date() })
      .where(eq(proposals.id, proposalId));
  });

  return { text: `Vote recorded: ${voteType === 'yes' ? 'Yes' : voteType === 'no' ? 'No' : 'Abstain'}.` };
}

export async function processVoteCallback(query: TelegramCallbackQuery): Promise<void> {
  try {
    const result = await handleVoteCallback(query);
    await answerCallbackQuery(query.id, result);
  } catch (error) {
    console.error('Telegram vote callback error:', error);
    await answerCallbackQuery(query.id, { text: 'Unable to record your vote. Please try again.', showAlert: true }).catch(() => undefined);
  }
}

export type { TelegramCallbackQuery };
