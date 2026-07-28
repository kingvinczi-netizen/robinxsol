// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title TraderPass
 * @dev A one-per-wallet ERC721 that gates entry to the BTC UP or DOWN
 *      prediction game. Two eligibility rules: you must hold at least
 *      2 m2026 (Paul's marks token) at mint time, and only 20,000 passes
 *      will ever exist. Artwork and metadata are generated entirely
 *      on-chain (an inline SVG, base64-encoded into the tokenURI) so the
 *      pass never depends on an external image host or pinning service.
 */
contract TraderPass is ERC721 {
    using Strings for uint256;

    uint256 public constant MAX_SUPPLY = 20000;
    uint256 public constant MIN_M2026_BALANCE = 2e18; // 2 m2026

    IERC20 public immutable m2026;
    uint256 public nextTokenId = 1;
    mapping(address => bool) public hasMinted;

    constructor(address m2026_) ERC721("DAT620 Trader Pass", "PASS") {
        m2026 = IERC20(m2026_);
    }

    /// @notice Mint your pass. Requires holding at least 2 m2026, one per wallet, capped at 20,000 total.
    function mint() external {
        require(!hasMinted[msg.sender], "already minted a pass");
        require(nextTokenId <= MAX_SUPPLY, "all passes minted");
        require(m2026.balanceOf(msg.sender) >= MIN_M2026_BALANCE, "need at least 2 m2026 to mint");
        hasMinted[msg.sender] = true;
        uint256 tokenId = nextTokenId++;
        _safeMint(msg.sender, tokenId);
    }

    function totalMinted() external view returns (uint256) {
        return nextTokenId - 1;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory json = string(
            abi.encodePacked(
                '{"name":"Trader Pass #',
                tokenId.toString(),
                '","description":"Grants entry to the BTC UP or DOWN prediction game.",',
                '"image":"data:image/svg+xml;base64,',
                Base64.encode(bytes(_svg(tokenId))),
                '"}'
            )
        );
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    function _svg(uint256 tokenId) internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220" viewBox="0 0 360 220">',
                _svgDefs(),
                _svgFrame(),
                _svgBadge(),
                _svgText(tokenId),
                "</svg>"
            )
        );
    }

    function _svgDefs() internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                "<defs>",
                '<linearGradient id="card" x1="0" y1="0" x2="360" y2="220" gradientUnits="userSpaceOnUse">',
                '<stop offset="0" stop-color="#181b21"/><stop offset="1" stop-color="#08090b"/>',
                "</linearGradient>",
                '<linearGradient id="border" x1="0" y1="0" x2="360" y2="220" gradientUnits="userSpaceOnUse">',
                '<stop offset="0" stop-color="#ffe29a"/><stop offset="1" stop-color="#c47c0e"/>',
                "</linearGradient>",
                '<radialGradient id="badge" cx="0.35" cy="0.3" r="0.85">',
                '<stop offset="0" stop-color="#fff2d2"/><stop offset="0.55" stop-color="#ffb020"/><stop offset="1" stop-color="#b8730c"/>',
                "</radialGradient>",
                '<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">',
                '<stop offset="0" stop-color="#ffffff" stop-opacity="0.14"/><stop offset="0.35" stop-color="#ffffff" stop-opacity="0"/>',
                "</linearGradient>",
                "</defs>"
            )
        );
    }

    function _svgFrame() internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                '<rect width="360" height="220" rx="20" fill="url(#card)"/>',
                '<rect x="6" y="6" width="348" height="208" rx="16" fill="none" stroke="url(#border)" stroke-width="2.5"/>',
                '<rect width="360" height="220" rx="20" fill="url(#sheen)"/>'
            )
        );
    }

    function _svgBadge() internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                '<circle cx="42" cy="42" r="17" fill="url(#badge)"/>',
                '<ellipse cx="38" cy="34" rx="9" ry="5" fill="#ffffff" opacity="0.4"/>',
                '<text x="42" y="48" font-family="monospace" font-size="16" fill="#2a1b02" font-weight="700" text-anchor="middle">P</text>'
            )
        );
    }

    function _svgText(uint256 tokenId) internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                '<text x="72" y="48" font-family="monospace" font-size="18" fill="#eef1f7" font-weight="700">TRADER PASS</text>',
                '<text x="30" y="105" font-family="monospace" font-size="13" fill="#7a8290">BTC UP or DOWN</text>',
                '<text x="30" y="132" font-family="monospace" font-size="12" fill="#00e676">ACCESS: PREDICTION GAME</text>',
                '<text x="30" y="190" font-family="monospace" font-size="15" fill="#ffb020" font-weight="700">No. ',
                tokenId.toString(),
                "</text>"
            )
        );
    }
}
