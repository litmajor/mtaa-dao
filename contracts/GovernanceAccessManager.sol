// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ---------------------------------------------------------------------------
// INTERFACES
// ---------------------------------------------------------------------------

/**
 * @dev Minimal interface for the MTAA governance token.
 *      Must implement ERC20Votes so we can use snapshot-based voting power.
 *      The token should implement the OpenZeppelin ERC20Votes extension.
 */
interface IMTAA {
    /**
     * @dev Returns the voting power of `account` at `blockNumber`.
     *      Requires the token holder to have called `delegate()` at least once.
     */
    function getPastVotes(address account, uint256 blockNumber)
        external
        view
        returns (uint256);

    /**
     * @dev Total supply at `blockNumber` — used for quorum calculation.
     */
    function getPastTotalSupply(uint256 blockNumber)
        external
        view
        returns (uint256);
}

/**
 * @title  GovernanceAccessManager
 * @author MtaaDAO
 * @notice Time-locked governance access control for sensitive operations.
 *
 *         Workflow:
 *         1. Proposer (with ≥ PROPOSAL_THRESHOLD MTAA) proposes an action.
 *         2. Token holders vote during VOTING_PERIOD using snapshot-based power.
 *         3. If quorum is reached and votesFor > votesAgainst, proposal Succeeds.
 *         4. After EXECUTION_TIMELOCK, anyone may execute within EXECUTION_WINDOW.
 *         5. Execution dispatches the stored calldata to the stored target address.
 */
contract GovernanceAccessManager is Ownable2Step, ReentrancyGuard {

    // =========================================================================
    // TYPES & ENUMS
    // =========================================================================

    enum ProposalState {
        Active,     // 0: Voting in progress
        Defeated,   // 1: Failed vote or quorum not met
        Succeeded,  // 2: Passed vote, awaiting time-lock
        Executable, // 3: Time-lock elapsed, within execution window
        Executed,   // 4: Successfully executed
        Cancelled,  // 5: Cancelled by owner before execution
        Expired     // 6: Execution window passed without execution
    }

    enum ActionType {
        TreasuryWithdrawal,
        FeeUpdate,
        PercentageUpdate,
        AgentRegistration,
        AgentDeactivation,
        SubscriptionTierChange,
        OwnershipTransfer,
        ContractUpgrade,
        GovernanceParameterChange,
        Custom
    }

    struct Proposal {
        uint256 proposalId;
        bytes32 actionHash;       // keccak256(abi.encode(target, executionData))
        ActionType actionType;
        address proposer;
        address target;           // Contract to call on execution
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 snapshotBlock;    // Block at which voting power is measured
        uint256 proposedAt;
        uint256 votingDeadline;
        uint256 executionAfter;   // Earliest execution timestamp
        uint256 executionDeadline;// Latest execution timestamp (window close)
        ProposalState state;
        string description;
    }

    struct VoteRecord {
        address voter;
        uint256 proposalId;
        bool support;
        uint256 weight;
        uint256 timestamp;
    }

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    /// @dev Voting period duration.
    uint256 public constant VOTING_PERIOD = 3 days;

    /// @dev Delay between vote passing and earliest execution.
    uint256 public constant EXECUTION_TIMELOCK = 2 days;

    /// @dev Window after timelock during which execution is valid.
    ///      Proposals not executed within this window expire.
    uint256 public constant EXECUTION_WINDOW = 7 days;

    /// @dev Minimum MTAA (snapshot) to create a proposal. Prevents spam.
    uint256 public constant PROPOSAL_THRESHOLD = 10_000e18; // 10k MTAA

    /// @dev Minimum MTAA (snapshot) to cast a vote.
    uint256 public constant MIN_VOTING_POWER = 1_000e18;    // 1k MTAA

    /// @dev Quorum: at least 4% of total supply must participate (votes-for + votes-against).
    ///      Uses basis points: 400 = 4%.
    uint256 public constant QUORUM_BPS = 400;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @dev Minimum guardian signatures required for emergency actions.
    uint256 public constant GUARDIAN_THRESHOLD = 2;

    // =========================================================================
    // STATE
    // =========================================================================

    /// @dev Immutable reference to the MTAA ERC20Votes token.
    IMTAA public immutable mtaaToken;

    uint256 public proposalCounter;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => VoteRecord[]) internal proposalVoteRecords;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => bytes) public proposalExecutionData;

    /// @dev Prevents two active proposals for the same (target, calldata) pair.
    mapping(bytes32 => bool) public activeActionHashes;

    /// @dev Authorized emergency guardian addresses.
    mapping(address => bool) public isGuardian;
    address[] public guardians;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        address indexed target,
        ActionType actionType,
        string description,
        uint256 snapshotBlock,
        uint256 votingDeadline,
        uint256 executionAfter,
        uint256 executionDeadline
    );

    event VoteRecorded(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 weight,
        uint256 timestamp
    );

    event ProposalStateChanged(
        uint256 indexed proposalId,
        ProposalState newState,
        uint256 timestamp
    );

    event ProposalExecuted(
        uint256 indexed proposalId,
        address indexed executor,
        address indexed target,
        uint256 timestamp
    );

    event ProposalCancelled(
        uint256 indexed proposalId,
        address indexed cancelledBy,
        uint256 timestamp
    );

    event EmergencyActionExecuted(
        ActionType indexed actionType,
        address indexed executor,
        address indexed target,
        uint256 timestamp
    );

    event GuardianAdded(address indexed guardian, uint256 timestamp);
    event GuardianRemoved(address indexed guardian, uint256 timestamp);

    // =========================================================================
    // ERRORS
    // =========================================================================

    error ZeroAddress();
    error ProposalNotFound();
    error VotingStillActive();
    error VotingClosed();
    error AlreadyVoted();
    error InsufficientVotingPower();
    error InsufficientProposalPower();
    error TimelockNotExpired();
    error ExecutionWindowClosed();
    error AlreadyExecutedOrClosed();
    error ExecutionFailed(bytes returnData);
    error ProposalNotExecutable();
    error DuplicateActiveProposal();
    error NotGuardian();
    error InsufficientGuardianSignatures();
    error InvalidSignature();
    error SignatureReplay();
    error InvalidActionForEmergency();

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    /**
     * @param _mtaaToken   Address of the deployed MTAA ERC20Votes token.
     * @param _guardians   Initial set of guardian addresses (≥ GUARDIAN_THRESHOLD required).
     */
    constructor(
        address _mtaaToken,
        address[] memory _guardians
    ) Ownable(msg.sender) {
        if (_mtaaToken == address(0)) revert ZeroAddress();
        require(_guardians.length >= GUARDIAN_THRESHOLD, "Too few guardians");

        mtaaToken = IMTAA(_mtaaToken);

        for (uint256 i = 0; i < _guardians.length; i++) {
            if (_guardians[i] == address(0)) revert ZeroAddress();
            isGuardian[_guardians[i]] = true;
            guardians.push(_guardians[i]);
            emit GuardianAdded(_guardians[i], block.timestamp);
        }
    }

    // =========================================================================
    // PROPOSAL MANAGEMENT
    // =========================================================================

    /**
     * @notice Create a new governance proposal.
     * @param actionType    Category of action (for off-chain indexing and UI).
     * @param target        Contract address that will be called on execution.
     * @param description   Human-readable description of the action.
     * @param executionData ABI-encoded calldata to dispatch to `target`.
     * @return proposalId   The ID of the newly created proposal.
     *
     * @dev Proposer must hold ≥ PROPOSAL_THRESHOLD MTAA at the previous block.
     *      Snapshot block is set to block.number - 1 so getPastVotes() is
     *      callable immediately (ERC20Votes requires a finalised block).
     */
    function proposeAction(
        ActionType actionType,
        address target,
        string memory description,
        bytes memory executionData
    ) external nonReentrant returns (uint256 proposalId) {
        if (target == address(0)) revert ZeroAddress();

        // --- snapshot block is current block - 1 (ERC20Votes requirement) ---
        uint256 snapshotBlock = block.number - 1;

        // --- proposer must have minimum voting power ---
        uint256 proposerPower = mtaaToken.getPastVotes(msg.sender, snapshotBlock);
        if (proposerPower < PROPOSAL_THRESHOLD) revert InsufficientProposalPower();

        // --- prevent duplicate active proposals ---
        bytes32 actionHash = keccak256(abi.encode(target, executionData));
        if (activeActionHashes[actionHash]) revert DuplicateActiveProposal();
        activeActionHashes[actionHash] = true;

        proposalId = ++proposalCounter;

        uint256 votingDeadline   = block.timestamp + VOTING_PERIOD;
        uint256 executionAfter   = votingDeadline + EXECUTION_TIMELOCK;
        uint256 executionDeadline = executionAfter + EXECUTION_WINDOW;

        proposals[proposalId] = Proposal({
            proposalId:       proposalId,
            actionHash:       actionHash,
            actionType:       actionType,
            proposer:         msg.sender,
            target:           target,
            votesFor:         0,
            votesAgainst:     0,
            snapshotBlock:    snapshotBlock,
            proposedAt:       block.timestamp,
            votingDeadline:   votingDeadline,
            executionAfter:   executionAfter,
            executionDeadline: executionDeadline,
            state:            ProposalState.Active,
            description:      description
        });

        proposalExecutionData[proposalId] = executionData;

        emit ProposalCreated(
            proposalId,
            msg.sender,
            target,
            actionType,
            description,
            snapshotBlock,
            votingDeadline,
            executionAfter,
            executionDeadline
        );
    }

    /**
     * @notice Cast a vote on an active proposal.
     * @param proposalId  The proposal to vote on.
     * @param support     True = vote for, false = vote against.
     *
     * @dev Voting weight is read from the ERC20Votes snapshot at the proposal's
     *      `snapshotBlock`. This is flash-loan safe: the balance must have been
     *      held (and delegated) prior to proposal creation.
     *
     *      Delegation note: holders must call `mtaaToken.delegate(self)` to
     *      activate their voting power before the snapshot block.
     */
    function vote(
        uint256 proposalId,
        bool support
    ) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.proposalId == 0) revert ProposalNotFound();
        if (proposal.state != ProposalState.Active) revert VotingClosed();
        if (block.timestamp > proposal.votingDeadline) revert VotingClosed();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();

        // --- snapshot-based voting power (flash-loan safe) ---
        uint256 weight = mtaaToken.getPastVotes(msg.sender, proposal.snapshotBlock);
        if (weight < MIN_VOTING_POWER) revert InsufficientVotingPower();

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            proposal.votesFor += weight;
        } else {
            proposal.votesAgainst += weight;
        }

        proposalVoteRecords[proposalId].push(VoteRecord({
            voter:     msg.sender,
            proposalId: proposalId,
            support:   support,
            weight:    weight,
            timestamp: block.timestamp
        }));

        emit VoteRecorded(proposalId, msg.sender, support, weight, block.timestamp);
    }

    // =========================================================================
    // PROPOSAL FINALIZATION
    // =========================================================================

    /**
     * @notice Finalize voting and compute the proposal outcome.
     *         Must be called after `votingDeadline`. Anyone may call this.
     *
     * @dev Quorum: (votesFor + votesAgainst) must be ≥ QUORUM_BPS% of the
     *      total token supply at snapshotBlock. If quorum is not met, the
     *      proposal is Defeated regardless of the vote split.
     */
    function finalizeVoting(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.proposalId == 0) revert ProposalNotFound();
        if (block.timestamp <= proposal.votingDeadline) revert VotingStillActive();
        if (proposal.state != ProposalState.Active) return; // idempotent

        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
        uint256 totalSupply = mtaaToken.getPastTotalSupply(proposal.snapshotBlock);

        // --- quorum check: participation must reach QUORUM_BPS% of supply ---
        bool quorumReached = (totalVotes * BPS_DENOMINATOR) >= (totalSupply * QUORUM_BPS);

        if (!quorumReached || proposal.votesFor <= proposal.votesAgainst) {
            proposal.state = ProposalState.Defeated;
            activeActionHashes[proposal.actionHash] = false; // free slot for re-proposal
            emit ProposalStateChanged(proposalId, ProposalState.Defeated, block.timestamp);
        } else {
            proposal.state = ProposalState.Succeeded;
            emit ProposalStateChanged(proposalId, ProposalState.Succeeded, block.timestamp);
        }
    }

    // =========================================================================
    // PROPOSAL EXECUTION
    // =========================================================================

    /**
     * @notice Execute an approved proposal once the time-lock has elapsed.
     *         Anyone may call this — execution is permissionless once conditions
     *         are met (trustless execution model).
     *
     * @dev State is updated to Executed BEFORE the external call to prevent
     *      reentrancy. The external call uses a low-level `call` and bubbles
     *      reverts with the original revert data.
     *
     *      If the execution window has passed (> executionDeadline), the proposal
     *      is marked Expired and the call reverts. The proposer must re-propose.
     */
    function executeProposal(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.proposalId == 0) revert ProposalNotFound();

        // --- enforce execution window ---
        if (block.timestamp > proposal.executionDeadline) {
            // Mark as expired so state is consistent
            if (proposal.state == ProposalState.Succeeded) {
                proposal.state = ProposalState.Expired;
                activeActionHashes[proposal.actionHash] = false;
                emit ProposalStateChanged(proposalId, ProposalState.Expired, block.timestamp);
            }
            revert ExecutionWindowClosed();
        }

        if (
            proposal.state != ProposalState.Succeeded &&
            proposal.state != ProposalState.Executable
        ) revert ProposalNotExecutable();

        if (block.timestamp < proposal.executionAfter) revert TimelockNotExpired();

        // --- mark executed BEFORE external call (CEI pattern) ---
        proposal.state = ProposalState.Executed;
        activeActionHashes[proposal.actionHash] = false;

        address target = proposal.target;
        bytes memory data = proposalExecutionData[proposalId];

        // --- clean up storage (gas refund) ---
        delete proposalExecutionData[proposalId];

        emit ProposalExecuted(proposalId, msg.sender, target, block.timestamp);
        emit ProposalStateChanged(proposalId, ProposalState.Executed, block.timestamp);

        // --- dispatch the stored calldata to the target ---
        (bool success, bytes memory returnData) = target.call(data);
        if (!success) revert ExecutionFailed(returnData);
    }

    /**
     * @notice Cancel a proposal. Owner only. Cannot cancel an already-executed
     *         or already-cancelled proposal.
     */
    function cancelProposal(uint256 proposalId) external onlyOwner nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.proposalId == 0) revert ProposalNotFound();
        if (
            proposal.state == ProposalState.Executed ||
            proposal.state == ProposalState.Cancelled
        ) revert AlreadyExecutedOrClosed();

        proposal.state = ProposalState.Cancelled;
        activeActionHashes[proposal.actionHash] = false;

        // clean up storage
        delete proposalExecutionData[proposalId];

        emit ProposalCancelled(proposalId, msg.sender, block.timestamp);
        emit ProposalStateChanged(proposalId, ProposalState.Cancelled, block.timestamp);
    }

    // =========================================================================
    // EMERGENCY BYPASS (guardian multisig, whitelisted actions only)
    // =========================================================================

    uint256 public emergencyNonce;
    mapping(bytes32 => bool) public usedEmergencyHashes;

    /**
     * @notice Execute a critical action without governance, gated by guardian
     *         multisig signatures. Only a whitelisted set of emergency action
     *         types is permitted.
     *
     * @param actionType      Must be AgentDeactivation or ContractUpgrade.
     * @param target          Contract to call.
     * @param executionData   Calldata to dispatch.
     * @param signers         Guardian addresses that signed.
     * @param signatures      ECDSA signatures over the action hash.
     *
     * @dev The signed payload is:
     *        keccak256(abi.encode(
     *            "MTAODAO_EMERGENCY",
     *            block.chainid,
     *            address(this),
     *            actionType,
     *            target,
     *            executionData,
     *            nonce
     *        ))
     *      Nonces prevent signature replay across invocations.
     */
    function emergencyExecuteAction(
        ActionType actionType,
        address target,
        bytes memory executionData,
        address[] calldata signers,
        bytes[] calldata signatures
    ) external nonReentrant {
        if (target == address(0)) revert ZeroAddress();

        // --- only specific action types are permitted in emergency ---
        if (
            actionType != ActionType.AgentDeactivation &&
            actionType != ActionType.ContractUpgrade
        ) revert InvalidActionForEmergency();

        // --- require minimum guardian signatures ---
        if (signers.length < GUARDIAN_THRESHOLD) revert InsufficientGuardianSignatures();
        if (signers.length != signatures.length) revert InsufficientGuardianSignatures();

        // --- build the canonical payload hash ---
        uint256 nonce = emergencyNonce++;
        bytes32 payloadHash = keccak256(abi.encode(
            "MTAODAO_EMERGENCY",
            block.chainid,
            address(this),
            actionType,
            target,
            executionData,
            nonce
        ));
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash)
        );

        if (usedEmergencyHashes[ethSignedHash]) revert SignatureReplay();
        usedEmergencyHashes[ethSignedHash] = true;

        // --- verify each signer is a guardian and signature is valid ---
        uint256 validSigs = 0;
        for (uint256 i = 0; i < signers.length; i++) {
            if (!isGuardian[signers[i]]) revert NotGuardian();

            address recovered = _recoverSigner(ethSignedHash, signatures[i]);
            if (recovered != signers[i]) revert InvalidSignature();

            validSigs++;
        }
        if (validSigs < GUARDIAN_THRESHOLD) revert InsufficientGuardianSignatures();

        emit EmergencyActionExecuted(actionType, msg.sender, target, block.timestamp);

        // --- dispatch ---
        (bool success, bytes memory returnData) = target.call(executionData);
        if (!success) revert ExecutionFailed(returnData);
    }

    // =========================================================================
    // GUARDIAN MANAGEMENT (owner only)
    // =========================================================================

    function addGuardian(address guardian) external onlyOwner {
        if (guardian == address(0)) revert ZeroAddress();
        if (!isGuardian[guardian]) {
            isGuardian[guardian] = true;
            guardians.push(guardian);
            emit GuardianAdded(guardian, block.timestamp);
        }
    }

    function removeGuardian(address guardian) external onlyOwner {
        require(
            _countActiveGuardians() > GUARDIAN_THRESHOLD,
            "Cannot drop below threshold"
        );
        isGuardian[guardian] = false;
        emit GuardianRemoved(guardian, block.timestamp);
    }

    // =========================================================================
    // VIEWS
    // =========================================================================

    /**
     * @notice Returns the live computed state of a proposal.
     *         This view respects time-based transitions without mutating storage.
     */
    function getProposalState(uint256 proposalId)
        external
        view
        returns (ProposalState)
    {
        Proposal storage p = proposals[proposalId];
        if (p.proposalId == 0) revert ProposalNotFound();

        // If storage is already terminal, return it
        if (
            p.state == ProposalState.Executed ||
            p.state == ProposalState.Cancelled ||
            p.state == ProposalState.Defeated ||
            p.state == ProposalState.Expired
        ) return p.state;

        // Active → check if voting ended
        if (p.state == ProposalState.Active) {
            if (block.timestamp <= p.votingDeadline) return ProposalState.Active;
            // Voting ended but finalizeVoting() hasn't been called yet
            uint256 totalVotes = p.votesFor + p.votesAgainst;
            uint256 totalSupply = mtaaToken.getPastTotalSupply(p.snapshotBlock);
            bool quorumOk = (totalVotes * BPS_DENOMINATOR) >= (totalSupply * QUORUM_BPS);
            if (!quorumOk || p.votesFor <= p.votesAgainst) return ProposalState.Defeated;
            return ProposalState.Succeeded;
        }

        // Succeeded → check timelock and execution window
        if (p.state == ProposalState.Succeeded) {
            if (block.timestamp > p.executionDeadline) return ProposalState.Expired;
            if (block.timestamp >= p.executionAfter) return ProposalState.Executable;
            return ProposalState.Succeeded;
        }

        return p.state;
    }

    /**
     * @notice Returns full proposal struct.
     */
    function getProposal(uint256 proposalId)
        external
        view
        returns (Proposal memory)
    {
        return proposals[proposalId];
    }

    /**
     * @notice Returns vote tallies and quorum status.
     */
    function getVoteTallies(uint256 proposalId)
        external
        view
        returns (
            uint256 votesFor,
            uint256 votesAgainst,
            uint256 total,
            uint256 quorumRequired,
            bool quorumReached
        )
    {
        Proposal storage p = proposals[proposalId];
        if (p.proposalId == 0) revert ProposalNotFound();

        votesFor      = p.votesFor;
        votesAgainst  = p.votesAgainst;
        total         = votesFor + votesAgainst;

        uint256 totalSupply = mtaaToken.getPastTotalSupply(p.snapshotBlock);
        quorumRequired = (totalSupply * QUORUM_BPS) / BPS_DENOMINATOR;
        quorumReached  = total >= quorumRequired;
    }

    /**
     * @notice Returns a paginated slice of votes on a proposal.
     *         Prevents gas DoS from unbounded array returns.
     * @param offset Start index (0-based).
     * @param limit  Max number of records to return.
     */
    function getProposalVotes(
        uint256 proposalId,
        uint256 offset,
        uint256 limit
    ) external view returns (VoteRecord[] memory result) {
        VoteRecord[] storage allVotes = proposalVoteRecords[proposalId];
        uint256 len = allVotes.length;
        if (offset >= len) return new VoteRecord[](0);

        uint256 end = offset + limit;
        if (end > len) end = len;

        result = new VoteRecord[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = allVotes[i];
        }
    }

    /**
     * @notice Returns total number of votes recorded on a proposal.
     */
    function getVoteCount(uint256 proposalId) external view returns (uint256) {
        return proposalVoteRecords[proposalId].length;
    }

    /**
     * @notice Returns whether `voter` has voted on `proposalId`.
     */
    function hasAddressVoted(uint256 proposalId, address voter)
        external
        view
        returns (bool)
    {
        return hasVoted[proposalId][voter];
    }

    /**
     * @notice Returns total proposals created.
     */
    function getTotalProposals() external view returns (uint256) {
        return proposalCounter;
    }

    /**
     * @notice Returns whether a proposal can currently be executed.
     */
    function canExecuteProposal(uint256 proposalId) external view returns (bool) {
        Proposal storage p = proposals[proposalId];
        if (p.proposalId == 0) return false;
        if (
            p.state != ProposalState.Succeeded &&
            p.state != ProposalState.Executable
        ) return false;
        if (block.timestamp < p.executionAfter) return false;
        if (block.timestamp > p.executionDeadline) return false;
        return true;
    }

    /**
     * @notice Returns the voting power of `account` at a given proposal's snapshot.
     *         Useful for frontends to show "your voting power" before voting.
     */
    function getVotingPower(uint256 proposalId, address account)
        external
        view
        returns (uint256)
    {
        Proposal storage p = proposals[proposalId];
        if (p.proposalId == 0) revert ProposalNotFound();
        return mtaaToken.getPastVotes(account, p.snapshotBlock);
    }

    /**
     * @notice Returns all guardian addresses (including inactive ones — check isGuardian).
     */
    function getGuardians() external view returns (address[] memory) {
        return guardians;
    }

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    /**
     * @dev Recovers the signer from an eth_sign-style signature.
     */
    function _recoverSigner(
        bytes32 ethSignedHash,
        bytes memory sig
    ) internal pure returns (address) {
        require(sig.length == 65, "Invalid sig length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        return ecrecover(ethSignedHash, v, r, s);
    }

    /**
     * @dev Count guardians that are still active.
     */
    function _countActiveGuardians() internal view returns (uint256 count) {
        for (uint256 i = 0; i < guardians.length; i++) {
            if (isGuardian[guardians[i]]) count++;
        }
    }
}
