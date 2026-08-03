// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @notice Mintable/burnable ERC20 for testing. Exposes burn() to satisfy IMTAAToken.
 */
contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_)
        ERC20(name, symbol)
    {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) { return _decimals; }

    function mint(address to, uint256 amount) external { _mint(to, amount); }

    function burn(uint256 amount) external { _burn(msg.sender, amount); }
}

/**
 * @title MockPriceOracle
 * @notice Returns a fixed price for any token. Satisfies IPriceOracle interface.
 *         Price is in USD scaled by 1e18 (cUSD per MTAA).
 */
contract MockPriceOracle {
    uint256 public price;

    constructor(uint256 _price) { price = _price; }

    /// @notice IPriceOracle.getPrice(address) — ignores token, returns fixed price
    function getPrice(address) external view returns (uint256) { return price; }

    /// @notice IPriceOracle.getPrice() — no-arg variant used by MaonoVault spawn cost
    function getPrice() external view returns (uint256) { return price; }

    /// @notice Chainlink-style: returns (roundId, answer, startedAt, updatedAt, answeredInRound)
    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (1, int256(price), block.timestamp, block.timestamp, 1);
    }

    function setPrice(uint256 _price) external { price = _price; }
}
