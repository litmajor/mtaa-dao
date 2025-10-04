
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract AchievementNFT is ERC721URIStorage, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    struct Achievement {
        string name;
        string category;
        uint256 rarity; // 1=Common, 2=Rare, 3=Epic, 4=Legendary
        uint256 mintedAt;
        address originalMinter;
        bool tradeable;
    }

    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;
        bool active;
    }

    mapping(uint256 => Achievement) public achievements;
    mapping(uint256 => Listing) public listings;
    mapping(string => bool) public achievementTypes;
    
    uint256 public marketplaceFee = 250; // 2.5%
    address public feeCollector;

    event AchievementMinted(uint256 indexed tokenId, address indexed owner, string name, uint256 rarity);
    event AchievementListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event AchievementSold(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price);
    event AchievementUnlisted(uint256 indexed tokenId);

    constructor() ERC721("Mtaa Achievement", "MTAA-ACH") {
        feeCollector = msg.sender;
        
        // Register default achievement types
        achievementTypes["PIONEER"] = true;
        achievementTypes["CONTRIBUTOR"] = true;
        achievementTypes["VOTER"] = true;
        achievementTypes["PROPOSER"] = true;
        achievementTypes["ELDER"] = true;
        achievementTypes["TREASURY_MASTER"] = true;
        achievementTypes["COMMUNITY_CHAMPION"] = true;
    }

    function mintAchievement(
        address to,
        string memory name,
        string memory category,
        uint256 rarity,
        string memory tokenURI,
        bool tradeable
    ) external onlyOwner returns (uint256) {
        require(achievementTypes[category], "Invalid achievement category");
        require(rarity >= 1 && rarity <= 4, "Invalid rarity");

        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        _safeMint(to, newTokenId);
        _setTokenURI(newTokenId, tokenURI);

        achievements[newTokenId] = Achievement({
            name: name,
            category: category,
            rarity: rarity,
            mintedAt: block.timestamp,
            originalMinter: to,
            tradeable: tradeable
        });

        emit AchievementMinted(newTokenId, to, name, rarity);
        return newTokenId;
    }

    function listForSale(uint256 tokenId, uint256 price) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(achievements[tokenId].tradeable, "This achievement is not tradeable");
        require(price > 0, "Price must be greater than 0");

        listings[tokenId] = Listing({
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            active: true
        });

        emit AchievementListed(tokenId, msg.sender, price);
    }

    function buyAchievement(uint256 tokenId) external payable nonReentrant {
        Listing memory listing = listings[tokenId];
        require(listing.active, "Not listed for sale");
        require(msg.value >= listing.price, "Insufficient payment");

        address seller = listing.seller;
        uint256 price = listing.price;

        // Calculate fees
        uint256 fee = (price * marketplaceFee) / 10000;
        uint256 sellerAmount = price - fee;

        // Transfer NFT
        _transfer(seller, msg.sender, tokenId);

        // Transfer funds
        payable(seller).transfer(sellerAmount);
        payable(feeCollector).transfer(fee);

        // Refund excess payment
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }

        // Remove listing
        delete listings[tokenId];

        emit AchievementSold(tokenId, msg.sender, seller, price);
    }

    function unlistAchievement(uint256 tokenId) external {
        require(listings[tokenId].seller == msg.sender, "Not the seller");
        delete listings[tokenId];
        emit AchievementUnlisted(tokenId);
    }

    function getAchievement(uint256 tokenId) external view returns (Achievement memory) {
        return achievements[tokenId];
    }

    function getUserAchievements(address user) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(user);
        uint256[] memory tokenIds = new uint256[](balance);
        
        uint256 index = 0;
        for (uint256 i = 1; i <= _tokenIds.current(); i++) {
            if (_exists(i) && ownerOf(i) == user) {
                tokenIds[index] = i;
                index++;
            }
        }
        
        return tokenIds;
    }

    function getActiveListings() external view returns (Listing[] memory) {
        uint256 activeCount = 0;
        
        // Count active listings
        for (uint256 i = 1; i <= _tokenIds.current(); i++) {
            if (listings[i].active) {
                activeCount++;
            }
        }
        
        Listing[] memory activeListings = new Listing[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= _tokenIds.current(); i++) {
            if (listings[i].active) {
                activeListings[index] = listings[i];
                index++;
            }
        }
        
        return activeListings;
    }

    function setMarketplaceFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee too high"); // Max 10%
        marketplaceFee = newFee;
    }

    function setFeeCollector(address newCollector) external onlyOwner {
        feeCollector = newCollector;
    }

    function addAchievementType(string memory achievementType) external onlyOwner {
        achievementTypes[achievementType] = true;
    }
}
