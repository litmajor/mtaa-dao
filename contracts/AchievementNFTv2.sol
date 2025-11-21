// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title AchievementNFTv2 - Comprehensive NFT Achievement System
 * @dev Enhanced achievement NFT contract with marketplace, milestones, and metadata
 */
contract AchievementNFTv2 is 
    ERC721, 
    ERC721URIStorage,
    ERC721Burnable,
    Ownable,
    ReentrancyGuard,
    Pausable
{
    using Counters for Counters.Counter;
    
    // ============ State Variables ============
    
    Counters.Counter private _tokenIdCounter;
    
    // Achievement metadata
    struct Achievement {
        string name;
        string category;
        uint8 tier; // 1: bronze, 2: silver, 3: gold, 4: platinum, 5: diamond, 6: legendary
        uint256 rarity; // 1-4
        uint256 rewardPoints;
        uint256 rewardTokens;
        string imageUrl;
        bytes32 metadataHash;
        bool tradeable;
        bool burnable;
        uint256 mintedAt;
        address originalMinter;
        uint256 milestoneLevel;
    }
    
    // Marketplace listing
    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;
        bool active;
        uint256 listedAt;
    }
    
    // User stats
    struct UserStats {
        uint256 achievementCount;
        uint256 totalRewardPoints;
        uint256 totalRewardTokens;
        uint8 highestTier;
        uint256 lastMintedAt;
    }
    
    // Mappings
    mapping(uint256 => Achievement) public achievements;
    mapping(address => uint256[]) public userAchievements;
    mapping(address => UserStats) public userStats;
    mapping(uint256 => Listing) public listings;
    mapping(string => bool) public achievementCategories;
    mapping(address => bool) public approvedMinters;
    mapping(uint256 => bool) public milestoneMinted; // Track if milestone NFT already minted
    mapping(address => uint256) public userReputation;
    
    // Configuration
    uint256 public marketplaceFee = 250; // 2.5% in basis points
    address public feeCollector;
    uint256 public minTradeablePrice = 0.01 ether;
    
    // ============ Events ============
    
    event AchievementMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string indexed name,
        uint8 tier,
        uint256 rewardPoints
    );
    
    event AchievementListed(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price,
        uint256 timestamp
    );
    
    event AchievementSold(
        uint256 indexed tokenId,
        address indexed buyer,
        address indexed seller,
        uint256 price,
        uint256 fee
    );
    
    event AchievementUnlisted(uint256 indexed tokenId);
    
    event AchievementBurned(uint256 indexed tokenId, address indexed owner);
    
    event MilestoneReached(
        address indexed user,
        uint256 milestoneLevel,
        uint256 rewardBonus
    );
    
    event UserRepuationUpdated(address indexed user, uint256 newReputation);
    
    event CategoryAdded(string indexed category);
    
    event ApprovedMinterSet(address indexed minter, bool approved);
    
    // ============ Constructor ============
    
    constructor() ERC721("Mtaa Achievement", "MTAA-ACH") {
        feeCollector = msg.sender;
        
        // Register default achievement categories
        _addCategory("PIONEER");
        _addCategory("CONTRIBUTOR");
        _addCategory("VOTER");
        _addCategory("PROPOSER");
        _addCategory("ELDER");
        _addCategory("TREASURY_MASTER");
        _addCategory("COMMUNITY_CHAMPION");
        _addCategory("ADVISOR");
        _addCategory("EDUCATOR");
        _addCategory("BUILDER");
        _addCategory("AMBASSADOR");
        _addCategory("INNOVATOR");
        _addCategory("GUARDIAN");
        _addCategory("SENTINEL");
    }
    
    // ============ Minting Functions ============
    
    /**
     * @notice Mint a new achievement NFT
     * @param to Recipient address
     * @param name Achievement name
     * @param category Achievement category
     * @param tier Achievement tier (1-6)
     * @param rarity NFT rarity (1-4)
     * @param rewardPoints Reward points
     * @param rewardTokens Reward tokens amount
     * @param imageUrl IPFS image URL
     * @param metadataUri Metadata URI
     * @param tradeable If NFT is tradeable
     * @param burnable If NFT is burnable
     * @param milestoneLevel Milestone level if applicable
     */
    function mintAchievement(
        address to,
        string memory name,
        string memory category,
        uint8 tier,
        uint256 rarity,
        uint256 rewardPoints,
        uint256 rewardTokens,
        string memory imageUrl,
        string memory metadataUri,
        bool tradeable,
        bool burnable,
        uint256 milestoneLevel
    ) external onlyOwner nonReentrant returns (uint256) {
        require(to != address(0), "Invalid address");
        require(achievementCategories[category], "Invalid category");
        require(tier >= 1 && tier <= 6, "Invalid tier");
        require(rarity >= 1 && rarity <= 4, "Invalid rarity");
        
        _tokenIdCounter.increment();
        uint256 newTokenId = _tokenIdCounter.current();
        
        _safeMint(to, newTokenId);
        _setTokenURI(newTokenId, metadataUri);
        
        achievements[newTokenId] = Achievement({
            name: name,
            category: category,
            tier: tier,
            rarity: rarity,
            rewardPoints: rewardPoints,
            rewardTokens: rewardTokens,
            imageUrl: imageUrl,
            metadataHash: keccak256(abi.encodePacked(metadataUri)),
            tradeable: tradeable,
            burnable: burnable,
            mintedAt: block.timestamp,
            originalMinter: to,
            milestoneLevel: milestoneLevel
        });
        
        // Update user stats
        userAchievements[to].push(newTokenId);
        userStats[to].achievementCount++;
        userStats[to].totalRewardPoints += rewardPoints;
        userStats[to].totalRewardTokens += rewardTokens;
        if (tier > userStats[to].highestTier) {
            userStats[to].highestTier = tier;
        }
        userStats[to].lastMintedAt = block.timestamp;
        
        // Update reputation
        uint256 reputationGain = _calculateReputationGain(tier, rarity);
        userReputation[to] += reputationGain;
        
        emit AchievementMinted(newTokenId, to, name, tier, rewardPoints);
        emit UserRepuationUpdated(to, userReputation[to]);
        
        return newTokenId;
    }
    
    /**
     * @notice Mint batch achievements
     */
    function batchMintAchievements(
        address[] calldata recipients,
        string[] calldata names,
        string[] calldata categories,
        uint8[] calldata tiers,
        uint256[] calldata rarities
    ) external onlyOwner nonReentrant returns (uint256[] memory) {
        require(
            recipients.length == names.length &&
            names.length == categories.length &&
            categories.length == tiers.length &&
            tiers.length == rarities.length,
            "Array length mismatch"
        );
        
        uint256[] memory tokenIds = new uint256[](recipients.length);
        
        for (uint256 i = 0; i < recipients.length; i++) {
            tokenIds[i] = mintAchievement(
                recipients[i],
                names[i],
                categories[i],
                tiers[i],
                rarities[i],
                0, // rewardPoints
                0, // rewardTokens
                "", // imageUrl
                "", // metadataUri
                false,
                false,
                0
            );
        }
        
        return tokenIds;
    }
    
    // ============ Marketplace Functions ============
    
    /**
     * @notice List achievement for sale
     */
    function listForSale(uint256 tokenId, uint256 price) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(achievements[tokenId].tradeable, "Not tradeable");
        require(price >= minTradeablePrice, "Price too low");
        
        listings[tokenId] = Listing({
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            active: true,
            listedAt: block.timestamp
        });
        
        emit AchievementListed(tokenId, msg.sender, price, block.timestamp);
    }
    
    /**
     * @notice Buy achievement from marketplace
     */
    function buyAchievement(uint256 tokenId) external payable nonReentrant {
        Listing memory listing = listings[tokenId];
        require(listing.active, "Not listed");
        require(msg.value >= listing.price, "Insufficient payment");
        
        address seller = listing.seller;
        uint256 price = listing.price;
        
        // Calculate fees
        uint256 fee = (price * marketplaceFee) / 10000;
        uint256 sellerAmount = price - fee;
        
        // Transfer NFT
        _transfer(seller, msg.sender, tokenId);
        
        // Update user achievements
        uint256[] storage sellerAchievements = userAchievements[seller];
        for (uint256 i = 0; i < sellerAchievements.length; i++) {
            if (sellerAchievements[i] == tokenId) {
                sellerAchievements[i] = sellerAchievements[sellerAchievements.length - 1];
                sellerAchievements.pop();
                break;
            }
        }
        userAchievements[msg.sender].push(tokenId);
        
        // Remove listing
        delete listings[tokenId];
        
        // Transfer funds
        payable(seller).transfer(sellerAmount);
        payable(feeCollector).transfer(fee);
        
        // Refund excess
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
        
        emit AchievementSold(tokenId, msg.sender, seller, price, fee);
    }
    
    /**
     * @notice Unlist achievement
     */
    function unlistAchievement(uint256 tokenId) external {
        require(listings[tokenId].seller == msg.sender, "Not the seller");
        delete listings[tokenId];
        emit AchievementUnlisted(tokenId);
    }
    
    // ============ Burning Functions ============
    
    /**
     * @notice Burn achievement if burnable
     */
    function burnAchievement(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(achievements[tokenId].burnable, "Not burnable");
        require(!listings[tokenId].active, "Must unlist first");
        
        address owner = ownerOf(tokenId);
        
        // Update user stats before burning
        userStats[owner].achievementCount--;
        userStats[owner].totalRewardPoints -= achievements[tokenId].rewardPoints;
        
        // Remove from user achievements
        uint256[] storage userAchs = userAchievements[owner];
        for (uint256 i = 0; i < userAchs.length; i++) {
            if (userAchs[i] == tokenId) {
                userAchs[i] = userAchs[userAchs.length - 1];
                userAchs.pop();
                break;
            }
        }
        
        _burn(tokenId);
        delete achievements[tokenId];
        
        emit AchievementBurned(tokenId, owner);
    }
    
    // ============ Query Functions ============
    
    /**
     * @notice Get achievements owned by user
     */
    function getUserAchievements(address user) external view returns (uint256[] memory) {
        return userAchievements[user];
    }
    
    /**
     * @notice Get achievement details
     */
    function getAchievement(uint256 tokenId) 
        external 
        view 
        returns (Achievement memory) 
    {
        return achievements[tokenId];
    }
    
    /**
     * @notice Get achievement count for user
     */
    function getAchievementCount(address user) external view returns (uint256) {
        return userAchievements[user].length;
    }
    
    /**
     * @notice Get user reputation
     */
    function getUserReputation(address user) external view returns (uint256) {
        return userReputation[user];
    }
    
    /**
     * @notice Get user stats
     */
    function getUserStats(address user) external view returns (UserStats memory) {
        return userStats[user];
    }
    
    /**
     * @notice Check if user owns achievement NFT
     */
    function hasAchievement(address user, uint256 tokenId) 
        external 
        view 
        returns (bool) 
    {
        try this.ownerOf(tokenId) returns (address owner) {
            return owner == user;
        } catch {
            return false;
        }
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Add achievement category
     */
    function addCategory(string memory category) external onlyOwner {
        _addCategory(category);
    }
    
    /**
     * @notice Set approved minter
     */
    function setApprovedMinter(address minter, bool approved) external onlyOwner {
        approvedMinters[minter] = approved;
        emit ApprovedMinterSet(minter, approved);
    }
    
    /**
     * @notice Set marketplace fee
     */
    function setMarketplaceFee(uint256 fee) external onlyOwner {
        require(fee <= 1000, "Fee too high"); // Max 10%
        marketplaceFee = fee;
    }
    
    /**
     * @notice Set fee collector address
     */
    function setFeeCollector(address newCollector) external onlyOwner {
        require(newCollector != address(0), "Invalid address");
        feeCollector = newCollector;
    }
    
    /**
     * @notice Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Calculate reputation gain based on tier and rarity
     */
    function _calculateReputationGain(uint8 tier, uint256 rarity) 
        internal 
        pure 
        returns (uint256) 
    {
        uint256 baseReputation = tier * 10;
        uint256 rarityBonus = rarity * 5;
        return baseReputation + rarityBonus;
    }
    
    /**
     * @notice Add achievement category
     */
    function _addCategory(string memory category) internal {
        achievementCategories[category] = true;
        emit CategoryAdded(category);
    }
    
    // ============ ERC721 Overrides ============
    
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
    
    function _burn(uint256 tokenId) 
        internal 
        override(ERC721, ERC721URIStorage) 
    {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
