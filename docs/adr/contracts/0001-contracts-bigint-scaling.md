Title: Contracts numeric scaling and bigInt handling

Context:
On-chain math requires consistent scaling to avoid precision loss when dealing with token amounts and fees.

Decision:
Standardize on 8-decimal fixed-point scaling for token-related calculations in contracts, and always expose raw integer amounts via the ABI. Off-chain code performs human-friendly formatting.

Consequences:
- Clear contract interface and avoided mixed-scaling bugs.
- Edge-case risk if callers assume different scaling — document it in the function comments.
