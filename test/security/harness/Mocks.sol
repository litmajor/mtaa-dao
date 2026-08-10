// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Minimal, fully local ERC20 with configurable decimals. Used as the
///         vault's underlying asset in the security suite.
contract MockERC20 is IERC20 {
    string public name;
    string public symbol;
    uint8 public immutable decimals;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function mint(address to, uint256 amount) public virtual {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function burn(address from, uint256 amount) public virtual {
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    function approve(address spender, uint256 amount) public virtual returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) public virtual returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public virtual returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal virtual {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

/// @notice MTAA token stand-in: exposes `burn(uint256)` like IMTAAToken expects.
contract MockMTAA is MockERC20 {
    constructor() MockERC20("MTAA", "MTAA", 18) {}

    function burn(uint256 amount) external {
        burn(msg.sender, amount);
    }
}

/// @notice MTAA stand-in whose burn() always reverts (exercises BurnFailed path).
contract RevertingBurnMTAA is MockERC20 {
    constructor() MockERC20("MTAA-bad", "MTAAB", 18) {}

    function burn(uint256) external pure {
        revert("burn disabled");
    }
}

/// @notice Fee-on-transfer token: recipient receives less than `amount`.
contract FeeOnTransferERC20 is MockERC20 {
    uint256 public feeBps;

    constructor(uint256 _feeBps) MockERC20("FeeToken", "FEE", 18) {
        feeBps = _feeBps;
    }

    function _transfer(address from, address to, uint256 amount) internal override {
        uint256 fee = (amount * feeBps) / 10_000;
        balanceOf[from] -= amount;
        balanceOf[to] += amount - fee;
        totalSupply -= fee; // fee is burned
        emit Transfer(from, to, amount - fee);
    }
}

/// @notice Rebasing token: balances scale with a global multiplier.
contract RebasingERC20 is IERC20 {
    string public constant name = "Rebase";
    string public constant symbol = "RBS";
    uint8 public constant decimals = 18;

    uint256 public scaleBps = 10_000;
    uint256 public rawTotalSupply;
    mapping(address => uint256) public rawBalance;
    mapping(address => mapping(address => uint256)) public allowance;

    function setScaleBps(uint256 s) external {
        scaleBps = s;
    }

    function totalSupply() external view returns (uint256) {
        return (rawTotalSupply * scaleBps) / 10_000;
    }

    function balanceOf(address a) public view returns (uint256) {
        return (rawBalance[a] * scaleBps) / 10_000;
    }

    function mint(address to, uint256 amount) external {
        uint256 raw = (amount * 10_000) / scaleBps;
        rawBalance[to] += raw;
        rawTotalSupply += raw;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        uint256 raw = (amount * 10_000) / scaleBps;
        rawBalance[from] -= raw;
        rawBalance[to] += raw;
        emit Transfer(from, to, amount);
    }
}

/// @notice ERC20 that returns `false` instead of reverting on failure and can be
///         configured to return no data at all (USDT-style).
contract WeirdReturnERC20 is MockERC20 {
    bool public returnFalse;
    bool public returnNothing;

    constructor() MockERC20("Weird", "WRD", 18) {}

    function setReturnFalse(bool v) external {
        returnFalse = v;
    }

    function setReturnNothing(bool v) external {
        returnNothing = v;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (returnFalse) return false;
        super._transfer(msg.sender, to, amount);
        if (returnNothing) {
            assembly {
                return(0, 0)
            }
        }
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (returnFalse) return false;
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        super._transfer(from, to, amount);
        if (returnNothing) {
            assembly {
                return(0, 0)
            }
        }
        return true;
    }
}

/// @notice ERC777-style token with a transfer callback into an attacker contract.
contract ReentrantERC20 is MockERC20 {
    address public hook;
    bool public hookEnabled;

    constructor() MockERC20("Reentrant", "RNT", 18) {}

    function setHook(address _hook) external {
        hook = _hook;
        hookEnabled = true;
    }

    function disableHook() external {
        hookEnabled = false;
    }

    function _transfer(address from, address to, uint256 amount) internal override {
        super._transfer(from, to, amount);
        if (hookEnabled && hook != address(0)) {
            IReentrancyHook(hook).onTokenTransfer(from, to, amount);
        }
    }
}

interface IReentrancyHook {
    function onTokenTransfer(address from, address to, uint256 amount) external;
}

/// @notice Simple price oracle stand-in returning a settable USD-cents price.
contract MockPriceOracle {
    uint256 public price;
    bool public shouldRevert;

    constructor(uint256 _price) {
        price = _price;
    }

    function setPrice(uint256 p) external {
        price = p;
    }

    function setShouldRevert(bool v) external {
        shouldRevert = v;
    }

    function getPrice() external view returns (uint256) {
        require(!shouldRevert, "oracle down");
        return price;
    }
}
