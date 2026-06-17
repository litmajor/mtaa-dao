// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IChamaTreasury {
    // proposalType: 0 = WITHDRAWAL
    function proposeWithdrawalByModule(
        address recipient,
        uint256 amount,
        uint256 amountKES,
        string calldata reason,
        uint8 proposalTypeType,
        uint256 strategyId
    ) external returns (uint256 proposalId);
}

/**
 * @title RotationModule
 * @notice Rotating savings (merry-go-round / ROSC) module
 * @dev Manages sequential payout rotation for cyclical savings groups.
 *      Designed to work alongside ChamaTreasury - funds live in the treasury,
 *      RotationModule tracks state and authorizes disbursements.
 *
 * Typical flow (20-member merry-go-round, KES 2,000/month each):
 *   Month 1: All 20 members contribute KES 2,000 → pool = KES 40,000
 *            Alice receives KES 40,000
 *   Month 2: All contribute again → Bob receives KES 40,000
 *   ...
 *   Month 20: All contribute → last member receives → cycle complete
 *
 * Fixes applied vs original:
 *  [1] Min members reduced from 5 to 2 (real chamas can be small)
 *  [2] Lottery selection reverts until VRF is integrated (no predictable randomness)
 *  [3] cycleEndDate uses 30 days × cycles (not 356 days × cycles)
 *  [4] hasPaidThisMonth replaced with cycle-keyed mapping (O(1), no reset loop)
 *  [5] Minimum participation threshold before payout
 *  [6] Funds stay in ChamaTreasury - RotationModule tracks state only
 *  [7] swapRotationPositions restricted to future cycles only (can't swap after payout)
 */
contract RotationModule is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // =========================================================================
    // TYPES
    // =========================================================================

    enum RotationSelectionMethod {
        SEQUENTIAL,     // Fixed order (most common for chamas)
        LOTTERY,        // Random - requires VRF (not yet active)
        PROPORTIONAL    // By contribution weight
    }

    enum RotationStatus { ACTIVE, COMPLETED, CANCELLED }

    struct RotationCycle {
        uint256 cycleNumber;
        address currentRecipient;
        uint256 expectedPool;           // Expected total (all members × contribution)
        uint256 actualPool;             // Actual collected this cycle
        uint256 amountDistributed;
        RotationStatus status;
        uint256 distributionDate;
        uint256 nextDistributionDate;
        bool hasBeenDistributed;
    }

    struct RotationConfig {
        uint256 totalMembers;
        uint256 totalCycles;
        uint256 cycleStartDate;
        uint256 cycleEndDate;           // block.timestamp + 30 days × totalCycles
        uint256 monthlyContribution;    // Fixed per-member contribution (stablecoin units)
        uint256 minimumParticipationBps; // e.g., 8000 = 80% must pay before payout
        RotationSelectionMethod selectionMethod;
        address chamaTreasury;          // ChamaTreasury that holds actual funds
        address stablecoin;             // cUSD or other stablecoin
    }

    struct RotationProgress {
        uint256 currentCycleNumber;
        address[] memberList;
        mapping(address => uint256) memberRotationIndex;
        // cycle-keyed payment tracking - no reset loop needed
        mapping(uint256 cycleNumber => mapping(address => bool)) hasPaid;
        mapping(uint256 cycleNumber => uint256) paidCountByCycle;
    }

    // =========================================================================
    // STATE
    // =========================================================================

    // vault address → config
    mapping(address => RotationConfig) public configs;
    // vault address → progress
    mapping(address => RotationProgress) private progress;
    // vault address → cycle number → cycle data
    mapping(address => mapping(uint256 => RotationCycle)) public cycles;

    mapping(address => uint256) public totalDistributed;
    mapping(address => uint256) public totalCollected;
    // Track proposals created on ChamaTreasury -> vault/cycle mapping
    mapping(uint256 => address) public proposalVault;
    mapping(uint256 => uint256) public proposalCycle;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event RotationInitialized(
        address indexed vault,
        address indexed chamaTreasury,
        uint256 totalMembers,
        uint256 totalCycles,
        uint256 monthlyContribution,
        uint256 cycleEndDate
    );

    event ContributionRecorded(
        address indexed vault,
        address indexed contributor,
        uint256 cycleNumber,
        uint256 amount,
        uint256 paidCountThisCycle
    );

    event CycleDistributed(
        address indexed vault,
        uint256 indexed cycleNumber,
        address indexed recipient,
        uint256 amount,
        uint256 participationBps
    );

    event CycleAdvanced(
        address indexed vault,
        uint256 newCycleNumber,
        address nextRecipient,
        uint256 nextDistributionDate
    );

    event RotationCompleted(
        address indexed vault,
        uint256 totalCycles,
        uint256 totalDistributedAmount
    );

    event PositionSwapped(
        address indexed vault,
        address indexed member1,
        address indexed member2,
        uint256 position1,
        uint256 position2
    );

    event RotationCancelled(
        address indexed vault,
        uint256 cycleNumber,
        string reason
    );

    event CycleDistributionProposed(
        address indexed vault,
        uint256 indexed cycleNumber,
        address indexed recipient,
        uint256 amount,
        uint256 proposalId
    );

    event CycleDistributionConfirmed(
        address indexed vault,
        uint256 indexed cycleNumber,
        address indexed recipient,
        uint256 amount,
        uint256 proposalId
    );

    // =========================================================================
    // ERRORS
    // =========================================================================

    error InvalidMemberCount();
    error InvalidContribution();
    error InvalidParticipationThreshold();
    error ZeroAddress();
    error RotationNotInitialized();
    error CycleAlreadyDistributed();
    error InsufficientParticipation(uint256 actual, uint256 required);
    error InsufficientFunds(uint256 available, uint256 required);
    error AlreadyPaidThisCycle();
    error NotAMember();
    error LotteryRequiresVRF();
    error CannotSwapPastCycle();
    error RotationAlreadyInitialized();

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor() Ownable(msg.sender) {}

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * @notice Initialize a rotation for a specific vault/chama
     * @param vault         Identifier for this rotation (can be ChamaTreasury address)
     * @param members       Members in rotation order (min 2, max 1000)
     * @param monthlyContribution Per-member contribution per cycle (stablecoin units)
     * @param selectionMethod SEQUENTIAL recommended; LOTTERY requires VRF
     * @param minimumParticipationBps Minimum % of members who must pay before payout
     *                                (e.g., 8000 = 80%). Set to 10000 to require all.
     * @param chamaTreasury ChamaTreasury contract that holds actual funds
     * @param stablecoin    cUSD or other stablecoin address
     */
    function initializeRotation(
        address vault,
        address[] calldata members,
        uint256 monthlyContribution,
        RotationSelectionMethod selectionMethod,
        uint256 minimumParticipationBps,
        address chamaTreasury,
        address stablecoin
    ) external onlyOwner {
        if (vault == address(0)) revert ZeroAddress();
        if (chamaTreasury == address(0)) revert ZeroAddress();
        if (stablecoin == address(0)) revert ZeroAddress();
        if (members.length < 2 || members.length > 1000) revert InvalidMemberCount();
        if (monthlyContribution == 0) revert InvalidContribution();
        if (minimumParticipationBps > 10000) revert InvalidParticipationThreshold();
        if (configs[vault].totalMembers != 0) revert RotationAlreadyInitialized();

        // Lottery requires VRF - block initialization until implemented
        if (selectionMethod == RotationSelectionMethod.LOTTERY) {
            revert LotteryRequiresVRF();
        }

        uint256 totalCycles = members.length; // one payout per member

        configs[vault] = RotationConfig({
            totalMembers:             members.length,
            totalCycles:              totalCycles,
            cycleStartDate:           block.timestamp,
            cycleEndDate:             block.timestamp + (30 days * totalCycles),
            monthlyContribution:      monthlyContribution,
            minimumParticipationBps:  minimumParticipationBps,
            selectionMethod:          selectionMethod,
            chamaTreasury:            chamaTreasury,
            stablecoin:               stablecoin
        });

        RotationProgress storage prog = progress[vault];
        prog.currentCycleNumber = 1;
        prog.memberList = members;

        for (uint256 i = 0; i < members.length; i++) {
            prog.memberRotationIndex[members[i]] = i;
        }

        // Initialize first cycle
        cycles[vault][1] = RotationCycle({
            cycleNumber:          1,
            currentRecipient:     members[0],
            expectedPool:         monthlyContribution * members.length,
            actualPool:           0,
            amountDistributed:    0,
            status:               RotationStatus.ACTIVE,
            distributionDate:     0,
            nextDistributionDate: block.timestamp + 30 days,
            hasBeenDistributed:   false
        });

        emit RotationInitialized(
            vault,
            chamaTreasury,
            members.length,
            totalCycles,
            monthlyContribution,
            block.timestamp + (30 days * totalCycles)
        );
    }

    // =========================================================================
    // CONTRIBUTION RECORDING
    // =========================================================================

    /**
     * @notice Record that a member has contributed this cycle
     * @dev Contributions are made directly to ChamaTreasury (not this contract).
     *      This function records the payment in rotation state only.
     *      Called by the server oracle after verifying the treasury deposit.
     * @param vault     Rotation vault identifier
     * @param member    Member who paid
     * @param amount    Amount paid (must equal monthlyContribution)
     */
    function recordContribution(
        address vault,
        address member,
        uint256 amount
    ) external onlyOwner {
        RotationConfig storage config = configs[vault];
        if (config.totalMembers == 0) revert RotationNotInitialized();
        if (amount != config.monthlyContribution) revert InvalidContribution();

        RotationProgress storage prog = progress[vault];
        uint256 cycleNum = prog.currentCycleNumber;

        // Check member is registered
        bool isMember = false;
        for (uint256 i = 0; i < prog.memberList.length; i++) {
            if (prog.memberList[i] == member) { isMember = true; break; }
        }
        if (!isMember) revert NotAMember();

        if (prog.hasPaid[cycleNum][member]) revert AlreadyPaidThisCycle();

        prog.hasPaid[cycleNum][member] = true;
        prog.paidCountByCycle[cycleNum]++;

        cycles[vault][cycleNum].actualPool += amount;
        totalCollected[vault] += amount;

        emit ContributionRecorded(
            vault,
            member,
            cycleNum,
            amount,
            prog.paidCountByCycle[cycleNum]
        );
    }

    // =========================================================================
    // DISTRIBUTION
    // =========================================================================

    /**
     * @notice Distribute accumulated pool to current cycle recipient
     * @dev Verifies participation threshold, then transfers from ChamaTreasury
     *      to the recipient. ChamaTreasury must have approved this contract
     *      or the transfer must be executed via a treasury proposal.
     *
     *      For MVP: caller (owner/oracle) executes this after treasury proposal
     *      has been approved and timelock has passed.
     *
     * @param vault Rotation vault identifier
     */
    function distributeToRecipient(address vault)
        external
        onlyOwner
        nonReentrant
        whenNotPaused
    {
        RotationConfig storage config = configs[vault];
        if (config.totalMembers == 0) revert RotationNotInitialized();

        RotationProgress storage prog = progress[vault];
        uint256 cycleNum = prog.currentCycleNumber;
        RotationCycle storage cycle = cycles[vault][cycleNum];

        if (cycle.hasBeenDistributed) revert CycleAlreadyDistributed();

        // Check participation threshold
        uint256 paidCount = prog.paidCountByCycle[cycleNum];
        uint256 participationBps = (paidCount * 10000) / config.totalMembers;

        if (participationBps < config.minimumParticipationBps) {
            revert InsufficientParticipation(participationBps, config.minimumParticipationBps);
        }

        // Distribute actual collected amount (not expected)
        // If some members didn't pay, recipient gets proportionally less
        uint256 amountToSend = cycle.actualPool;
        if (amountToSend == 0) revert InsufficientFunds(0, config.monthlyContribution);

        // Verify treasury has sufficient balance
        uint256 treasuryBalance = IERC20(config.stablecoin).balanceOf(config.chamaTreasury);
        if (treasuryBalance < amountToSend) {
            revert InsufficientFunds(treasuryBalance, amountToSend);
        }

        // Create a ChamaTreasury proposal for the payout instead of pulling
        // funds via approval. Record the mapping so we can confirm once the
        // treasury executes the proposal.
        string memory reason = "Rotation payout";
        uint256 proposalId = IChamaTreasury(config.chamaTreasury).proposeWithdrawalByModule(
            cycle.currentRecipient,
            amountToSend,
            0,
            reason,
            0, // ProposalType.WITHDRAWAL
            0  // strategyId (not used for withdrawals)
        );

        // Map proposal -> vault/cycle so we can confirm on execution
        proposalVault[proposalId] = vault;
        proposalCycle[proposalId] = cycleNum;

        emit CycleDistributionProposed(
            vault,
            cycleNum,
            cycle.currentRecipient,
            amountToSend,
            proposalId
        );

        emit CycleDistributed(
            vault,
            cycleNum,
            cycle.currentRecipient,
            amountToSend,
            participationBps
        );

        // Advance to next cycle or complete rotation
        if (cycleNum < config.totalCycles) {
            _advanceToNextCycle(vault);
        } else {
            emit RotationCompleted(vault, config.totalCycles, totalDistributed[vault]);
        }
    }

    // =========================================================================
    // INTERNAL: ADVANCE CYCLE
    // =========================================================================

    function _advanceToNextCycle(address vault) private {
        RotationConfig storage config = configs[vault];
        RotationProgress storage prog = progress[vault];

        uint256 nextCycleNum = prog.currentCycleNumber + 1;
        prog.currentCycleNumber = nextCycleNum;

        address nextRecipient;

        if (config.selectionMethod == RotationSelectionMethod.SEQUENTIAL) {
            // Sequential: next in list (wraps, but rotation ends at totalCycles)
            uint256 nextIndex = (nextCycleNum - 1) % config.totalMembers;
            nextRecipient = prog.memberList[nextIndex];
        } else {
            // PROPORTIONAL: backend determines order; use sequential as fallback
            uint256 nextIndex = (nextCycleNum - 1) % config.totalMembers;
            nextRecipient = prog.memberList[nextIndex];
        }

        uint256 nextDistDate = block.timestamp + 30 days;

        cycles[vault][nextCycleNum] = RotationCycle({
            cycleNumber:          nextCycleNum,
            currentRecipient:     nextRecipient,
            expectedPool:         config.monthlyContribution * config.totalMembers,
            actualPool:           0,
            amountDistributed:    0,
            status:               RotationStatus.ACTIVE,
            distributionDate:     0,
            nextDistributionDate: nextDistDate,
            hasBeenDistributed:   false
        });

        emit CycleAdvanced(vault, nextCycleNum, nextRecipient, nextDistDate);
    }

    // =========================================================================
    // POSITION SWAP
    // =========================================================================

    /**
     * @notice Swap rotation positions between two members
     * @dev Only allowed for future (undistributed) cycles
     */
    function swapRotationPositions(
        address vault,
        address member1,
        address member2
    ) external onlyOwner whenNotPaused {
        RotationProgress storage prog = progress[vault];
        RotationConfig storage config = configs[vault];

        uint256 idx1 = prog.memberRotationIndex[member1];
        uint256 idx2 = prog.memberRotationIndex[member2];

        // Cannot swap a position that has already been paid out
        uint256 currentCycle = prog.currentCycleNumber;
        if (idx1 < currentCycle || idx2 < currentCycle) {
            revert CannotSwapPastCycle();
        }

        // Swap in member list
        prog.memberList[idx1] = member2;
        prog.memberList[idx2] = member1;

        prog.memberRotationIndex[member1] = idx2;
        prog.memberRotationIndex[member2] = idx1;

        // Update upcoming cycle recipients if affected
        for (uint256 c = currentCycle; c <= config.totalCycles; c++) {
            if (!cycles[vault][c].hasBeenDistributed) {
                uint256 recipientIdx = (c - 1) % config.totalMembers;
                cycles[vault][c].currentRecipient = prog.memberList[recipientIdx];
            }
        }

        emit PositionSwapped(vault, member1, member2, idx1, idx2);
    }

    // =========================================================================
    // PAUSE
    // =========================================================================

    /**
     * @notice Pause distribution operations in this module.
     * @dev Allows DAO (owner) to halt payouts without pausing the ChamaTreasury.
     */
    function pauseModule() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause distribution operations.
     */
    function unpauseModule() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Cancel rotation (emergency)
     */
    function cancelRotation(address vault, string calldata reason)
        external
        onlyOwner
    {
        RotationProgress storage prog = progress[vault];
        uint256 cycleNum = prog.currentCycleNumber;
        cycles[vault][cycleNum].status = RotationStatus.CANCELLED;
        emit RotationCancelled(vault, cycleNum, reason);
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    function getRotationConfig(address vault)
        external
        view
        returns (RotationConfig memory)
    {
        return configs[vault];
    }

    function getCurrentCycle(address vault)
        external
        view
        returns (RotationCycle memory)
    {
        RotationProgress storage prog = progress[vault];
        return cycles[vault][prog.currentCycleNumber];
    }

    function getMemberList(address vault)
        external
        view
        returns (address[] memory)
    {
        return progress[vault].memberList;
    }

    function getNextRecipient(address vault)
        external
        view
        returns (address)
    {
        RotationProgress storage prog = progress[vault];
        RotationConfig storage config = configs[vault];
        uint256 nextCycle = prog.currentCycleNumber + 1;
        if (nextCycle > config.totalCycles) return address(0);
        return cycles[vault][nextCycle].currentRecipient;
    }

    function getMemberContributionStatus(address vault)
        external
        view
        returns (uint256 paidCount, uint256 totalCount)
    {
        RotationProgress storage prog = progress[vault];
        RotationConfig storage config = configs[vault];
        return (
            prog.paidCountByCycle[prog.currentCycleNumber],
            config.totalMembers
        );
    }

    function hasMemberPaid(address vault, address member)
        external
        view
        returns (bool)
    {
        RotationProgress storage prog = progress[vault];
        return prog.hasPaid[prog.currentCycleNumber][member];
    }

    function getRotationProgress(address vault)
        external
        view
        returns (
            uint256 cyclesCompleted,
            uint256 totalCycles,
            uint256 totalDistributedAmount,
            uint256 totalCollectedAmount,
            uint256 currentParticipationBps
        )
    {
        RotationProgress storage prog = progress[vault];
        RotationConfig storage config = configs[vault];

        uint256 paidCount = prog.paidCountByCycle[prog.currentCycleNumber];
        uint256 participationBps = config.totalMembers > 0
            ? (paidCount * 10000) / config.totalMembers
            : 0;

        return (
            prog.currentCycleNumber - 1,
            config.totalCycles,
            totalDistributed[vault],
            totalCollected[vault],
            participationBps
        );
    }

    /**
     * @notice Callback invoked by ChamaTreasury after a proposal created by
     *         this module has been executed. Marks cycle as distributed.
     * @dev Only callable by the configured ChamaTreasury for the vault.
     */
    function onTreasuryProposalExecuted(uint256 proposalId, address recipient, uint256 amount) external {
        address vault = proposalVault[proposalId];
        uint256 cycleNum = proposalCycle[proposalId];
        if (vault == address(0)) revert RotationNotInitialized();

        RotationConfig storage config = configs[vault];
        if (msg.sender != config.chamaTreasury) revert ZeroAddress();

        RotationCycle storage cycle = cycles[vault][cycleNum];
        if (cycle.hasBeenDistributed) revert CycleAlreadyDistributed();

        // Basic sanity checks: recipient and amount should match expectations
        if (cycle.currentRecipient != recipient) revert InvalidContribution();
        if (amount == 0) revert InsufficientFunds(0, 1);

        // Mark distributed now that treasury executed the transfer
        cycle.hasBeenDistributed = true;
        cycle.status = RotationStatus.COMPLETED;
        cycle.distributionDate = block.timestamp;
        cycle.amountDistributed = amount;

        totalDistributed[vault] += amount;

        // Emit confirmation event and original distribution event
        emit CycleDistributionConfirmed(vault, cycleNum, recipient, amount, proposalId);
        emit CycleDistributed(vault, cycleNum, recipient, amount, (progress[vault].paidCountByCycle[cycleNum] * 10000) / config.totalMembers);

        // Advance to next cycle or complete rotation
        if (cycleNum < config.totalCycles) {
            _advanceToNextCycle(vault);
        } else {
            emit RotationCompleted(vault, config.totalCycles, totalDistributed[vault]);
        }
    }

    /**
     * @notice Check if current cycle is ready to distribute
     */
    function isReadyToDistribute(address vault)
        external
        view
        returns (bool ready, string memory reason)
    {
        RotationConfig storage config = configs[vault];
        RotationProgress storage prog = progress[vault];

        if (config.totalMembers == 0) return (false, "Not initialized");

        RotationCycle storage cycle = cycles[vault][prog.currentCycleNumber];
        if (cycle.hasBeenDistributed) return (false, "Already distributed");

        uint256 paidCount = prog.paidCountByCycle[prog.currentCycleNumber];
        uint256 participationBps = (paidCount * 10000) / config.totalMembers;

        if (participationBps < config.minimumParticipationBps) {
            return (false, "Insufficient participation");
        }

        if (block.timestamp < cycle.nextDistributionDate) {
            return (false, "Too early - wait for distribution date");
        }

        return (true, "Ready");
    }
}
