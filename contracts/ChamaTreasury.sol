// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

// Minimal interface for notifying modules (implemented in RotationModule)
interface IRotationModule {
    function onTreasuryProposalExecuted(uint256 proposalId, address recipient, uint256 amount) external;
}

// Minimal interface for StrategyRegistry integration
interface IStrategyRegistry {
    function isStrategyActive(uint256 strategyId) external view returns (bool);
}

// Minimal interface for FloatingAPYCalculator
interface IFloatingAPYCalculator {
    function getCurrentAPY() external view returns (uint256);
}

/**
 * @title ChamaTreasury
 * @notice On-chain treasury for informal savings groups (chamas)
 *
 * Design principles:
 * - Configurable multisig: 2-of-3 up to N-of-M, set at deployment
 * - Dual mode: LEDGER_ONLY (manual M-Pesa recording) → LIVE_VAULT (real cUSD)
 * Same contract, same address, same history. Flip mode when M-Pesa→cUSD is live.
 * - Tiered timelock: small transfers fast, large transfers slower
 * - Contribution tracking: per-member KES amounts + pro-rata share calculation
 * - Typed proposals: field added now, enforced in future upgrade (Option B path)
 * - No MTAA dependency: chama treasury uses stablecoin only
 *
 * Deployment flow:
 * 1. Deploy with signers[], requiredSignatures, stablecoin address
 * 2. Starts in LEDGER_ONLY mode — signers record M-Pesa payments manually
 * 3. When M-Pesa→cUSD conversion live: owner calls activateLiveVault()
 * 4. Members deposit cUSD directly, contract holds real funds
 *
 * Withdrawal flow:
 * 1. Any signer proposes withdrawal (recipient, amount, reason)
 * 2. Required number of signers confirm
 * 3. Timelock expires (small: 1h, large: 24h)
 * 4. Any signer executes
 */
contract ChamaTreasury is ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // =========================================================================
    // ENUMS
    // =========================================================================

    enum TreasuryMode {
        LEDGER_ONLY,  // Manual recording, no real token transfers
        LIVE_VAULT    // Real cUSD deposits and withdrawals
    }

    enum ProposalStatus {
        PENDING,    // Awaiting confirmations
        APPROVED,   // Enough confirmations, in timelock
        EXECUTED,   // Completed
        CANCELLED   // Cancelled by proposer or majority
    }

    // Future typed proposals — field exists now, enforced later
    enum ProposalType {
        WITHDRAWAL,   // Send funds to recipient
        LOAN,         // Loan to member (tracked separately)
        INVESTMENT,   // Route to MaonoVault / Amara layer
        PENALTY,      // Deduct from member contribution record
        SIGNER_CHANGE // Add/remove signer via multisig
    }

    // =========================================================================
    // STRUCTS
    // =========================================================================

    struct Proposal {
        uint256        strategyId;      // optional: for INVESTMENT proposals
        uint256 id;
        ProposalType proposalType;  // typed for future use
        address proposedBy;
        address recipient;
        uint256 amount;             // in stablecoin units (18 decimals)
        uint256 amountKES;          // KES display amount (off-chain reference)
        uint256 loanApyBp;          // for LOAN proposals: APY in basis points
        string reason;
        ProposalStatus status;
        uint256 confirmations;
        uint256 createdAt;
        uint256 executableAfter;    // timelock expiry
        bool cancelled;
        mapping(address => bool) confirmedBy;
    }

    struct ContributionRecord {
        uint256 totalAmountStable;  // cumulative cUSD (or recorded KES as uint)
        uint256 totalAmountKES;     // cumulative KES (human reference)
        uint256 contributionCount;  // number of contributions
        uint256 lastContribution;   // timestamp
        uint256 missedCount;        // missed contribution cycles
    }

    struct SignerInfo {
        address addr;
        string name;        // human readable e.g. "Jane (Treasurer)"
        uint256 addedAt;
        bool active;
    }

    // =========================================================================
    // STATE
    // =========================================================================

    // --- Identity ---
    string public chamaName;
    string public daoId;            // off-chain DAO ID for indexing
    address public deployer;        // original deployer, limited admin rights

    // --- Mode ---
    TreasuryMode public mode;
    IERC20 public stablecoin;       // cUSD on Celo

    // --- Multisig ---
    address[] public signers;
    mapping(address => bool) public isSigner;
    mapping(address => SignerInfo) public signerInfo;
    uint256 public requiredSignatures;
    uint256 public constant MIN_SIGNERS = 2;
    uint256 public constant MAX_SIGNERS = 10;

    // --- Tiered timelock ---
    uint256 public smallTransferLimit;
    uint256 public smallTransferDelay; // default 1 hour
    uint256 public largeTransferDelay; // default 24 hours

    // --- Proposals ---
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    address public strategyRegistry;
    address public apyCalculator;
    // Modules (contracts) allowed to create proposals on behalf of external modules
    mapping(address => bool) public approvedProposers;
    // --- Activation confirmations for switching to LIVE_VAULT (multisig) ---
    mapping(address => bool) public activationConfirmed;
    uint256 public activationConfirmationCount;

    // --- Contributions ---
    address[] public members;
    mapping(address => bool) public isMember;
    mapping(address => ContributionRecord) public contributions;
    uint256 public totalContributionsStable;  // sum of all cUSD recorded
    uint256 public totalContributionsKES;     // sum of all KES recorded

    // =========================================================================
    // EVENTS
    // =========================================================================

    event ContributionRecorded(
        address indexed member,
        uint256 amountStable,
        uint256 amountKES,
        string referenceCode,       // M-Pesa code or tx hash
        address recordedBy,
        uint256 timestamp
    );
    event ContributionDeposited(
        address indexed member,
        uint256 amount,
        uint256 timestamp
    );
    event ProposalCreated(
        uint256 indexed proposalId,
        ProposalType proposalType,
        address indexed proposedBy,
        address indexed recipient,
        uint256 amount,
        uint256 executableAfter
    );
    event ApprovedProposerUpdated(address indexed proposer, bool approved);

    event ProposalConfirmed(
        uint256 indexed proposalId,
        address indexed confirmedBy,
        uint256 totalConfirmations
    );
    event ProposalExecuted(
        uint256 indexed proposalId,
        address indexed executedBy,
        address indexed recipient,
        uint256 amount
    );
    event ProposalCancelled(
        uint256 indexed proposalId,
        address indexed cancelledBy
    );
    event ConfirmationRevoked(
        uint256 indexed proposalId,
        address indexed revokedBy
    );
    event SignerAdded(address indexed signer, string name);
    event SignerRemoved(address indexed signer);
    event MemberAdded(address indexed member);

    event ModeActivated(TreasuryMode newMode, uint256 timestamp);
    event ActivationConfirmed(address indexed signer, uint256 totalConfirmations);
    event ActivationConfirmationRevoked(address indexed signer, uint256 totalConfirmations);
    event TimelockUpdated(
        uint256 smallLimit,
        uint256 smallDelay,
        uint256 largeDelay
    );
    event MissedContribution(
        address indexed member,
        uint256 cycleTimestamp
    );

    // =========================================================================
    // ERRORS
    // =========================================================================

    error NotSigner();
    error NotMember();
    error AlreadySigner();
    error AlreadyMember();
    error InvalidSignerCount();
    error InvalidThreshold();
    error ProposalNotFound();
    error ProposalNotPending();
    error ProposalNotApproved();
    error ProposalAlreadyExecuted();
    error ProposalCancelledError();
    error AlreadyConfirmed();
    error NotConfirmed();
    error TimelockNotExpired(uint256 executableAfter);
    error InsufficientConfirmations(uint256 have, uint256 need);
    error InsufficientVaultBalance(uint256 available, uint256 requested);
    error WrongMode(TreasuryMode required);
    error AlreadyInLiveMode();
    error ZeroAmount();
    error ZeroAddress();
    error StrategyNotActive();
    error InvalidThresholdValue();
    error CannotRemoveSelf();
    error BelowMinSigners();
    error TransferFailed();

    // =========================================================================
    // MODIFIERS
    // =========================================================================

    modifier onlySigner() {
        if (!isSigner[msg.sender]) revert NotSigner();
        _;
    }

    modifier onlyDeployer() {
        require(msg.sender == deployer, "Only deployer");
        _;
    }

    modifier proposalExists(uint256 proposalId) {
        if (proposalId >= proposalCount) revert ProposalNotFound();
        _;
    }

    modifier inLiveMode() {
        if (mode != TreasuryMode.LIVE_VAULT) revert WrongMode(TreasuryMode.LIVE_VAULT);
        _;
    }

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(
        string memory _chamaName,
        string memory _daoId,
        address[] memory _signers,
        string[] memory _signerNames,
        uint256 _requiredSignatures,
        address _stablecoin,
        uint256 _smallTransferLimit
    ) {
        if (_signers.length < MIN_SIGNERS || _signers.length > MAX_SIGNERS)
            revert InvalidSignerCount();
        if (_requiredSignatures < 2 || _requiredSignatures > _signers.length)
            revert InvalidThreshold();
        if (_stablecoin == address(0)) revert ZeroAddress();
        require(_signerNames.length == _signers.length, "Names length mismatch");

        chamaName = _chamaName;
        daoId = _daoId;
        deployer = msg.sender;
        stablecoin = IERC20(_stablecoin);
        requiredSignatures = _requiredSignatures;

        smallTransferLimit = _smallTransferLimit;
        smallTransferDelay = 1 hours;
        largeTransferDelay = 24 hours;

        for (uint256 i = 0; i < _signers.length; i++) {
            address s = _signers[i];
            if (s == address(0)) revert ZeroAddress();

            for (uint256 j = i + 1; j < _signers.length; j++) {
                require(_signers[j] != s, "Duplicate signer");
            }

            signers.push(s);
            isSigner[s] = true;
            signerInfo[s] = SignerInfo({
                addr: s,
                name: _signerNames[i],
                addedAt: block.timestamp,
                active: true
            });

            if (!isMember[s]) {
                members.push(s);
                isMember[s] = true;
                emit MemberAdded(s);
            }

            emit SignerAdded(s, _signerNames[i]);
        }

        mode = TreasuryMode.LEDGER_ONLY;
    }

    // =========================================================================
    // MODE MANAGEMENT
    // =========================================================================

    function activateLiveVault() external onlyDeployer {
        if (mode == TreasuryMode.LIVE_VAULT) revert AlreadyInLiveMode();
        mode = TreasuryMode.LIVE_VAULT;
        emit ModeActivated(TreasuryMode.LIVE_VAULT, block.timestamp);
        _resetActivationConfirmations();
    }

    function confirmActivateLiveVault() external onlySigner {
        if (mode == TreasuryMode.LIVE_VAULT) revert AlreadyInLiveMode();
        if (activationConfirmed[msg.sender]) revert AlreadyConfirmed();

        activationConfirmed[msg.sender] = true;
        activationConfirmationCount++;

        emit ActivationConfirmed(msg.sender, activationConfirmationCount);
        if (activationConfirmationCount >= requiredSignatures) {
            mode = TreasuryMode.LIVE_VAULT;
            emit ModeActivated(TreasuryMode.LIVE_VAULT, block.timestamp);
            _resetActivationConfirmations();
        }
    }

    function revokeActivateConfirmation() external onlySigner {
        if (!activationConfirmed[msg.sender]) revert NotConfirmed();
        activationConfirmed[msg.sender] = false;
        activationConfirmationCount--;

        emit ActivationConfirmationRevoked(msg.sender, activationConfirmationCount);
    }

    function _resetActivationConfirmations() internal {
        for (uint256 i = 0; i < signers.length; i++) {
            activationConfirmed[signers[i]] = false;
        }
        activationConfirmationCount = 0;
    }

    // =========================================================================
    // CONTRIBUTION RECORDING (LEDGER_ONLY mode)
    // =========================================================================

    function recordContribution(
        address member,
        uint256 amountKES,
        uint256 amountStable,
        string calldata referenceCode
    ) external onlySigner {
        if (amountKES == 0) revert ZeroAmount();
        if (member == address(0)) revert ZeroAddress();

        if (!isMember[member]) {
            members.push(member);
            isMember[member] = true;
            emit MemberAdded(member);
        }

        ContributionRecord storage record = contributions[member];
        record.totalAmountKES += amountKES;
        record.totalAmountStable += amountStable;
        record.contributionCount++;
        record.lastContribution = block.timestamp;

        totalContributionsKES += amountKES;
        totalContributionsStable += amountStable;
        emit ContributionRecorded(
            member,
            amountStable,
            amountKES,
            referenceCode,
            msg.sender,
            block.timestamp
        );
    }

    function recordMissedContribution(address member) external onlySigner {
        if (!isMember[member]) revert NotMember();
        contributions[member].missedCount++;
        emit MissedContribution(member, block.timestamp);
    }

    // =========================================================================
    // DIRECT DEPOSITS (LIVE_VAULT mode)
    // =========================================================================

    function deposit(uint256 amount) external nonReentrant inLiveMode whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (!isMember[msg.sender]) {
            members.push(msg.sender);
            isMember[msg.sender] = true;
            emit MemberAdded(msg.sender);
        }

        stablecoin.safeTransferFrom(msg.sender, address(this), amount);

        ContributionRecord storage record = contributions[msg.sender];
        record.totalAmountStable += amount;
        record.contributionCount++;
        record.lastContribution = block.timestamp;

        totalContributionsStable += amount;

        emit ContributionDeposited(msg.sender, amount, block.timestamp);
    }

    // =========================================================================
    // PROPOSAL SYSTEM
    // =========================================================================

    function proposeWithdrawal(
        address recipient,
        uint256 amount,
        uint256 amountKES,
        string calldata reason,
        ProposalType proposalType,
        uint256 strategyId
    ) external onlySigner returns (uint256 proposalId) {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        if (mode == TreasuryMode.LIVE_VAULT) {
            uint256 balance = stablecoin.balanceOf(address(this));
            if (balance < amount) revert InsufficientVaultBalance(balance, amount);
        }

        // If this is an investment proposal, ensure registry approves it
        if (proposalType == ProposalType.INVESTMENT) {
            if (strategyRegistry == address(0)) revert ZeroAddress();
            if (!IStrategyRegistry(strategyRegistry).isStrategyActive(strategyId)) revert StrategyNotActive();
        }

        uint256 delay = amount <= smallTransferLimit
            ? smallTransferDelay
            : largeTransferDelay;

        proposalId = proposalCount++;
        Proposal storage p = proposals[proposalId];
        p.strategyId = strategyId;
        // attach current loan APY if this is a LOAN proposal
        if (proposalType == ProposalType.LOAN && apyCalculator != address(0)) {
            try IFloatingAPYCalculator(apyCalculator).getCurrentAPY() returns (uint256 apy) {
                p.loanApyBp = apy;
            } catch {
                p.loanApyBp = 0;
            }
        } else {
            p.loanApyBp = 0;
        }
        p.id = proposalId;
        p.proposalType = proposalType;
        p.proposedBy = msg.sender;
        p.recipient = recipient;
        p.amount = amount;
        p.amountKES = amountKES;
        p.reason = reason;
        p.status = ProposalStatus.PENDING;
        p.confirmations = 1;
        p.createdAt = block.timestamp;
        p.executableAfter = block.timestamp + delay;
        p.confirmedBy[msg.sender] = true;

        if (p.confirmations >= requiredSignatures) {
            p.status = ProposalStatus.APPROVED;
        }

        emit ProposalCreated(
            proposalId,
            proposalType,
            msg.sender,
            recipient,
            amount,
            p.executableAfter
        );
        emit ProposalConfirmed(proposalId, msg.sender, 1);

        return proposalId;
    }

    function proposeWithdrawalByModule(
        address recipient,
        uint256 amount,
        uint256 amountKES,
        string calldata reason,
        uint8 proposalTypeType,
        uint256 strategyId
    ) external returns (uint256 proposalId) {
        if (!approvedProposers[msg.sender]) revert NotSigner();
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (mode == TreasuryMode.LIVE_VAULT) {
            uint256 balance = stablecoin.balanceOf(address(this));
            if (balance < amount) revert InsufficientVaultBalance(balance, amount);
        }

        // If this is an investment proposal, ensure registry approves it
        if (ProposalType(proposalTypeType) == ProposalType.INVESTMENT) {
            if (strategyRegistry == address(0)) revert ZeroAddress();
            if (!IStrategyRegistry(strategyRegistry).isStrategyActive(strategyId)) revert StrategyNotActive();
        }

        uint256 delay = amount <= smallTransferLimit
            ? smallTransferDelay
            : largeTransferDelay;

        proposalId = proposalCount++;
        Proposal storage p = proposals[proposalId];
        p.strategyId = strategyId;
        if (ProposalType(proposalTypeType) == ProposalType.LOAN && apyCalculator != address(0)) {
            try IFloatingAPYCalculator(apyCalculator).getCurrentAPY() returns (uint256 apy) {
                p.loanApyBp = apy;
            } catch {
                p.loanApyBp = 0;
            }
        } else {
            p.loanApyBp = 0;
        }
        p.id = proposalId;
        p.proposalType = ProposalType(proposalTypeType);
        p.proposedBy = msg.sender; 
        p.recipient = recipient;
        p.amount = amount;
        p.amountKES = amountKES;
        p.reason = reason;
        p.status = ProposalStatus.PENDING;
        p.confirmations = 0;
        p.createdAt = block.timestamp;
        p.executableAfter = block.timestamp + delay;
        emit ProposalCreated(
            proposalId,
            p.proposalType,
            msg.sender,
            recipient,
            amount,
            p.executableAfter
        );
        return proposalId;
    }

    function setApprovedProposer(address proposer, bool approved) external onlyDeployer {
        approvedProposers[proposer] = approved;
        emit ApprovedProposerUpdated(proposer, approved);
    }

    // --- Strategy Registry Integration ---
    function setRegistry(address _registry) external onlyDeployer {
        if (_registry == address(0)) revert ZeroAddress();
        strategyRegistry = _registry;
    }

    function setApyCalculator(address _calculator) external onlyDeployer {
        if (_calculator == address(0)) revert ZeroAddress();
        apyCalculator = _calculator;
    }

    function confirmProposal(uint256 proposalId)
        external
        onlySigner
        proposalExists(proposalId)
    {
        Proposal storage p = proposals[proposalId];
        if (p.cancelled) revert ProposalCancelledError();
        if (p.status == ProposalStatus.EXECUTED) revert ProposalAlreadyExecuted();
        if (p.confirmedBy[msg.sender]) revert AlreadyConfirmed();

        p.confirmedBy[msg.sender] = true;
        p.confirmations++;
        emit ProposalConfirmed(proposalId, msg.sender, p.confirmations);

        if (p.confirmations >= requiredSignatures) {
            p.status = ProposalStatus.APPROVED;
        }
    }

    function revokeConfirmation(uint256 proposalId)
        external
        onlySigner
        proposalExists(proposalId)
    {
        Proposal storage p = proposals[proposalId];
        if (p.status == ProposalStatus.EXECUTED) revert ProposalAlreadyExecuted();
        if (!p.confirmedBy[msg.sender]) revert NotConfirmed();

        p.confirmedBy[msg.sender] = false;
        p.confirmations--;
        if (p.status == ProposalStatus.APPROVED &&
            p.confirmations < requiredSignatures) {
            p.status = ProposalStatus.PENDING;
        }

        emit ConfirmationRevoked(proposalId, msg.sender);
    }

    function executeProposal(uint256 proposalId)
        external
        nonReentrant
        onlySigner
        proposalExists(proposalId)
    {
        Proposal storage p = proposals[proposalId];

        if (p.cancelled) revert ProposalCancelledError();
        if (p.status == ProposalStatus.EXECUTED) revert ProposalAlreadyExecuted();
        if (p.status != ProposalStatus.APPROVED)
            revert InsufficientConfirmations(p.confirmations, requiredSignatures);
        if (block.timestamp < p.executableAfter)
            revert TimelockNotExpired(p.executableAfter);
        
        p.status = ProposalStatus.EXECUTED;

        if (mode == TreasuryMode.LIVE_VAULT) {
            uint256 balance = stablecoin.balanceOf(address(this));
            if (balance < p.amount)
                revert InsufficientVaultBalance(balance, p.amount);
            stablecoin.safeTransfer(p.recipient, p.amount);

            if (p.proposedBy != address(0)) {
                try IRotationModule(p.proposedBy).onTreasuryProposalExecuted(proposalId, p.recipient, p.amount) {
                } catch {
                    // ignore
                }
            }
        }

        emit ProposalExecuted(proposalId, msg.sender, p.recipient, p.amount);
    }

    function cancelProposal(uint256 proposalId)
        external
        onlySigner
        proposalExists(proposalId)
    {
        Proposal storage p = proposals[proposalId];
        if (p.status == ProposalStatus.EXECUTED) revert ProposalAlreadyExecuted();
        if (p.cancelled) revert ProposalCancelledError();
        require(
            msg.sender == p.proposedBy || p.status == ProposalStatus.PENDING,
            "Only proposer can cancel approved proposals"
        );
        p.cancelled = true;
        p.status = ProposalStatus.CANCELLED;

        emit ProposalCancelled(proposalId, msg.sender);
    }

    // =========================================================================
    // SIGNER MANAGEMENT (via multisig)
    // =========================================================================

    function addSigner(address newSigner, string calldata name)
        external
        onlyDeployer
    {
        if (newSigner == address(0)) revert ZeroAddress();
        if (isSigner[newSigner]) revert AlreadySigner();
        if (signers.length >= MAX_SIGNERS) revert InvalidSignerCount();

        signers.push(newSigner);
        isSigner[newSigner] = true;
        signerInfo[newSigner] = SignerInfo({
            addr: newSigner,
            name: name,
            addedAt: block.timestamp,
            active: true
        });
        if (!isMember[newSigner]) {
            members.push(newSigner);
            isMember[newSigner] = true;
            emit MemberAdded(newSigner);
        }

        emit SignerAdded(newSigner, name);
    }

    function removeSigner(address signer) external onlyDeployer {
        if (signer == msg.sender) revert CannotRemoveSelf();
        if (!isSigner[signer]) revert NotSigner();
        if (signers.length - 1 < MIN_SIGNERS) revert BelowMinSigners();

        isSigner[signer] = false;
        signerInfo[signer].active = false;
        for (uint256 i = 0; i < signers.length; i++) {
            if (signers[i] == signer) {
                signers[i] = signers[signers.length - 1];
                signers.pop();
                break;
            }
        }

        if (requiredSignatures > signers.length) {
            requiredSignatures = signers.length;
        }

        emit SignerRemoved(signer);
    }

    function updateThreshold(uint256 newThreshold) external onlyDeployer {
        if (newThreshold < 2 || newThreshold > signers.length)
            revert InvalidThreshold();
        requiredSignatures = newThreshold;
    }

    // =========================================================================
    // TIMELOCK CONFIGURATION
    // =========================================================================

    function updateTimelocks(
        uint256 _smallLimit,
        uint256 _smallDelay,
        uint256 _largeDelay
    ) external onlyDeployer {
        require(_largeDelay >= _smallDelay, "Large delay must >= small delay");
        smallTransferLimit = _smallLimit;
        smallTransferDelay = _smallDelay;
        largeTransferDelay = _largeDelay;
        emit TimelockUpdated(_smallLimit, _smallDelay, _largeDelay);
    }

    // =========================================================================
    // PAUSE (emergency)
    // =========================================================================

    function pause() external onlyDeployer { _pause(); }
    function unpause() external onlyDeployer { _unpause(); }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    function getBalance() external view returns (uint256) {
        return stablecoin.balanceOf(address(this));
    }

    function getMemberShareBps(address member) external view returns (uint256) {
        if (mode == TreasuryMode.LIVE_VAULT) {
            if (totalContributionsStable == 0) return 0;
            return (contributions[member].totalAmountStable * 10000)
                / totalContributionsStable;
        } else {
            if (totalContributionsKES == 0) return 0;
            return (contributions[member].totalAmountKES * 10000)
                / totalContributionsKES;
        }
    }

    function getMemberContributions(address member)
        external
        view
        returns (
            uint256 totalKES,
            uint256 totalStable,
            uint256 count,
            uint256 missedCount,
            uint256 lastContribution,
            uint256 shareBps
        )
    {
        ContributionRecord storage r = contributions[member];
        return (
            r.totalAmountKES,
            r.totalAmountStable,
            r.contributionCount,
            r.missedCount,
            r.lastContribution,
            this.getMemberShareBps(member)
        );
    }

    function getMembers() external view returns (address[] memory) {
        return members;
    }

    function getSigners() external view returns (address[] memory) {
        return signers;
    }

    function hasConfirmed(uint256 proposalId, address signer)
        external
        view
        returns (bool)
    {
        return proposals[proposalId].confirmedBy[signer];
    }

    function getProposal(uint256 proposalId)
        external
        view
        proposalExists(proposalId)
        returns (
            ProposalType proposalType,
            address proposedBy,
            address recipient,
            uint256 amount,
            uint256 amountKES,
            string memory reason,
            ProposalStatus status,
            uint256 confirmations,
            uint256 executableAfter,
            bool cancelled,
            uint256 loanApyBp
        )
    {
        Proposal storage p = proposals[proposalId];
        return (
            p.proposalType,
            p.proposedBy,
            p.recipient,
            p.amount,
            p.amountKES,
            p.reason,
            p.status,
            p.confirmations,
            p.executableAfter,
            p.cancelled
            ,p.loanApyBp
        );
    }

    function getTreasuryOverview()
        external
        view
        returns (
            string memory name,
            TreasuryMode currentMode,
            uint256 balance,
            uint256 totalKES,
            uint256 totalStable,
            uint256 memberCount,
            uint256 signerCount,
            uint256 activeProposals
        )
    {
        uint256 pending = 0;
        for (uint256 i = 0; i < proposalCount; i++) {
            if (proposals[i].status == ProposalStatus.PENDING ||
                proposals[i].status == ProposalStatus.APPROVED) {
                pending++;
            }
        }

        return (
            chamaName,
            mode,
            stablecoin.balanceOf(address(this)),
            totalContributionsKES,
            totalContributionsStable,
            members.length,
            signers.length,
            pending
        );
    }
}