


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

    // Get proposal details for activity award
    const proposalData = await db.query.proposals.findFirst({
      where: eq(proposals.id, proposalId)
    });

    // Record vote (only happens once per user per proposal - DB constraint)
    await db.insert(votes).values({
      proposalId,
      userId: isAnonymous ? 'guest' : userId,
      daoId: req.body.daoId || proposalData?.daoId || '',
      voteType: vote,
      votingPower: '1',
      metadata: { isAnonymous, originalUserId: isAnonymous ? userId : undefined }
    });

    // Update proposal counts
    const updateField = vote === 'yes' ? 'yesVotes' : vote === 'no' ? 'noVotes' : 'abstainVotes';
    await db.update(proposals)
      .set({ [updateField]: sql`${proposals[updateField]} + 1` })
      .where(eq(proposals.id, proposalId));

    // Award activity points (fire and forget)
    // Points are awarded once per vote since votes are unique per user per proposal (enforced by DB)
    if (!isAnonymous && proposalData?.daoId) {
      const { awardActivityDirect } = await import('../services/activity-award-helper');
      awardActivityDirect({
        userId,
        daoId: proposalData.daoId,
        type: 'vote' as any,
        description: `Voted ${vote} on proposal: ${proposalData.title || proposalId}`,
        metadata: { proposalId, vote },
      }).catch((error) => {
        console.error('Error awarding activity for vote:', error);
      });
    }

    res.json({ success: true, vote, isAnonymous, pointsAwarded: !isAnonymous ? 5 : 0 });
  } catch (error) {
    console.error('Emoji vote error:', error);
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});
