// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// Pulls MockPyth into Hardhat's compile graph so tests can deploy it and
// TypeChain generates its types. Not used anywhere outside tests.
import "@pythnetwork/pyth-sdk-solidity/MockPyth.sol";
