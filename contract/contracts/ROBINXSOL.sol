// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title ROBINXSOL
 * @dev Fixed-supply, ownerless ERC20 token.
 *
 * The entire supply of 1,000,000,000 RXS is minted once to the deployer in the
 * constructor. There is no mint function and no owner, so the supply can never
 * grow and there is no admin key that could be leaked or compromised. This is
 * the most trustworthy setup for a fixed-supply token.
 */
contract ROBINXSOL is ERC20 {
    // 1 billion whole tokens. decimals() is 18, so this expands to
    // 1_000_000_000 * 10**18 base units under the hood.
    uint256 private constant INITIAL_SUPPLY = 1_000_000_000;

    constructor() ERC20("ROBINXSOL", "RXS") {
        _mint(msg.sender, INITIAL_SUPPLY * 10 ** decimals());
    }
}
