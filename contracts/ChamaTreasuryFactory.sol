// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ChamaTreasury.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ChamaTreasuryFactory
 * @notice Deploys and registers ChamaTreasury instances — one per chama
 */
contract ChamaTreasuryFactory is Ownable, Pausable {

    // =========================================================================
    // ENUMS & STRUCTS
    // =========================================================================

    enum DAOType {
        HARAMBEE,       // free
        SHORT_TERM,     // free
        SAVINGS,        // free
        MERRY_GO_ROUND, // growth
        COMMUNITY,      // growth
        INVESTMENT      // professional
    }

    struct TreasuryRecord {
        address treasury;
        string daoId;
        string chamaName;
        address deployer;
        DAOType daoType;
        uint256 deployedAt;
        bool active;
    }

    struct FeeTier {
        uint256 fee;        // in stablecoin units (18 decimals). 0 = free
        bool active;
    }

    // =========================================================================
    // STATE
    // =========================================================================

    address public stablecoin;
    address public platformTreasury;
    address public strategyRegistry;
    address public apyCalculator;
    address public platformFeeCollector;
    address public subscriptionManager;

    mapping(DAOType => FeeTier) public feeTiers;
    mapping(string => address) public treasuryByDaoId;
    mapping(address => TreasuryRecord) public recordByTreasury;
    
    address[] public deployedTreasuries;
    mapping(address => address[]) public treasuriesByDeployer;

    uint256 public defaultSmallTransferLimit;   // 50 cUSD default
    uint256 public defaultSmallTransferDelay;   // 1 hour
    uint256 public defaultLargeTransferDelay;   // 24 hours

    // State counters to completely eliminate the unbounded loop gas issue
    uint256 public freeTierCount;
    uint256 public growthTierCount;
    uint256 public proTierCount;

    // =========================================================================
    // EVENTS
    // =========================================================================

    event TreasuryDeployed(
        address indexed treasury,
        string indexed daoId,
        string chamaName,
        address indexed deployer,
        DAOType daoType,
        uint256 deploymentFee,
        uint256 timestamp
    );

    event TreasuryDeactivated(address indexed treasury, string daoId, uint256 timestamp);
    event FeeTierUpdated(DAOType indexed daoType, uint256 newFee, uint256 timestamp);
    event PlatformTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event DefaultTimelockUpdated(uint256 smallLimit, uint256 smallDelay, uint256 largeDelay);

    // =========================================================================
    // ERRORS
    // =========================================================================

    error DaoIdAlreadyRegistered(string daoId);
    error DaoIdNotFound(string daoId);
    error InvalidAddress();
    error InvalidSignerConfig();
    error InvalidThreshold();
    error FeeTierNotActive();
    error InsufficientFee(uint256 provided, uint256 required);
    error DeploymentFailed();
    error EmptyDaoId();
    error EmptyChamaName();

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(
        address _stablecoin,
        address _platformTreasury
    ) Ownable(msg.sender) {
        if (_stablecoin == address(0) || _platformTreasury == address(0)) revert InvalidAddress();

        stablecoin = _stablecoin;
        platformTreasury = _platformTreasury;

        defaultSmallTransferLimit = 50 * 1e18; // 50 cUSD
        defaultSmallTransferDelay = 1 hours;
        defaultLargeTransferDelay = 24 hours;

        feeTiers[DAOType.HARAMBEE]       = FeeTier({ fee: 0,        active: true });
        feeTiers[DAOType.SHORT_TERM]     = FeeTier({ fee: 0,        active: true });
        feeTiers[DAOType.SAVINGS]        = FeeTier({ fee: 0,        active: true });
        feeTiers[DAOType.MERRY_GO_ROUND] = FeeTier({ fee: 2 * 1e18, active: true }); // 2 cUSD
        feeTiers[DAOType.COMMUNITY]      = FeeTier({ fee: 2 * 1e18, active: true }); // 2 cUSD
        feeTiers[DAOType.INVESTMENT]     = FeeTier({ fee: 5 * 1e18, active: true }); // 5 cUSD
    }

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    function _validateDeployment(
        string calldata _chamaName,
        string calldata _daoId,
        address[] calldata _signers,
        uint256 _requiredSignatures
    ) internal view {
        if (bytes(_daoId).length == 0) revert EmptyDaoId();
        if (bytes(_chamaName).length == 0) revert EmptyChamaName();
        if (treasuryByDaoId[_daoId] != address(0)) revert DaoIdAlreadyRegistered(_daoId);
        if (_signers.length < 2 || _signers.length > 10) revert InvalidSignerConfig();
        if (_requiredSignatures < 2 || _requiredSignatures > _signers.length) revert InvalidThreshold();
    }

    function _incrementCounters(DAOType _daoType) internal {
        if (_daoType == DAOType.HARAMBEE || _daoType == DAOType.SHORT_TERM || _daoType == DAOType.SAVINGS) {
            unchecked { freeTierCount++; }
        } else if (_daoType == DAOType.MERRY_GO_ROUND || _daoType == DAOType.COMMUNITY) {
            unchecked { growthTierCount++; }
        } else {
            unchecked { proTierCount++; }
        }
    }

    // =========================================================================
    // CORE DEPLOYMENT
    // =========================================================================

    function deployTreasury(
        string calldata _chamaName,
        string calldata _daoId,
        address[] calldata _signers,
        string[] calldata _signerNames,
        uint256 _requiredSignatures,
        DAOType _daoType
    ) external whenNotPaused returns (address treasury) {
        _validateDeployment(_chamaName, _daoId, _signers, _requiredSignatures);

        FeeTier memory tier = feeTiers[_daoType];
        if (!tier.active) revert FeeTierNotActive();

        if (tier.fee > 0) {
            bool ok = IERC20(stablecoin).transferFrom(msg.sender, platformTreasury, tier.fee);
            if (!ok) revert InsufficientFee(0, tier.fee);
        }

        try new ChamaTreasury(
            _chamaName, _daoId, _signers, _signerNames, _requiredSignatures, stablecoin, defaultSmallTransferLimit
        ) returns (ChamaTreasury deployed) {
            treasury = address(deployed);
            // If factory has a registry configured, set it on the deployed treasury
            if (strategyRegistry != address(0)) {
                deployed.setRegistry(strategyRegistry);
            }
            // If factory has an APY calculator configured, set it on the deployed treasury
            if (apyCalculator != address(0)) {
                deployed.setApyCalculator(apyCalculator);
            }
            if (platformFeeCollector != address(0) || subscriptionManager != address(0)) {
                deployed.setPlatformWallets(platformFeeCollector, subscriptionManager);
            }
        } catch {
            revert DeploymentFailed();
        }

        _registerTreasury(_chamaName, _daoId, _daoType, treasury, tier.fee);
        return treasury;
    }

    function deployTreasuryCustom(
        string calldata _chamaName,
        string calldata _daoId,
        address[] calldata _signers,
        string[] calldata _signerNames,
        uint256 _requiredSignatures,
        DAOType _daoType,
        uint256 _smallTransferLimit,
        uint256 _smallTransferDelay,
        uint256 _largeTransferDelay
    ) external whenNotPaused returns (address treasury) {
        _validateDeployment(_chamaName, _daoId, _signers, _requiredSignatures);
        require(_largeTransferDelay >= _smallTransferDelay, "Invalid timelock config");

        FeeTier memory tier = feeTiers[_daoType];
        if (!tier.active) revert FeeTierNotActive();

        if (tier.fee > 0) {
            bool ok = IERC20(stablecoin).transferFrom(msg.sender, platformTreasury, tier.fee);
            if (!ok) revert InsufficientFee(0, tier.fee);
        }

        try new ChamaTreasury(
            _chamaName, _daoId, _signers, _signerNames, _requiredSignatures, stablecoin, _smallTransferLimit
        ) returns (ChamaTreasury deployed) {
            treasury = address(deployed);
            deployed.updateTimelocks(_smallTransferLimit, _smallTransferDelay, _largeTransferDelay);
            if (strategyRegistry != address(0)) {
                deployed.setRegistry(strategyRegistry);
            }
            if (apyCalculator != address(0)) {
                deployed.setApyCalculator(apyCalculator);
            }
            if (platformFeeCollector != address(0) || subscriptionManager != address(0)) {
                deployed.setPlatformWallets(platformFeeCollector, subscriptionManager);
            }
        } catch {
            revert DeploymentFailed();
        }

        _registerTreasury(_chamaName, _daoId, _daoType, treasury, tier.fee);
        return treasury;
    }

    function _registerTreasury(
        string calldata _chamaName,
        string calldata _daoId,
        DAOType _daoType,
        address treasury,
        uint256 fee
    ) internal {
        treasuryByDaoId[_daoId] = treasury;
        deployedTreasuries.push(treasury);
        treasuriesByDeployer[msg.sender].push(treasury);

        recordByTreasury[treasury] = TreasuryRecord({
            treasury: treasury,
            daoId: _daoId,
            chamaName: _chamaName,
            deployer: msg.sender,
            daoType: _daoType,
            deployedAt: block.timestamp,
            active: true
        });

        _incrementCounters(_daoType);

        emit TreasuryDeployed(treasury, _daoId, _chamaName, msg.sender, _daoType, fee, block.timestamp);
    }

    // =========================================================================
    // ADMIN & VIEWS
    // =========================================================================

    function setFeeTier(DAOType daoType, uint256 newFee) external onlyOwner {
        feeTiers[daoType].fee = newFee;
        feeTiers[daoType].active = true;
        emit FeeTierUpdated(daoType, newFee, block.timestamp);
    }

    function setPlatformTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidAddress();
        emit PlatformTreasuryUpdated(platformTreasury, newTreasury);
        platformTreasury = newTreasury;
    }

    function setStrategyRegistry(address _registry) external onlyOwner {
        strategyRegistry = _registry;
        emit ConfigUpdated("strategyRegistry", _registry);
    }

    function setApyCalculator(address _calculator) external onlyOwner {
        apyCalculator = _calculator;
        emit ConfigUpdated("apyCalculator", _calculator);
    }

    function setPlatformWallets(address _collector, address _subManager) external onlyOwner {
        platformFeeCollector = _collector;
        subscriptionManager = _subManager;
        emit ConfigUpdated("platformFeeCollector", _collector);
        emit ConfigUpdated("subscriptionManager", _subManager);
    }

    function setDefaultTimelocks(uint256 _smallLimit, uint256 _smallDelay, uint256 _largeDelay) external onlyOwner {
        require(_largeDelay >= _smallDelay, "Invalid timelock config");
        defaultSmallTransferLimit = _smallLimit;
        defaultSmallTransferDelay = _smallDelay;
        defaultLargeTransferDelay = _largeDelay;
        emit DefaultTimelockUpdated(_smallLimit, _smallDelay, _largeDelay);
    }

    function deactivateTreasury(string calldata daoId) external onlyOwner {
        address treasury = treasuryByDaoId[daoId];
        if (treasury == address(0)) revert DaoIdNotFound(daoId);
        recordByTreasury[treasury].active = false;
        emit TreasuryDeactivated(treasury, daoId, block.timestamp);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function getTreasuryByDaoId(string calldata daoId) external view returns (address) { return treasuryByDaoId[daoId]; }
    function getTreasuryRecord(address treasury) external view returns (TreasuryRecord memory) { return recordByTreasury[treasury]; }
    function getTreasuriesByDeployer(address deployer) external view returns (address[] memory) { return treasuriesByDeployer[deployer]; }
    function getDeploymentFee(DAOType daoType) external view returns (uint256 fee, bool active) { return (feeTiers[daoType].fee, feeTiers[daoType].active); }
    function getTotalDeployed() external view returns (uint256) { return deployedTreasuries.length; }
    function hasTreasury(string calldata daoId) external view returns (bool) { return treasuryByDaoId[daoId] != address(0); }

    // O(1) constant gas optimization replacing the loop implementation
    function getFactoryStats() external view returns (uint256 totalDeployed, uint256 freeCount, uint256 growthCount, uint256 proCount) {
        return (deployedTreasuries.length, freeTierCount, growthTierCount, proTierCount);
    }
}