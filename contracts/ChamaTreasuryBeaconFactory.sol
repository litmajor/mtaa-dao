// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ChamaTreasury.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ChamaTreasuryBeaconFactory
 * @notice Deploys ChamaTreasury BeaconProxy instances sharing one upgradeable implementation.
 * @dev The beacon owner must be the platform MultiSigTreasury. The legacy clone factory remains
 *      available for deployments that do not require global upgrades.
 */
contract ChamaTreasuryBeaconFactory is Ownable, Pausable {
    enum DAOType {
        HARAMBEE,
        SHORT_TERM,
        SAVINGS,
        MERRY_GO_ROUND,
        COMMUNITY,
        INVESTMENT
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

    IBeacon public immutable beacon;
    address public immutable stablecoin;
    address public immutable platformTreasury;

    mapping(string => address) public treasuryByDaoId;
    mapping(address => TreasuryRecord) public recordByTreasury;
    address[] public deployedTreasuries;
    mapping(address => address[]) public treasuriesByDeployer;

    uint256 public defaultSmallTransferLimit = 50 * 1e18;

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

    error DaoIdAlreadyRegistered(string daoId);
    error DaoIdNotFound(string daoId);
    error InvalidAddress();
    error InvalidSignerConfig();
    error InvalidThreshold();
    error DeploymentFailed();
    error EmptyDaoId();
    error EmptyChamaName();

    constructor(address _stablecoin, address _platformTreasury, address _beacon)
        Ownable(msg.sender)
    {
        if (_stablecoin == address(0) || _platformTreasury == address(0) || _beacon == address(0)) {
            revert InvalidAddress();
        }
        stablecoin = _stablecoin;
        platformTreasury = _platformTreasury;
        beacon = IBeacon(_beacon);
    }

    function deployTreasury(
        string calldata _chamaName,
        string calldata _daoId,
        address[] calldata _signers,
        string[] calldata _signerNames,
        uint256 _requiredSignatures,
        DAOType _daoType
    ) external whenNotPaused returns (address treasury) {
        _validateDeployment(_chamaName, _daoId, _signers, _signerNames, _requiredSignatures);

        bytes memory initializer = abi.encodeCall(
            ChamaTreasury.initialize,
            (
                _chamaName,
                _daoId,
                _signers,
                _signerNames,
                _requiredSignatures,
                stablecoin,
                defaultSmallTransferLimit,
                msg.sender
            )
        );
        treasury = address(new BeaconProxy(address(beacon), initializer));
        if (treasury == address(0)) revert DeploymentFailed();

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

        emit TreasuryDeployed(treasury, _daoId, _chamaName, msg.sender, _daoType, 0, block.timestamp);
    }

    function _validateDeployment(
        string calldata _chamaName,
        string calldata _daoId,
        address[] calldata _signers,
        string[] calldata _signerNames,
        uint256 _requiredSignatures
    ) internal view {
        if (bytes(_daoId).length == 0) revert EmptyDaoId();
        if (bytes(_chamaName).length == 0) revert EmptyChamaName();
        if (treasuryByDaoId[_daoId] != address(0)) revert DaoIdAlreadyRegistered(_daoId);
        if (_signers.length < 2 || _signers.length > 10) revert InvalidSignerConfig();
        if (_signers.length != _signerNames.length) revert InvalidSignerConfig();
        if (_requiredSignatures < 2 || _requiredSignatures > _signers.length) revert InvalidThreshold();

        for (uint256 signerIndex = 0; signerIndex < _signers.length; signerIndex++) {
            if (_signers[signerIndex] == address(0)) revert InvalidSignerConfig();
            for (uint256 otherIndex = signerIndex + 1; otherIndex < _signers.length; otherIndex++) {
                if (_signers[signerIndex] == _signers[otherIndex]) revert InvalidSignerConfig();
            }
        }
    }

    function deactivateTreasury(string calldata daoId) external onlyOwner {
        address treasury = treasuryByDaoId[daoId];
        if (treasury == address(0)) revert DaoIdNotFound(daoId);
        recordByTreasury[treasury].active = false;
        emit TreasuryDeactivated(treasury, daoId, block.timestamp);
    }

    function setDefaultSmallTransferLimit(uint256 limit) external onlyOwner {
        defaultSmallTransferLimit = limit;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function getTreasuryByDaoId(string calldata daoId) external view returns (address) { return treasuryByDaoId[daoId]; }
    function getTreasuryRecord(address treasury) external view returns (TreasuryRecord memory) { return recordByTreasury[treasury]; }
    function getTreasuriesByDeployer(address deployer) external view returns (address[] memory) { return treasuriesByDeployer[deployer]; }
    function getDeploymentFee(DAOType) external pure returns (uint256 fee, bool active) { return (0, true); }
    function hasTreasury(string calldata daoId) external view returns (bool) { return treasuryByDaoId[daoId] != address(0); }
    function getTotalDeployed() external view returns (uint256) { return deployedTreasuries.length; }
}
