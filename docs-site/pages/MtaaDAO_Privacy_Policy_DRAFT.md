# MtaaDAO — Privacy Policy

*Working draft — companion to the Terms of Service*

Draft date: 27 July 2026

**DRAFT — NOT LEGAL ADVICE.** Prepared as a working draft for review by qualified Kenyan / East African counsel before publication or use.

## Open items requiring answers before this document is publishable

- Data controller identity — the same entity question as the Terms of Service; the Privacy Policy needs a named controller responsible under Kenya's Data Protection Act 2019
- Whether the controller is registered with Kenya's Office of the Data Protection Commissioner (ODPC), as required for entities processing personal data at scale
- Full inventory of data collected: exact KYC/ID document types, phone number handling, M-Pesa transaction metadata, wallet addresses, device/behavioral data
- Identity of the KYC verification vendor actually in use (Smile Identity was recommended — confirm adoption) and what data is shared with them
- Identity of the payment provider(s) used for M-Pesa rails and what transaction data is shared with them
- Whether and how AI agents (Okedi, Amara, Yuki) send personal or financial data to third-party LLM providers, which providers, and where those providers process/store data
- Data retention periods for KYC records, transaction history, and AI agent interaction logs
- Cross-border data transfer mechanism, if any data processor is located outside Kenya (relevant to both Kenya DPA 2019 and, if EU users are in scope, GDPR)
- Whether a Data Protection Officer has been appointed, and their contact details

---

## 1. Introduction

This Privacy Policy explains how MtaaDAO collects, uses, shares, and protects personal data when you use the MtaaDAO platform ("Platform"). It should be read together with the Terms of Service.

> ⚠ **UNRESOLVED — LEGAL RISK (controller identity).** The legal data controller is not determinable from the codebase alone; this must be confirmed by business and corporate documentation before publication.

## 2. Scope: What This Policy Covers

This Policy covers data collected through the Platform's off-chain systems: account registration, identity verification, the web and mobile interfaces, and MtaaDAO's own servers. It does not cover data that is inherently public by virtue of being recorded on the Celo blockchain — on-chain wallet addresses and transaction records are public and outside MtaaDAO's control once broadcast, regardless of what off-chain data MtaaDAO separately holds about you.

## 3. Data We Collect

Categories of data the Platform may collect include:

- Account information you provide directly, such as display name, email address, phone number, and contact details.
- Tiered identity verification (KYC) data, where required by applicable law.
  - Basic tier: email verification and phone verification.
  - Intermediate tier: first name, last name, date of birth, nationality, ID document type and number, and URLs for ID document front/back images.
  - Advanced tier: residential address, city, state, postal code, country, proof-of-address type, and proof-of-address URL.
- Phone number and transaction references used for M-Pesa integration, payment status updates, and account communication.
- Public wallet metadata, including on-chain wallet addresses and public keys associated with your account for display and reporting.
- Usage and device data collected automatically, such as app version, timestamps, and general diagnostic logs.

The platform's wallet generation flow is designed so that private keys and recovery phrases are generated client-side and returned once to the authenticated client; the server does not persist mnemonic phrases or private keys.

> ⚠ **UNRESOLVED — LEGAL RISK (data inventory).** The code supports tiered KYC and payment metadata as described above. It also supports Jumio and Onfido identity verification providers with manual review fallback. Confirm the exact fields collected, whether any biometric data is captured, and the final vendors before publication.

## 4. How We Use Your Data

- To create, verify, and administer your account.
- To process deposits and withdrawals through our payment provider infrastructure when you use M-Pesa or other supported gateways.
- To perform identity verification using third-party KYC services where required to unlock enhanced platform features or comply with regulatory obligations.
- To operate AI agent features such as governance recommendations, account summaries, and trade assistance when enabled.
- To detect, prevent, and investigate fraud, abuse, and violations of these Terms.
- To comply with legal and regulatory obligations, including anti-money-laundering screening and reporting requirements.

## 5. AI Agents and Automated Processing

The Platform's AI agents (presented through the Okedi, Amara, and Yuki interface personas) may process your account, transaction, or governance activity data to generate recommendations, summaries, or trade-related suggestions.

> ⚠ **UNRESOLVED — LEGAL RISK (third-party LLM processing).** Code confirms the AI layer uses OpenAI via `server/agents/morio/api/llm_provider.ts` and the `https://api.openai.com/v1/chat/completions` endpoint. Whether personal, financial, or transaction data is transmitted to OpenAI depends on agent configuration, and that must be specified before publication.

## 6. How We Share Your Data

MtaaDAO shares personal data with third parties only as necessary to operate the Platform:

- Payment providers, to process deposits, withdrawals, and fiat-to-crypto on-ramps and off-ramps.
- Identity verification providers, to perform KYC checks when required for certain account or platform features.
- AI/LLM infrastructure providers, if agent features are enabled, to generate automated responses and recommendations.
- Regulators or law enforcement, when required by applicable law.

The code supports multiple payment gateway integrations, including M-Pesa and Kotani Pay, with optional support for Flutterwave, Paystack, Airtel Money, and Onramper when enabled in platform configuration. Identity verification is implemented using Jumio or Onfido when configured, with manual review as a fallback.

MtaaDAO does not sell personal data to third parties for their independent marketing purposes.

> ⚠ **UNRESOLVED — LEGAL RISK (named third parties).** Confirm the exact processors, payment provider relationships, and KYC vendors before publication.

## 7. Data Retention

> ⚠ **UNRESOLVED — LEGAL RISK (retention periods).** The codebase does not encode retention policy metadata for KYC or transaction records, so retention periods must be defined by legal and regulatory policy, not inferred from the software alone.

## 8. Your Rights

Depending on the jurisdiction from which you access the Platform, you may have rights to access, correct, delete, or restrict the processing of your personal data, and to lodge a complaint with the relevant data protection authority.

> ⚠ **UNRESOLVED — LEGAL RISK (jurisdiction-specific rights).** This section is written generically because the Platform's target jurisdiction(s) are not yet finalized. If usage is Kenya-only, this section should be rewritten to specifically reference rights under the Data Protection Act 2019 and the Office of the Data Protection Commissioner as the complaint authority. If broader East African or international users are in scope, additional jurisdiction-specific rights language (e.g., GDPR rights for EU users) will be needed.

## 9. Cross-Border Data Transfers

> ⚠ **UNRESOLVED — LEGAL RISK (cross-border transfer basis).** If any processor (payment provider, KYC vendor, or LLM provider) is located outside Kenya, the DPA 2019 requires a lawful basis for that transfer (e.g., adequacy, contractual safeguards, or consent). This section cannot be completed until the location of each processor is confirmed.

## 10. Security

MtaaDAO applies technical and organizational measures intended to protect personal data against unauthorized access, alteration, or loss, including encryption of sensitive data in transit and access controls on internal systems. No system can be guaranteed fully secure, and you should safeguard your own account credentials and wallet keys accordingly.

## 11. Children's Privacy

The Platform is not directed at, and is not intended for use by, individuals under the age of 18. MtaaDAO does not knowingly collect personal data from children.

## 12. Changes to This Policy

MtaaDAO may update this Privacy Policy from time to time. Material changes will be notified through the Platform prior to taking effect.

## 13. Contact

> ⚠ **UNRESOLVED — LEGAL RISK (DPO / contact details).** The codebase does not identify a Data Protection Officer or privacy contact; this must be supplied by the legal entity that is confirmed as the controller.
