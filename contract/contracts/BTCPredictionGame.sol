// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/**
 * @title BTCPredictionGame
 * @dev Stake m2026 on whether BTC/USD will be higher or lower after a fixed
 *      round window. Settlement price comes from Pyth (pulled on demand, not
 *      a slow push feed) so rounds can be short and still resolve on a real,
 *      signature-verified price instead of a number someone typed in.
 *
 *      Payouts are peer-pool: the losing side's stakes are split among the
 *      winning side, proportional to each winner's own stake. A tie (price
 *      unchanged) or a one-sided round (nobody on the winning side) refunds
 *      everyone their own stake instead of picking a winner out of nothing.
 *
 *      Winnings accumulate in an internal ledger (`withdrawable`) rather than
 *      being pushed out during settlement, so settling a round never makes an
 *      external token transfer — only `withdraw()` does, guarded by
 *      checks-effects-interactions and a reentrancy guard.
 */
contract BTCPredictionGame is ReentrancyGuard {
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
        bool refunded; // true if this round paid out via refund instead of a split
        Outcome outcome;
    }

    uint256 public constant ROUND_DURATION = 80 seconds;
    uint256 public constant MIN_STAKE = 1e18; // 1 m2026
    uint256 public constant MAX_STAKE = 3e18; // 3 m2026
    uint256 public constant PRICE_MAX_AGE = 60 seconds; // tolerance for Pyth price staleness

    IERC20 public immutable stakeToken;
    IPyth public immutable pyth;
    bytes32 public immutable priceId;

    uint256 public currentRoundId; // 0 = no round has ever started
    mapping(uint256 => Round) public rounds;

    mapping(uint256 => mapping(address => uint256)) public stakeAmount; // roundId => user => amount (0 = no stake)
    mapping(uint256 => mapping(address => bool)) public stakedUp; // roundId => user => true if staked UP
    mapping(uint256 => address[]) private upStakers;
    mapping(uint256 => address[]) private downStakers;

    mapping(address => uint256) public withdrawable;

    event RoundStarted(uint256 indexed roundId, int64 startPrice, uint256 startTime, uint256 endTime);
    event Staked(uint256 indexed roundId, address indexed user, bool isUp, uint256 amount);
    event RoundSettled(uint256 indexed roundId, int64 endPrice, Outcome outcome, bool refunded, uint256 upPool, uint256 downPool);
    event Withdrawn(address indexed user, uint256 amount);

    constructor(address stakeToken_, address pyth_, bytes32 priceId_) {
        stakeToken = IERC20(stakeToken_);
        pyth = IPyth(pyth_);
        priceId = priceId_;
    }

    /**
     * @notice Settles the current round if its window has elapsed, then starts
     *      the next one using the same freshly-fetched price as its opening
     *      price. Permissionless — anyone's transaction can drive the game
     *      forward, which is what makes rounds feel "automatic" without any
     *      off-chain keeper having special rights.
     * @param priceUpdate Signed price update data fetched from Pyth's Hermes
     *      API off-chain. Pass an empty array to skip paying the update fee
     *      and rely on whatever price is already cached on-chain (only safe
     *      if it's still fresh enough to pass PRICE_MAX_AGE).
     */
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

    /// @notice Stake on the current round. One stake per wallet per round, 1-3 m2026.
    function stake(uint256 roundId, bool isUp, uint256 amount) external nonReentrant {
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

    /// @notice Withdraw all accumulated winnings across every settled round.
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
