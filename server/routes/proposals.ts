


// Emoji voting endpoint
router.post('/:proposalId/emoji-vote', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { vote, isAnonymous } = req.body;
    const userId = (req.user as any)?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!['yes', 'maybe', 'no'].includes(vote)) {
      return res.status(400).json({ error: 'Invalid vote option' });
    }

    // Check if already voted
    const existing = await db.query.votes.findFirst({
      where: and(
        eq(votes.proposalId, proposalId),
        eq(votes.userId, userId)
      )
    });

    if (existing) {
      return res.status(400).json({ error: 'Already voted on this proposal' });
    }

    // Record vote
    await db.insert(votes).values({
      proposalId,
      userId: isAnonymous ? 'anonymous' : userId,
      daoId: req.body.daoId || '',
      voteType: vote,
      votingPower: '1',
      metadata: { isAnonymous, originalUserId: isAnonymous ? userId : undefined }
    });

    // Update proposal counts
    const updateField = vote === 'yes' ? 'yesVotes' : vote === 'no' ? 'noVotes' : 'abstainVotes';
    await db.update(proposals)
      .set({ [updateField]: sql`${proposals[updateField]} + 1` })
      .where(eq(proposals.id, proposalId));

    res.json({ success: true, vote, isAnonymous });
  } catch (error) {
    console.error('Emoji vote error:', error);
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});
