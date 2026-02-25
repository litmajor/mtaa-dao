/**
 * Enhanced Swahili Translations for Morio
 * 
 * Provides high-quality Swahili responses for better language support
 * Covers common DAO operations and community interactions
 */

export const swahiliResponses = {
  // Greetings & Welcome
  greetings: {
    hello: 'Habari 👋',
    welcome: 'Karibu sana',
    welcome_back: 'Karibu tena! Ndiyo, tunakutaka',
    goodbye: 'Kwaheri! Tutaonana baadaye'
  },

  // General Responses
  general: {
    thanks: 'Asante sana!',
    sorry: 'Samahani, sikunimaini vizuri',
    yes: 'Ndio, hakika',
    no: 'Hapana, si wewe',
    okay: 'Sawa, tuendelee',
    understood: 'Nimeelewa vizuri',
    help_available: 'Mimi hapa kusaidia. Nini kinachohitajika?'
  },

  // Treasury Operations
  treasury: {
    check_balance: 'Hebu niangalie malundi ya hazina... Dakika moja.',
    balance_info: 'Hazina yetu inajumuisha {amount} {currency}. Tungoje rafiki!',
    deposit: 'Asante kwa mchango! Pesa yako itaongeza uzani wa kauli na alama za mchango.',
    withdraw: 'Kutoa pesa kunakadhi kupitia pendekezo linlo linalokamatiana na mtawanyiko. Hii inahakikisha baishwa na maamuzi ya jamii.',
    deposit_guide: '📝 **Namna ya Kuandika Pesa:**\n\n1. Jifungue akaunti yako\n2. Bonyeza "Weka Pesa"\n3. Ingiza kiasi\n4. Tekeleza malipo\n\n**Kidokezo:** Michango yako inaongeza uzani wa kura!',
    withdraw_guide: '🏦 **Namna ya Kutoa Pesa:**\n\n1. Jifungue akaunti yako\n2. Bonyeza "Toa Pesa"\n3. Ingiza kiasi\n4. Pendekeza mtendaji\n5. Ndefu inapiga kura\n6. Malipo yanafanywa\n\n**Kumbuka:** Mtendaji anapaswa kufa kabla ya kulipwa.',
    insufficient_balance: 'Samahani, hazina haina pesa za kutosha kwa ombi lako.',
    transaction_pending: 'Malipo yako yanakala. Tafadhali subiri muda...',
    transaction_complete: 'Heri yako! Malipo yakamilika.'
  },

  // Proposals
  proposals: {
    check_active: 'Hebu niangalie pendekezo linilo linazokamatiana na sasa...',
    create_guide: '📋 **Namna ya Kukamatia Pendekezo:**\n\n1. Nenda "Pendekezo"\n2. Bonyeza "Kamatia Pendekezo"\n3. Jaza:\n   • Kichwa (jambazi na rahisi)\n   • Maelezo (eleza matakwa)\n   • Kiasi (ikiwa kunakadhi fedha)\n   • Muda (kipindi cha kura)\n4. Wasilishe kwa mtawanyiko\n\n**Kidokezo:** Pendekezo linilo lina maelezo mazuri lapata kusaidia zaidi!',
    voting_guide: '🗳️ **Namna ya Kupiga Kura:**\n\n1. Angalia pendekezo\n2. Soma maelezo na matakwa\n3. Piga kura: Ndio, Hapana, au Kujiondoa\n4. Ongeza maoni (si lazima)\n\n**Jua:** Uzani wako unategemea mchango na alama za mchango!',
    proposal_created: 'Hongera! Pendekezo lako "{title}" limefungwa.',
    proposal_approved: '✅ Pendekezo "{title}" limekamatiana. Maendeleo yatafanywa sasa.',
    proposal_rejected: '❌ Samahani, pendekezo "{title}" halilipitika. Jaribu tena kukamatia.'
  },

  // Voting
  voting: {
    vote_cast: 'Asante kwa kupiga kura! Uzani wako umechakamatiana.',
    voting_open: '🗳️ Kura imebuniwa kwa pendekezo "{title}". Piga kura yako sasa!',
    voting_closed: 'Kura imezimwa kwa pendekezo hiki.',
    voting_power: 'Uzani wa kura wako: {power} kutoka jumla ya {total}',
    vote_results: 'Matokeo ya kura: {yes} "Ndio", {no} "Hapana", {abstain} "Kujiondoa"'
  },

  // Community & Members
  community: {
    member_count: 'Tunajumlisha wanajamii {count}.',
    member_welcome: 'Karibu sana kwenye jamii yetu! Unajumuishana na DAO hii.',
    contribution_score: 'Alama yako ya mchango: {score} kutoka {max}',
    contribution_improved: '⭐ Hongera! Alama yako ya mchango imaongezwa kuhusu {increase}.',
    engagement_high: '🎉 Wewe ni mwanajamii wa mwajuvu! Endelea hivi!',
    engagement_low: '📣 Tunakupenda makubwa zaidi katika jamii. Jisikilie pendekezo au kura?',
    leaderboard: '🏆 Wasifu wa kusafiri:\n{leaderboard}\n\nJifunze kwa kusaidia na kupiga kura!',
    new_member: 'Nwanajamii mpya: {name} amejumisha DAO yetu!',
    member_active: 'Asante kwa kuwa mwanajamii wa mwajuvu!'
  },

  // Analytics & Insights
  analytics: {
    treasury_health: 'Hazina yetu iko kwa afya nzuri! Mfinyo ni mwenyezi na ukuaji unasukuma.',
    voting_trends: 'Muundo wa kura inayoonyeshwa msukumo wa jamii. Jumua zaidi ya 85% inajumisha kura!',
    growth_metrics: 'Jamii yetu inakua kwa kasi. Tumeongezwa {growth}% hivi karibuni.',
    financial_report: '💰 **Ripoti ya Hazina:**\n\nIkiwi: {inflow}\nOkaja: {outflow}\nMfalme: {balance}\nMuda wa kufa: {runway}',
    community_report: '👥 **Ripoti ya Jamii:**\n\nWanajamii: {members}\nKuungana: {growth}\nMsukumo: {engagement}%\nAlama za Kawaida: {avg_score}',
    monthly_summary: '📊 **Muhtasari wa Mwezi:**\n\n{summary}'
  },

  // Onboarding
  onboarding: {
    start: '🚀 Tunakamatiana na MtaaDAO! Hebu tuendelee pamoja.',
    step1: '📝 **Hatua 1:** Jaza profaili yako na maelezo ya akaunti.',
    step2: '👛 **Hatua 2:** Sambaza akaunti yako ya njia.',
    step3: '📚 **Hatua 3:** Soma mwaliko wa DAO na kaidi.',
    step4: '🤝 **Hatua 4:** Jumuisha jamii ya pakirini.',
    step5: '✅ **Hatua 5:** Endelea! Wewe ni mwanajamii zaidi.',
    complete: '🎉 Hongera! Umekamatia mwanzo. Endelea kuangalia pendekezo au kura.',
    tour_guide: '🎯 **Mwaliko wa MtaaDAO:**\n\n**1. Mnamo** 📊 - Uzazi wa DAO na muhtasari\n**2. Pendekezo** 📝 - Kamatia na piga kura\n**3. Hazina** 💰 - Weka na toa pesa\n**4. Jamii** 👥 - Angalia wanajamii\n**5. Uchambuzi** 📈 - Ripoti na muhtasari\n\nKunde ajeni katika ngazi ili kuchunguza!'
  },

  // Error Messages
  errors: {
    not_understood: 'Samahani, sikunimaini. Tafadhali sema tena kwa njia nyingine.',
    missing_data: 'Samahani, taarifa zako hazipo. Jifungue akaunti na jaribu tena.',
    not_authorized: 'Samahani, huwezi kufanya hii sasa.',
    system_error: 'Samahani, kumekosa tatizo. Jaribu tena baadaye.',
    timeout: 'Konekti ilicheza. Tafadhali jaribu tena.'
  },

  // Suggestions & Prompts
  suggestions: {
    what_next: 'Nini kinachohitajika sasa?',
    explore_more: 'Ungependa kuchunguza...',
    try_asking: 'Unaweza kuniuliza kuhusu...',
    quick_actions: '⚡ Hatua za Haraka:\n• Angalia malundi ya hazina\n• Tazama pendekezo\n• Piga kura\n• Kamatia pendekezo\n• Angalia alama za mchango'
  },

  // Contextual Help
  help: {
    treasury_help: '💰 **Msaada wa Hazina:**\n\nNazini kwa:\n• Angalia malundi (Angalia Malundi)\n• Weka pesa (Weka Pesa)\n• Toa pesa (Toa Pesa)\n• Ripoti (Ripoti ya Hazina)\n\nKunde nini unahitaji?',
    governance_help: '🗳️ **Msaada wa Serikali:**\n\nNazini kwa:\n• Kamatia pendekezo (Kamatia)\n• Angalia pendekezo (Pendekezo)\n• Piga kura (Kura)\n• Matokeo (Matokeo)\n\nKunde nini unahitaji?',
    community_help: '👥 **Msaada wa Jamii:**\n\nNazini kwa:\n• Jumula ya wanajamii (Wanajamii)\n• Alama yako (Alama)\n• Msukumo (Muundo)\n• Wapagazi (Wasifu)\n\nKunde nini unahitaji?'
  }
};

/**
 * Utility function to get Swahili response
 */
export function getSwahiliResponse(key: string, params?: Record<string, any>): string {
  const keys = key.split('.');
  let response: any = swahiliResponses;

  for (const k of keys) {
    response = response?.[k];
    if (!response) return `Samahani, sijui kujibu hila. Jaribu tena.`;
  }

  // Replace parameters if provided
  if (params && typeof response === 'string') {
    Object.entries(params).forEach(([key, value]) => {
      response = response.replace(`{${key}}`, String(value));
    });
  }

  return response || `Samahani, sijui kujibu hila. Jaribu tena.`;
}

/**
 * Random variations for more natural responses
 */
export function getRandomSwahiliGreeting(): string {
  const greetings = [
    'Habari! 👋 Ndiyo, ninakuja. Nini kinachohitajika?',
    'Karibu sana! 🎉 Naskia furaha kuona! Nini?',
    'Habari! 🙌 Tayari kupumzika au kusaidia?',
    'Mambo! 😊 Karibu katika DAO yetu.'
  ];
  return greetings[Math.floor(Math.random() * greetings.length)];
}

export function getRandomSwahiliEncouragement(): string {
  const encouragements = [
    '⭐ Wewe ni mvua wa kwanza!',
    '🌟 Endelea hivi, kumbe!',
    '🎯 Umefanya kazi nzuri sana!',
    '🏆 Hongera kwa mchango!'
  ];
  return encouragements[Math.floor(Math.random() * encouragements.length)];
}
