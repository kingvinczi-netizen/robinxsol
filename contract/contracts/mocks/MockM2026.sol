// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Test-only stand-in for the real m2026 token, with an open mint so
///      tests can freely fund accounts. Not deployed anywhere real.
contract MockM2026 is ERC20 {
    constructor() ERC20("MSc2026Token", "m2026") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
