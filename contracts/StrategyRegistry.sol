// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title StrategyRegistry
 * @dev Registry of approved investment strategies for Investment Club DAO
 * @notice Defines APY, risk ratings, and allocation caps per strategy
 */
contract StrategyRegistry is Ownable, Pausable {
    
    enum StrategyStatus { ACTIVE, DEPRECATED, PAUSED, EXPERIMENTAL }
    
    struct Strategy {
        uint256 strategyId;
        string name;                    // "Aave USDC", "Lido stETH", etc
        address yieldProtocol;          // Contract address
        uint256 apy;                    // Current APY (basis points, 100 = 1%)
        uint256 maxAllocation;          // Max % of portfolio (100 = 1%)
        StrategyStatus status;
        uint256 riskRating;             // 1-5 stars
        string description;
        uint256 tvl;                    // Total value locked
        uint256 createdAt;
        uint256 updatedAt;
    }
    
    // State
    address public oracleAddress;
    uint256 public nextStrategyId = 1;
    uint256 public totalActiveStrategies;
    
    mapping(uint256 => Strategy) public strategies;
    mapping(string => uint256) public strategyByName;
    mapping(address => uint256) public strategyByProtocol;
    
    // Events
    event StrategyAdded(uint256 indexed strategyId, string name, address protocol);
    event StrategyUpdated(uint256 indexed strategyId, uint256 apy, uint256 maxAllocation);
    event APYUpdated(uint256 indexed strategyId, uint256 newAPY);
    event AllocationCapUpdated(uint256 indexed strategyId, uint256 newCap);
    event StrategyDeprecated(uint256 indexed strategyId);
    event StrategyPaused(uint256 indexed strategyId);
    event StrategyResumed(uint256 indexed strategyId);
    event StrategyRiskRatingUpdated(uint256 indexed strategyId, uint256 newRating);
    event OracleUpdated(address newOracle);
    
    // Modifiers
    modifier onlyOracle() {
        require(msg.sender == oracleAddress || msg.sender == owner(), "Only oracle");
        _;
    }
    
    modifier strategyExists(uint256 strategyId) {
        require(strategies[strategyId].strategyId != 0, "Strategy does not exist");
        _;
    }
    
    // Constructor
    constructor(address _oracle) {
        oracleAddress = _oracle;
    }
    
    /**
     * @dev Add new investment strategy
     */
    function addStrategy(
        string memory name,
        address protocol,
        uint256 initialAPY,
        uint256 maxAllocationPercent,
        uint256 riskRating,
        string memory description
    ) external onlyOwner returns (uint256) {
        require(bytes(name).length > 0, "Name required");
        require(protocol != address(0), "Invalid protocol");
        require(maxAllocationPercent > 0 && maxAllocationPercent <= 10000, "Invalid allocation cap");
        require(riskRating >= 1 && riskRating <= 5, "Risk rating must be 1-5");
        require(strategyByProtocol[protocol] == 0, "Protocol already registered");
        
        uint256 strategyId = nextStrategyId++;
        
        Strategy storage strategy = strategies[strategyId];
        strategy.strategyId = strategyId;
        strategy.name = name;
        strategy.yieldProtocol = protocol;
        strategy.apy = initialAPY;
        strategy.maxAllocation = maxAllocationPercent;
        strategy.status = StrategyStatus.ACTIVE;
        strategy.riskRating = riskRating;
        strategy.description = description;
        strategy.createdAt = block.timestamp;
        strategy.updatedAt = block.timestamp;
        
        strategyByName[name] = strategyId;
        strategyByProtocol[protocol] = strategyId;
        totalActiveStrategies++;
        
        emit StrategyAdded(strategyId, name, protocol);
        
        return strategyId;
    }
    
    /**
     * @dev Update strategy APY (oracle feed)
     */
    function updateStrategyAPY(uint256 strategyId, uint256 newAPY) 
        external 
        onlyOracle 
        strategyExists(strategyId) 
    {
        Strategy storage strategy = strategies[strategyId];
        require(strategy.status == StrategyStatus.ACTIVE, "Strategy not active");
        
        strategy.apy = newAPY;
        strategy.updatedAt = block.timestamp;
        
        emit APYUpdated(strategyId, newAPY);
    }
    
    /**
     * @dev Update strategy TVL (oracle feed)
     */
    function updateStrategyTVL(uint256 strategyId, uint256 newTVL) 
        external 
        onlyOracle 
        strategyExists(strategyId) 
    {
        Strategy storage strategy = strategies[strategyId];
        strategy.tvl = newTVL;
        strategy.updatedAt = block.timestamp;
    }
    
    /**
     * @dev Set maximum allocation cap (prevents concentration)
     */
    function setMaxAllocation(uint256 strategyId, uint256 newMaxAllocationPercent) 
        external 
        onlyOwner 
        strategyExists(strategyId) 
    {
        require(newMaxAllocationPercent > 0 && newMaxAllocationPercent <= 10000, "Invalid cap");
        
        strategies[strategyId].maxAllocation = newMaxAllocationPercent;
        strategies[strategyId].updatedAt = block.timestamp;
        
        emit AllocationCapUpdated(strategyId, newMaxAllocationPercent);
    }
    
    /**
     * @dev Update risk rating (1-5)
     */
    function setRiskRating(uint256 strategyId, uint256 newRating) 
        external 
        onlyOwner 
        strategyExists(strategyId) 
    {
        require(newRating >= 1 && newRating <= 5, "Rating must be 1-5");
        
        strategies[strategyId].riskRating = newRating;
        strategies[strategyId].updatedAt = block.timestamp;
        
        emit StrategyRiskRatingUpdated(strategyId, newRating);
    }
    
    /**
     * @dev Pause strategy (e.g., for maintenance)
     */
    function pauseStrategy(uint256 strategyId) 
        external 
        onlyOwner 
        strategyExists(strategyId) 
    {
        Strategy storage strategy = strategies[strategyId];
        require(strategy.status != StrategyStatus.DEPRECATED, "Cannot pause deprecated strategy");
        
        strategy.status = StrategyStatus.PAUSED;
        strategy.updatedAt = block.timestamp;
        
        emit StrategyPaused(strategyId);
    }
    
    /**
     * @dev Resume paused strategy
     */
    function resumeStrategy(uint256 strategyId) 
        external 
        onlyOwner 
        strategyExists(strategyId) 
    {
        Strategy storage strategy = strategies[strategyId];
        require(strategy.status == StrategyStatus.PAUSED, "Strategy not paused");
        
        strategy.status = StrategyStatus.ACTIVE;
        strategy.updatedAt = block.timestamp;
        
        emit StrategyResumed(strategyId);
    }
    
    /**
     * @dev Deprecate strategy (no new allocations)
     */
    function deprecateStrategy(uint256 strategyId) 
        external 
        onlyOwner 
        strategyExists(strategyId) 
    {
        Strategy storage strategy = strategies[strategyId];
        strategy.status = StrategyStatus.DEPRECATED;
        strategy.updatedAt = block.timestamp;
        totalActiveStrategies--;
        
        emit StrategyDeprecated(strategyId);
    }
    
    /**
     * @dev Get all active strategies
     */
    function getActiveStrategies() external view returns (Strategy[] memory) {
        Strategy[] memory activeStrats = new Strategy[](totalActiveStrategies);
        uint256 count = 0;
        
        for (uint256 i = 1; i < nextStrategyId; i++) {
            if (strategies[i].status == StrategyStatus.ACTIVE) {
                activeStrats[count] = strategies[i];
                count++;
            }
        }
        
        return activeStrats;
    }
    
    /**
     * @dev Get strategy by ID
     */
    function getStrategy(uint256 strategyId) 
        external 
        view 
        strategyExists(strategyId) 
        returns (Strategy memory) 
    {
        return strategies[strategyId];
    }
    
    /**
     * @dev Get strategy by name
     */
    function getStrategyByName(string memory name) external view returns (Strategy memory) {
        uint256 strategyId = strategyByName[name];
        require(strategyId != 0, "Strategy not found");
        return strategies[strategyId];
    }
    
    /**
     * @dev Check if strategy is active
     */
    function isStrategyActive(uint256 strategyId) external view returns (bool) {
        return strategies[strategyId].status == StrategyStatus.ACTIVE;
    }
    
    /**
     * @dev Set oracle address
     */
    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle");
        oracleAddress = _oracle;
        emit OracleUpdated(_oracle);
    }
    
    /**
     * @dev Get total strategies count
     */
    function getTotalStrategies() external view returns (uint256) {
        return nextStrategyId - 1;
    }
}
