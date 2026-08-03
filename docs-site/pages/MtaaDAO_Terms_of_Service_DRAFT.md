# MtaaDAO — Terms of Service

*Working draft — non-custodial DeFi / DAO platform for East African community finance*

Draft date: 27 July 2026

**DRAFT — NOT LEGAL ADVICE.** Prepared as a working draft for review by qualified Kenyan / East African counsel before publication or use.

## Open items requiring answers before this document is publishable

The sections below contain explicit flags at every point where the document currently asserts, assumes, or defers a fact that has not been confirmed. Resolve each before this draft is used with real users.

- Legal entity / contracting counterparty — who "MtaaDAO" is as a party to this agreement (unincorporated DAO, Kenyan company, offshore holding entity, or the founder personally)
- Whether the Mauritius GBC + Kenya OpCo structure is implemented, in progress, or still only a recommendation
- Jurisdiction(s) the platform is offered in, and the governing law / dispute resolution forum
- Identity and legal relationship of the payment provider(s) relied on for M-Pesa rails (licensed PSP, bank partnership, aggregator, agent arrangement)
- KYC data collected, verification vendor used (Smile Identity or otherwise), and retention period
- Whether AI agents (Okedi, Amara, Yuki) send personal or financial data to third-party LLM providers, and which ones
- MTAA token's legal characterization — no position is taken in this draft; counsel must confirm before any marketing or ToS language implies an answer either way
- Canonical list and legal treatment of DAO/group types (this draft uses a working list pending confirmation against the platform schema)
- ChamaTreasury's live operational mode (ledger-only vs. live fiat-to-stablecoin conversion) at the time this document is published — the rights/risk language must match what is actually live

---

## 1. Introduction and Acceptance

These Terms of Service ("Terms") govern access to and use of the MtaaDAO platform, including its web and mobile applications, on-chain smart contracts, and associated services (together, the "Platform"). By creating an account, connecting a wallet, or otherwise using the Platform, you ("you" or "User") agree to be bound by these Terms.

> ⚠ **UNRESOLVED — LEGAL RISK (counterparty).** The codebase does not identify a contracting entity or corporate structure; this must be confirmed by legal and business documentation before the Terms can be finalized.

## 2. Nature of the Platform

MtaaDAO is a non-custodial platform combining on-chain group governance, community savings and investment tools, and DeFi trading functionality, built on the Celo blockchain and integrated with Kenyan mobile money (M-Pesa) rails.

The Platform organizes functionality around three interface personas — Okedi (community and DAO governance), Amara (passive investment), and Yuki (active trading and DeFi execution) — which are modes of the same underlying account and permission set, not separate products or separate legal relationships.

The Platform supports multiple group/DAO structures for organizing member contributions and decisions, including savings groups, rotating contribution groups, time-bound fundraising groups, and community or investment groups.

> ⚠ **UNRESOLVED — LEGAL RISK (DAO type list).** Code indicates the platform is built around DAO types `harambee`, `shortTerm`, `savings`, `merryGoRound`, `community`, and `investment`. Confirm whether these are the final types and whether any carry distinct legal treatment before naming them in binding language.

## 3. Non-Custodial Model

MtaaDAO does not hold, control, or have access to your private keys or the private keys of any group treasury. Wallets are generated using client-side recovery phrases, and the server-side code only persists public wallet metadata such as wallet addresses and public keys. The platform's wallet creation flow is designed to return the recovery phrase once to the authenticated client and not to store it.

Because the Platform is non-custodial, MtaaDAO does not act as a custodian, bank, or money transmitter with respect to digital assets held in user or group wallets. This distinction is central to the Platform's regulatory posture under the Kenya Virtual Asset Service Providers Act and should not be blurred elsewhere in this document or in marketing materials.

Multisignature group treasuries require a threshold of designated group signers to authorize transactions. MtaaDAO does not hold a signing key on group multisigs and cannot unilaterally move, freeze, or recover group funds.

> ⚠ **UNRESOLVED — LEGAL RISK (multisig signer role).** Current code design shows wallet creation and key handling are client-side, and the on-chain group treasury contracts require signer confirmations. No code path was found that retains a server-held group multisig signing key, but this must still be validated against deployment and operational procedures.

## 4. Payment Rails and Third-Party Payment Providers

The Platform integrates with M-Pesa to allow deposits and withdrawals of Kenyan Shillings (KES). This integration is provided through one or more third-party payment service providers. MtaaDAO is not itself a licensed payment service provider and relies on these third parties to process fiat transactions.

The platform code includes support for direct M-Pesa integration and Kotani Pay, and also supports additional gateways such as Flutterwave, Paystack, Airtel Money, and Onramper when enabled in configuration.

> ⚠ **UNRESOLVED — LEGAL RISK (payment provider disclosure).** Confirm the actual legal provider relationship, the licensed provider(s) in use, and the applicable regulatory status before publishing.

Fiat funds deposited via M-Pesa may be held in an internal ledger before conversion to on-chain assets. The `ChamaTreasury` contract is designed to start in `LEDGER_ONLY` mode and only switch to `LIVE_VAULT` when activated by signers.

> ⚠ **UNRESOLVED — LEGAL RISK (ledger-only status).** Confirm whether the live service is currently operating in ledger-only mode or live stablecoin mode before finalizing the Terms.

## 5. AI Agents

The Platform uses AI-driven agents (including those presented through the Okedi, Amara, and Yuki interface personas) to provide governance recommendations, portfolio insights, trade execution assistance, and related features. Agent actions that move funds are constrained by on-chain permission contracts and are subject to the multisig and non-custodial limitations described in Section 3.

The platform's AI agent implementation is built on the Morio provider and, when enabled, may use OpenAI via the OpenAI chat completions API.

> ⚠ **UNRESOLVED — LEGAL RISK (third-party LLM processing).** Confirm whether personal or financial data is transmitted to OpenAI and whether that provider is outside Kenya before publishing.

## 6. The MTAA Token

MTAA is a utility token used to unlock governance participation and premium platform features. No representation is made in these Terms as to whether MTAA constitutes a security, financial instrument, or other regulated asset under the laws of Kenya, any other jurisdiction in which the Platform operates, or any jurisdiction in which a User is located. Users are responsible for determining the legal and tax treatment of MTAA in their own jurisdiction.

> ⚠ **UNRESOLVED — LEGAL RISK (securities characterization).** This section deliberately takes no position, per your instruction. Before publishing, counsel should confirm this neutral framing is sufficient, or whether jurisdiction-specific risk disclosures are required (e.g., a Howey-style analysis for US users, if the Platform is or becomes accessible to them).

## 7. Trading, DeFi, and Cross-Chain Functionality

The Yuki trading subsystem provides access to decentralized and, where applicable, centralized exchange functionality, algorithmic and manual trading tools, and cross-chain bridging (including bridging infrastructure such as Wormhole and LayerZero). Use of these features involves substantial risk, including but not limited to market volatility, smart contract vulnerabilities, oracle failure, bridge exploits, and total loss of assets.

- You acknowledge that cross-chain bridges carry risks distinct from same-chain transactions, including bridge protocol failure or exploit, independent of any fault by MtaaDAO.
- Automated or algorithmic trading features execute based on parameters you set or approve; MtaaDAO does not guarantee any outcome, profit, or protection against loss.
- "Advanced Mode" features, including leverage and direct smart contract interaction, are intended for Users who understand these risks and are enabled only after explicit opt-in.

Nothing in this section constitutes financial, investment, or trading advice.

## 8. Governance and DAO Participation

Users participating in group or DAO governance may propose, vote on, and execute group decisions subject to each group's configured governance rules (including multisignature thresholds and, where applicable, quadratic voting). Governance outcomes are executed on-chain and, once finalized according to a group's rules, are generally irreversible.

MtaaDAO provides the software infrastructure for governance but does not control the substantive decisions made by groups or their members, and is not a party to agreements between group members.

## 9. Eligibility and Account Responsibilities

- You must be at least 18 years old, or the age of majority in your jurisdiction, to use the Platform.
- You are responsible for the accuracy of information you provide, including for identity verification (KYC) where required.
- The Platform uses a tiered KYC model. Higher transaction limits and group treasury roles may require additional identity verification, including email and phone verification, government ID document verification, and proof of address.
- You may not use the Platform if doing so would violate the law of your jurisdiction, including sanctions and anti-money-laundering laws.

> ⚠ **UNRESOLVED — LEGAL RISK (KYC specifics).** The code shows tiered KYC collection, including basic email/phone, intermediate ID verification with name/DOB/nationality/ID document details and images, and advanced proof-of-address collection. Confirm the exact trigger points and regulatory obligations before finalizing the Terms.

## 10. Fees

MtaaDAO may charge fees for certain features, including trading execution, premium governance tools, or agent-assisted services. Applicable fees will be disclosed within the Platform interface prior to a User incurring them.

## 11. Prohibited Uses

- Using the Platform for money laundering, terrorist financing, or other illicit finance.
- Attempting to exploit, reverse-engineer, or interfere with the Platform's smart contracts or infrastructure.
- Using automated means to manipulate governance votes, trading markets, or referral/rewards mechanisms.
- Circumventing identity verification or sanctions screening.

## 12. Disclaimers

THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY LAW, MTAADAO DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. MTAADAO DOES NOT GUARANTEE THE SECURITY OF ANY SMART CONTRACT, BRIDGE, OR THIRD-PARTY PROTOCOL INTEGRATED WITH THE PLATFORM.

## 13. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, MTAADAO AND ITS OPERATORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF FUNDS, PROFITS, OR DATA ARISING FROM YOUR USE OF THE PLATFORM, INCLUDING LOSSES CAUSED BY SMART CONTRACT VULNERABILITIES, BRIDGE FAILURES, MARKET VOLATILITY, OR THIRD-PARTY PAYMENT PROVIDER FAILURES.

> ⚠ **UNRESOLVED — LEGAL RISK (enforceability).** Liability caps and disclaimers of this kind are not uniformly enforceable — Kenyan consumer-protection law and any jurisdiction where retail users are located may limit what can be validly disclaimed, particularly around the fiat/M-Pesa leg of the service where MtaaDAO is closer to a service provider than a neutral software layer. Counsel should tailor this section per jurisdiction rather than rely on a single global disclaimer.

## 14. Indemnification

You agree to indemnify and hold harmless MtaaDAO and its operators from any claims, damages, or expenses arising from your breach of these Terms or your misuse of the Platform.

## 15. Termination

MtaaDAO may suspend or terminate access to the Platform's off-chain interface at its discretion, including for violations of these Terms or applicable law. Because the Platform is non-custodial, termination of interface access does not affect your control over on-chain assets held in your own wallet or a group multisig you are a signer on.

## 16. Governing Law and Dispute Resolution

> ⚠ **UNRESOLVED — LEGAL RISK (jurisdiction).** The code does not establish the contracting jurisdiction or entity structure; this must be confirmed before governing law or dispute resolution language is finalized.

## 17. Changes to These Terms

MtaaDAO may update these Terms from time to time. Material changes will be notified through the Platform prior to taking effect. Continued use of the Platform after changes take effect constitutes acceptance of the revised Terms.

## 18. Contact

> ⚠ **UNRESOLVED — LEGAL RISK (contact details).** The code does not provide a legal support contact; this must be supplied by the confirmed contracting entity.
