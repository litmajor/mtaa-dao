// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TokenDistributionInitializer
 * @notice One-shot contract to initialize MTAA token vesting schedules
 *
 * Vesting schedule (1B total supply):
 *   Community Rewards:  300M (30%) — 6mo cliff, 48mo linear
 *   Ecosystem Dev:      200M (20%) — 3mo cliff, 36mo linear
 *   Strategic Partners: 100M (10%) — 7mo cliff, 36mo linear
 *   Team:               150M (15%) — 13mo cliff, 48mo linear
 *   Early Stakers:       75M  (7%) — 0 cliff, distributed via airdrop
 *   Owner reserve:      175M (17%) — held by owner (contingency + governance)
 *   ─────────────────────────────────
 *   Total:             1000M (100%)
 *
 * Critical constraint:
 *   MTAAToken constructor mints only 125M to owner (12.5% = liquidity + public sale).
 *   Full 825M vesting allocation requires owner to have acquired those tokens first.
 *   executeDistribution() validates owner balance before proceeding.
 *   If balance is insufficient, use executePartialDistribution() which scales
 *   proportionally to available balance.
 */

interface IMTAAToken {
    function createVestingSchedule(
        address beneficiary,
        uint256 amount,
        uint256 startTime,
        uint256 duration,
        uint256 cliffPeriod,
        uint8 vestingType
    ) external;

    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

contract TokenDistributionInitializer {
    using SafeERC20 for IERC20;

    // ── Updated Constants ─────────────────────────────────────────────────────

    uint256 public constant TOTAL_SUPPLY        = 1_000_000_000 * 1e18;

    // Updated to match Documentation
    uint256 public constant COMMUNITY_AMOUNT    = 400_000_000 * 1e18; // 400M
    // Split community pot into airdrop + ongoing rewards
    uint256 public constant AIRDROP_RESERVE     =  50_000_000 * 1e18; // 50M
    uint256 public constant COMMUNITY_REWARDS   = 350_000_000 * 1e18; // 350M (vested)
    uint256 public constant ECOSYSTEM_AMOUNT    = 100_000_000 * 1e18; // 100M
    uint256 public constant PARTNERS_AMOUNT     =  25_000_000 * 1e18; // 25M
    uint256 public constant TEAM_AMOUNT         = 150_000_000 * 1e18; // 150M

    // New categories from Documentation
    uint256 public constant LIQUIDITY_AMOUNT    =  75_000_000 * 1e18; // 7.5%
    uint256 public constant PUBLIC_SALE_AMOUNT  =  50_000_000 * 1e18; // 5%
    uint256 public constant DAO_TREASURY_RESERVE = 200_000_000 * 1e18; // 20%

    // Total vesting (community_rewards + ecosystem + partners + team + liquidity)
    // COMMUNITY_REWARDS (350) + ECOSYSTEM (100) + PARTNERS (25) + TEAM (150) + LIQUIDITY (75) = 700M
    uint256 public constant TOTAL_VESTING       = 700_000_000 * 1e18;

    // Vesting durations in seconds
    uint256 public constant MONTHS_3  =  90 days;
    uint256 public constant MONTHS_6  = 180 days;
    uint256 public constant MONTHS_7  = 210 days;
    uint256 public constant MONTHS_13 = 390 days;
    uint256 public constant MONTHS_36 = 1080 days;
    uint256 public constant MONTHS_48 = 1440 days;

    // MTAAToken VestingType enum values
    uint8 public constant VTYPE_COMMUNITY  = 0; // COMMUNITY_REWARDS
    uint8 public constant VTYPE_ECOSYSTEM  = 2; // ECOSYSTEM_DEV
    uint8 public constant VTYPE_PARTNERS   = 3; // STRATEGIC_PARTNERS
    uint8 public constant VTYPE_TEAM       = 1; // TEAM_ADVISORS

    // ── State ─────────────────────────────────────────────────────────────────

    IMTAAToken public mtaaToken;
    address public owner;
    bool public distributed;

    // Beneficiary addresses set at distribution time
    address public treasuryDAO;
    address public partnerFund;
    address public teamMultisig;
    address public stakersAirdropFund;

    // ── Events ────────────────────────────────────────────────────────────────

    event DistributionExecuted(
        address indexed executor,
        uint256 communityAmount,
        uint256 ecosystemAmount,
        uint256 partnersAmount,
        uint256 teamAmount,
        uint256 airdropAmount,
        uint256 liquidityAmount,
        uint256 publicSaleAmount,
        uint256 daoReserveAmount,
        uint256 timestamp
    );

    event PartialDistributionExecuted(
        address indexed executor,
        uint256 scaleFactor,   // scaled by 1e18
        uint256 totalDistributed,
        uint256 timestamp
    );

    // ── Errors ────────────────────────────────────────────────────────────────

    error OnlyOwner();
    error AlreadyDistributed();
    error InvalidAddress();
    error InsufficientOwnerBalance(uint256 available, uint256 required);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _mtaaToken, address _owner) {
        if (_mtaaToken == address(0) || _owner == address(0)) revert InvalidAddress();
        mtaaToken = IMTAAToken(_mtaaToken);
        owner = _owner;
    }

    // ── Full distribution (requires owner to hold full 825M) ─────────────────

    /**
     * @notice Execute full vesting distribution
     * @dev Owner must hold >= 825M MTAA before calling.
     *      This is the production path once full token supply is available.
     *
     * @param _treasuryDAO      Receives community rewards + ecosystem dev vesting
     * @param _partnerFund      Receives strategic partners vesting
     * @param _teamMultisig     Receives team vesting
     * @param _stakersAirdropFund Receives early staker airdrop reserve (MerkleDistributor)
     * @param _liquidityFund Receives liquidity allocation (direct transfer)
     * @param _publicSaleFund Receives public sale allocation (direct transfer)
     * @param _daoReserveFund Receives DAO treasury reserve (direct transfer)
     */
    function executeDistribution(
        address _treasuryDAO,
        address _partnerFund,
        address _teamMultisig,
        address _stakersAirdropFund,
        address _liquidityFund,
        address _publicSaleFund,
        address _daoReserveFund
    ) external {
        if (msg.sender != owner) revert OnlyOwner();
        if (distributed) revert AlreadyDistributed();
        if (_treasuryDAO == address(0)) revert InvalidAddress();
        if (_partnerFund == address(0)) revert InvalidAddress();
        if (_teamMultisig == address(0)) revert InvalidAddress();
        if (_stakersAirdropFund == address(0)) revert InvalidAddress();
        if (_liquidityFund == address(0)) revert InvalidAddress();
        if (_publicSaleFund == address(0)) revert InvalidAddress();
        if (_daoReserveFund == address(0)) revert InvalidAddress();

        uint256 balance = mtaaToken.balanceOf(owner);
        if (balance < TOTAL_VESTING) {
            revert InsufficientOwnerBalance(balance, TOTAL_VESTING);
        }

        distributed = true;
        treasuryDAO = _treasuryDAO;
        partnerFund = _partnerFund;
        teamMultisig = _teamMultisig;
        stakersAirdropFund = _stakersAirdropFund;

        uint256 startTime = block.timestamp;

        // Community Rewards (vested): 350M, 6mo cliff, 48mo linear
        mtaaToken.createVestingSchedule(
            _treasuryDAO,
            COMMUNITY_REWARDS,
            startTime,
            MONTHS_48,
            MONTHS_6,
            VTYPE_COMMUNITY
        );

        // Ecosystem Dev: 200M, 3mo cliff, 36mo linear
        mtaaToken.createVestingSchedule(
            _treasuryDAO,
            ECOSYSTEM_AMOUNT,
            startTime,
            MONTHS_36,
            MONTHS_3,
            VTYPE_ECOSYSTEM
        );

        // Strategic Partners: 100M, 7mo cliff, 36mo linear
        mtaaToken.createVestingSchedule(
            _partnerFund,
            PARTNERS_AMOUNT,
            startTime,
            MONTHS_36,
            MONTHS_7,
            VTYPE_PARTNERS
        );

        // Team: 150M, 13mo cliff, 48mo linear
        mtaaToken.createVestingSchedule(
            _teamMultisig,
            TEAM_AMOUNT,
            startTime,
            MONTHS_48,
            MONTHS_13,
            VTYPE_TEAM
        );
        // Airdrop reserve: send to MerkleDistributor (immediate transfer)
        IERC20(address(mtaaToken)).safeTransferFrom(
            owner,
            _stakersAirdropFund,
            AIRDROP_RESERVE
        );

        // Liquidity reserve: transfer directly to liquidity fund (immediate transfer)
        IERC20(address(mtaaToken)).safeTransferFrom(
            owner,
            _liquidityFund,
            LIQUIDITY_AMOUNT
        );

        // Public sale allocation: transfer directly
        IERC20(address(mtaaToken)).safeTransferFrom(
            owner,
            _publicSaleFund,
            PUBLIC_SALE_AMOUNT
        );

        // DAO treasury reserve: transfer directly
        IERC20(address(mtaaToken)).safeTransferFrom(
            owner,
            _daoReserveFund,
            DAO_TREASURY_RESERVE
        );

        emit DistributionExecuted(
            msg.sender,
            COMMUNITY_AMOUNT,
            ECOSYSTEM_AMOUNT,
            PARTNERS_AMOUNT,
            TEAM_AMOUNT,
            AIRDROP_RESERVE,
            LIQUIDITY_AMOUNT,
            PUBLIC_SALE_AMOUNT,
            DAO_TREASURY_RESERVE,
            block.timestamp
        );
    }

    // ── Partial / staggered distribution (Option B — launch with 125M) ────────

    /**
     * @notice Execute proportionally scaled distribution with available balance
     * @dev Use when owner only has 125M (constructor mint).
     *      Scales all vesting allocations proportionally.
     *      Remaining allocations added as more tokens become available.
     *
     * Example: Owner has 125M of 825M needed → scale = 15.15%
     *   Community gets: 300M × 15.15% = 45.45M
     *   Ecosystem gets: 200M × 15.15% = 30.30M
     *   etc.
     */
    function executePartialDistribution(
        address _treasuryDAO,
        address _partnerFund,
        address _teamMultisig,
        address _stakersAirdropFund,
        address _liquidityFund,
        address _publicSaleFund,
        address _daoReserveFund
    ) external {
        if (msg.sender != owner) revert OnlyOwner();
        if (distributed) revert AlreadyDistributed();
        if (_treasuryDAO == address(0)) revert InvalidAddress();
        if (_partnerFund == address(0)) revert InvalidAddress();
        if (_teamMultisig == address(0)) revert InvalidAddress();

        uint256 balance = mtaaToken.balanceOf(owner);
        if (balance == 0) revert InsufficientOwnerBalance(0, 1);

        // Scale factor: how much of the full allocation we can fund now
        // e.g., 125M / 825M = 0.1515... → scale = 151515... (18 decimals)
        uint256 scale = (balance * 1e18) / TOTAL_VESTING;

        distributed = true;
        treasuryDAO = _treasuryDAO;
        partnerFund = _partnerFund;
        teamMultisig = _teamMultisig;
        stakersAirdropFund = _stakersAirdropFund;

        uint256 startTime = block.timestamp;
        uint256 totalDistributed;

        // Scaled community
        uint256 communityScaled = (COMMUNITY_AMOUNT * scale) / 1e18;
        if (communityScaled > 0) {
            mtaaToken.createVestingSchedule(
                _treasuryDAO, communityScaled, startTime,
                MONTHS_48, MONTHS_6, VTYPE_COMMUNITY
            );
            totalDistributed += communityScaled;
        }

        // Scaled ecosystem
        uint256 ecosystemScaled = (ECOSYSTEM_AMOUNT * scale) / 1e18;
        if (ecosystemScaled > 0) {
            mtaaToken.createVestingSchedule(
                _treasuryDAO, ecosystemScaled, startTime,
                MONTHS_36, MONTHS_3, VTYPE_ECOSYSTEM
            );
            totalDistributed += ecosystemScaled;
        }

        // Scaled partners
        uint256 partnersScaled = (PARTNERS_AMOUNT * scale) / 1e18;
        if (partnersScaled > 0) {
            mtaaToken.createVestingSchedule(
                _partnerFund, partnersScaled, startTime,
                MONTHS_36, MONTHS_7, VTYPE_PARTNERS
            );
            totalDistributed += partnersScaled;
        }

        // Scaled team
        uint256 teamScaled = (TEAM_AMOUNT * scale) / 1e18;
        if (teamScaled > 0) {
            mtaaToken.createVestingSchedule(
                _teamMultisig, teamScaled, startTime,
                MONTHS_48, MONTHS_13, VTYPE_TEAM
            );
            totalDistributed += teamScaled;
        }

        // Liquidity reserve — skip if _stakersAirdropFund not provided
        if (_stakersAirdropFund != address(0)) {
            // Scaled airdrop reserve -> transfer to distributor
            uint256 airdropScaled = (AIRDROP_RESERVE * scale) / 1e18;
            if (airdropScaled > 0) {
                IERC20(address(mtaaToken)).safeTransferFrom(
                    owner, _stakersAirdropFund, airdropScaled
                );
                totalDistributed += airdropScaled;

                // Optional: notify distributor contract about funding (best-effort)
                // Try commonly used hooks; ignore failures
                (bool ok, ) = _stakersAirdropFund.call(
                    abi.encodeWithSignature("onAirdropFunded(uint256)", airdropScaled)
                );
                if (!ok) {
                    // try alternative common name; capture return to silence compiler warning
                    (bool ok2, ) = _stakersAirdropFund.call(abi.encodeWithSignature("fund(uint256)", airdropScaled));
                    (ok2); // no-op to avoid unused var lint
                }
            }
        }

        // Scaled liquidity
        if (_liquidityFund != address(0)) {
            uint256 liquidityScaled = (LIQUIDITY_AMOUNT * scale) / 1e18;
            if (liquidityScaled > 0) {
                IERC20(address(mtaaToken)).safeTransferFrom(owner, _liquidityFund, liquidityScaled);
                totalDistributed += liquidityScaled;
            }
        }

        // Scaled public sale
        if (_publicSaleFund != address(0)) {
            uint256 publicSaleScaled = (PUBLIC_SALE_AMOUNT * scale) / 1e18;
            if (publicSaleScaled > 0) {
                IERC20(address(mtaaToken)).safeTransferFrom(owner, _publicSaleFund, publicSaleScaled);
                totalDistributed += publicSaleScaled;
            }
        }

        // Scaled DAO reserve
        if (_daoReserveFund != address(0)) {
            uint256 daoReserveScaled = (DAO_TREASURY_RESERVE * scale) / 1e18;
            if (daoReserveScaled > 0) {
                IERC20(address(mtaaToken)).safeTransferFrom(owner, _daoReserveFund, daoReserveScaled);
                totalDistributed += daoReserveScaled;
            }
        }

        emit PartialDistributionExecuted(
            msg.sender,
            scale,
            totalDistributed,
            block.timestamp
        );
    }

    // ── View functions ────────────────────────────────────────────────────────

    /**
     * @notice Preview what a partial distribution would allocate
     * @param availableBalance Tokens available (e.g., 125M)
     * @return scale Scale factor (18 decimals)
     * @return community Community allocation
     * @return ecosystem Ecosystem allocation
     * @return partners Partners allocation
     * @return team Team allocation
     * @return airdrop Airdrop allocation
     */
    function previewPartialDistribution(uint256 availableBalance)
        external
        pure
        returns (
            uint256 scale,
            uint256 community,
            uint256 ecosystem,
            uint256 partners,
            uint256 team,
            uint256 airdrop
        )
    {
        scale     = (availableBalance * 1e18) / TOTAL_VESTING;
        // community should reflect the vested portion (COMMUNITY_REWARDS)
        community = (COMMUNITY_REWARDS * scale) / 1e18;
        ecosystem = (ECOSYSTEM_AMOUNT * scale) / 1e18;
        partners  = (PARTNERS_AMOUNT  * scale) / 1e18;
        team      = (TEAM_AMOUNT      * scale) / 1e18;
            // airdrop preview should reflect AIRDROP_RESERVE, not liquidity
            airdrop   = (AIRDROP_RESERVE  * scale) / 1e18;
    }

    /**
     * @notice Monthly vesting release forecast (months 1-48)
     * @dev Static forecast based on full allocation amounts
     */
    function getMonthlyReleaseSchedule()
        external
        pure
        returns (uint256[] memory months, uint256[] memory releasesPerMonth)
    {
        months = new uint256[](48);
        releasesPerMonth = new uint256[](48);

        // Community: 300M over 48mo starting month 6 = 6.25M/mo
        uint256 communityMonthly = COMMUNITY_AMOUNT / 48;
        // Ecosystem: 200M over 36mo starting month 3 = 5.56M/mo
        uint256 ecosystemMonthly = ECOSYSTEM_AMOUNT / 36;
        // Partners: 100M over 36mo starting month 7 = 2.78M/mo
        uint256 partnersMonthly  = PARTNERS_AMOUNT  / 36;
        // Team: 150M over 48mo starting month 13 = 3.125M/mo
        uint256 teamMonthly      = TEAM_AMOUNT      / 48;

        for (uint256 i = 0; i < 48; i++) {
            uint256 month = i + 1;
            months[i] = month;
            uint256 release = 0;

            if (month >= 6)  release += communityMonthly;
            if (month >= 3)  release += ecosystemMonthly;
            if (month >= 7)  release += partnersMonthly;
            if (month >= 13) release += teamMonthly;

            releasesPerMonth[i] = release;
        }
    }

    /**
     * @notice Check if owner has enough balance for full distribution
     */
    function canExecuteFullDistribution() external view returns (bool) {
        return mtaaToken.balanceOf(owner) >= TOTAL_VESTING;
    }

    /**
     * @notice Shortfall for full distribution
     */
    function getShortfall() external view returns (uint256) {
        uint256 balance = mtaaToken.balanceOf(owner);
        if (balance >= TOTAL_VESTING) return 0;
        return TOTAL_VESTING - balance;
    }
}
