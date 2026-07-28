// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/**
 * @title BTCPredictionGameV2
 * @dev Same mechanics as BTCPredictionGame (peer-pool BTC UP/DOWN staking on
 *      a Pyth-pulled price, 80s rounds, tie/no-contest refunds — see that
 *      contract for the full design rationale). The only change is an
 *      entry gate: a wallet must hold a TraderPass NFT before it can stake.
 *      Deployed as a new contract rather than upgrading the original,
 *      since deployed Solidity code can't be edited in place.
 */
contract BTCPredictionGameV2 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Outcome {
        Pending,
        Up,
        Down,
        Tie
    }

    struct Round {
        uint256 startTime;
        uint256 endTime;
        int64 startPrice;
        int64 endPrice;
        uint256 upPool;
        uint256 downPool;
        bool settled;
        bool refunded;
        Outcome outcome;
    }

    uint256 public constant ROUND_DURATION = 80 seconds;
    uint256 public constant MIN_STAKE = 1e18; // 1 m2026
    uint256 public constant MAX_STAKE = 3e18; // 3 m2026
    uint256 public constant PRICE_MAX_AGE = 60 seconds;

    IERC20 public immutable stakeToken;
    IPyth public immutable pyth;
    bytes32 public immutable priceId;
    IERC721 public immutable traderPass;

    uint256 public currentRoundId;
    mapping(uint256 => Round) public rounds;

    mapping(uint256 => mapping(address => uint256)) public stakeAmount;
    mapping(uint256 => mapping(address => bool)) public stakedUp;
    mapping(uint256 => address[]) private upStakers;
    mapping(uint256 => address[]) private downStakers;

    mapping(address => uint256) public withdrawable;

    event RoundStarted(uint256 indexed roundId, int64 startPrice, uint256 startTime, uint256 endTime);
    event Staked(uint256 indexed roundId, address indexed user, bool isUp, uint256 amount);
    event RoundSettled(uint256 indexed roundId, int64 endPrice, Outcome outcome, bool refunded, uint256 upPool, uint256 downPool);
    event Withdrawn(address indexed user, uint256 amount);

    constructor(address stakeToken_, address pyth_, bytes32 priceId_, address traderPass_) {
        stakeToken = IERC20(stakeToken_);
        pyth = IPyth(pyth_);
        priceId = priceId_;
        traderPass = IERC721(traderPass_);
    }

    function tick(bytes[] calldata priceUpdate) external payable nonReentrant {
        uint256 fee = priceUpdate.length > 0 ? pyth.getUpdateFee(priceUpdate) : 0;
        require(msg.value >= fee, "insufficient pyth fee");
        if (priceUpdate.length > 0) {
            pyth.updatePriceFeeds{value: fee}(priceUpdate);
        }

        PythStructs.Price memory p = pyth.getPriceNoOlderThan(priceId, PRICE_MAX_AGE);

        if (currentRoundId != 0 && !rounds[currentRoundId].settled && block.timestamp >= rounds[currentRoundId].endTime) {
            _settleRound(currentRoundId, p.price);
        }
        if (currentRoundId == 0 || rounds[currentRoundId].settled) {
            _startRound(p.price);
        }

        uint256 refundAmt = msg.value - fee;
        if (refundAmt > 0) {
            (bool ok, ) = msg.sender.call{value: refundAmt}("");
            require(ok, "eth refund failed");
        }
    }

    /// @notice Stake on the current round. Requires holding a TraderPass. One stake per wallet per round, 1-3 m2026.
    function stake(uint256 roundId, bool isUp, uint256 amount) external nonReentrant {
        require(traderPass.balanceOf(msg.sender) > 0, "need a Trader Pass to bet");
        require(roundId == currentRoundId, "not current round");
        Round storage r = rounds[roundId];
        require(!r.settled, "round already settled");
        require(block.timestamp < r.endTime, "round closed");
        require(amount >= MIN_STAKE && amount <= MAX_STAKE, "stake must be 1-3 m2026");
        require(stakeAmount[roundId][msg.sender] == 0, "already staked this round");

        stakeAmount[roundId][msg.sender] = amount;
        stakedUp[roundId][msg.sender] = isUp;

        if (isUp) {
            r.upPool += amount;
            upStakers[roundId].push(msg.sender);
        } else {
            r.downPool += amount;
            downStakers[roundId].push(msg.sender);
        }

        stakeToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(roundId, msg.sender, isUp, amount);
    }

    function withdraw() external nonReentrant {
        uint256 amount = withdrawable[msg.sender];
        require(amount > 0, "nothing to withdraw");
        withdrawable[msg.sender] = 0;
        stakeToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function getUpStakers(uint256 roundId) external view returns (address[] memory) {
        return upStakers[roundId];
    }

    function getDownStakers(uint256 roundId) external view returns (address[] memory) {
        return downStakers[roundId];
    }

    function timeRemaining() external view returns (uint256) {
        Round storage r = rounds[currentRoundId];
        if (currentRoundId == 0 || r.settled || block.timestamp >= r.endTime) return 0;
        return r.endTime - block.timestamp;
    }

    function _startRound(int64 openPrice) internal {
        currentRoundId += 1;
        Round storage r = rounds[currentRoundId];
        r.startTime = block.timestamp;
        r.endTime = block.timestamp + ROUND_DURATION;
        r.startPrice = openPrice;
        emit RoundStarted(currentRoundId, openPrice, r.startTime, r.endTime);
    }

    function _settleRound(uint256 roundId, int64 closePrice) internal {
        Round storage r = rounds[roundId];
        r.endPrice = closePrice;
        r.settled = true;

        if (closePrice > r.startPrice) {
            r.outcome = Outcome.Up;
            if (r.upPool == 0) {
                r.refunded = true;
                _refundRound(roundId);
            } else {
                _payWinners(upStakers[roundId], roundId, r.upPool + r.downPool, r.upPool);
            }
        } else if (closePrice < r.startPrice) {
            r.outcome = Outcome.Down;
            if (r.downPool == 0) {
                r.refunded = true;
                _refundRound(roundId);
            } else {
                _payWinners(downStakers[roundId], roundId, r.upPool + r.downPool, r.downPool);
            }
        } else {
            r.outcome = Outcome.Tie;
            r.refunded = true;
            _refundRound(roundId);
        }

        emit RoundSettled(roundId, closePrice, r.outcome, r.refunded, r.upPool, r.downPool);
    }

    function _payWinners(address[] storage winners, uint256 roundId, uint256 totalPool, uint256 winPool) internal {
        for (uint256 i = 0; i < winners.length; i++) {
            address user = winners[i];
            uint256 userStake = stakeAmount[roundId][user];
            withdrawable[user] += (userStake * totalPool) / winPool;
        }
    }

    function _refundRound(uint256 roundId) internal {
        address[] storage ups = upStakers[roundId];
        for (uint256 i = 0; i < ups.length; i++) {
            withdrawable[ups[i]] += stakeAmount[roundId][ups[i]];
        }
        address[] storage downs = downStakers[roundId];
        for (uint256 i = 0; i < downs.length; i++) {
            withdrawable[downs[i]] += stakeAmount[roundId][downs[i]];
        }
    }
}
