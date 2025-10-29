/**
 * Response templates for different intents
 * 
 * Supports English and Swahili phrases for localized responses
 */

export const onboardingGuides = {
  tour: `🎯 **Welcome to MtaaDAO!** Let me show you around:

**1. Dashboard** 📊
   Your central hub for DAO activities and metrics

**2. Proposals** 📝
   Create and vote on community decisions

**3. Treasury** 💰
   Manage shared funds and track spending

**4. Wallet** 👛
   Your personal vault and transactions

**5. Analytics** 📈
   Insights and community metrics

Click on any section in the navigation to explore, or ask me specific questions!`,

  proposals: `📝 **Creating Proposals:**

1. Go to the Proposals page
2. Click "Create Proposal"
3. Fill in:
   • Title (clear and concise)
   • Description (explain the purpose)
   • Amount (if requesting funds)
   • Duration (voting period)
4. Submit for community review

**Pro tip:** Include detailed reasoning to get more support!`,

  voting: `🗳️ **How to Vote:**

1. Browse active proposals
2. Click on a proposal to view details
3. Review the description and impact
4. Cast your vote: For, Against, or Abstain
5. Add an optional comment explaining your choice

Your voting power is based on your DAO membership and contributions!`,

  treasury: `💰 **Treasury Basics:**

The treasury is our shared fund that:
• Holds community contributions
• Funds approved proposals
• Tracks all transactions
• Generates yield through vaults

You can:
✅ View balance and history
✅ Deposit funds
✅ Propose withdrawals
✅ Track analytics`
};

export const responses = {
  friendly: {
    text: "I'm Morio, your friendly DAO assistant! How can I help you today? You can ask me about treasury, proposals, voting, or analytics."
  },
  withdraw: {
    text: "I'll help you withdraw {amount} {currency} from the DAO treasury. To proceed, you'll need to create a withdrawal proposal that members can vote on. This ensures transparency and community approval."
  },

  deposit: {
    text: "Great! I can help you deposit {amount} {currency} to the DAO treasury. Your contribution will increase your participation score and voting power. Ready to proceed?"
  },

  check_balance: {
    text: "Let me fetch the current DAO treasury balance and your personal contribution status. One moment..."
  },

  submit_proposal: {
    text: "I'll guide you through creating a new proposal. You'll need to provide: (1) A clear title, (2) Detailed description, (3) Funding amount if applicable. What would you like to propose?"
  },

  vote: {
    text: "I'll help you vote on proposal #{proposalId}. You can vote 'Yes' to approve, 'No' to reject, or 'Abstain' to skip. Would you like to see the proposal details first?"
  },

  check_proposal: {
    text: "Let me show you the active proposals in your DAO. You can view details, discussions, and vote on any of them."
  },

  join_dao: {
    text: "Welcome! I'll help you join this DAO. You'll need to: (1) Connect your wallet, (2) Review the DAO guidelines, (3) Complete your profile. Ready to start?"
  },

  help: {
    text: "Karibu (welcome)! I'm Morio, your DAO assistant. I can help you with:\n\n💰 Treasury: Check balance, deposit, withdraw\n📝 Governance: Create proposals, vote, view results\n👥 Community: Member stats, contributions, analytics\n📊 Analytics: Treasury reports, voting insights\n\nWhat would you like to do?"
  },

  analytics: {
    text: "I can provide detailed analytics on:\n\n• Treasury health and financial metrics\n• Governance participation and voting patterns\n• Community growth and engagement\n\nWhich analysis would you like to see?"
  },

  community_stats: {
    text: "Let me pull up the community statistics for you, including member count, engagement rates, and contribution metrics..."
  },

  treasury_report: {
    text: "Generating treasury report with current balance, inflows, outflows, and runway projections..."
  },

  governance_info: {
    text: "Here's how governance works in this DAO:\n\n1. Members can create proposals\n2. Proposals need minimum quorum to pass\n3. Voting power is based on contribution score\n4. Approved proposals are executed by the treasury\n\nWant to learn more about any specific aspect?"
  },

  unknown: {
    text: "Samahani (sorry), I didn't quite understand that. Could you rephrase? I can help you with treasury operations, proposals, voting, and DAO analytics."
  },

  default: {
    text: "I'm here to help! You can ask me about:\n\n• Checking balances\n• Making deposits or withdrawals\n• Creating and voting on proposals\n• Viewing DAO analytics\n• Community information\n\nWhat would you like to know?"
  }
};

// Swahili translations for common phrases
export const swahiliPhrases = {
  greetings: {
    hello: 'Habari',
    welcome: 'Karibu',
    howAreYou: 'Mambo?'
  },
  responses: {
    thanks: 'Asante',
    sorry: 'Samahani',
    yes: 'Ndio',
    no: 'Hapana',
    okay: 'Sawa'
  },
  actions: {
    deposit: 'Weka pesa',
    withdraw: 'Toa pesa',
    vote: 'Piga kura',
    check: 'Angalia'
  }
};