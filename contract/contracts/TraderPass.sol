// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title TraderPass
 * @dev A free, one-per-wallet ERC721 that gates entry to the BTC UP or DOWN
 *      prediction game. Artwork and metadata are generated entirely on-chain
 *      (an inline SVG, base64-encoded into the tokenURI) so the pass never
 *      depends on an external image host or pinning service — nothing to go
 *      offline, nothing outside this contract to trust.
 */
contract TraderPass is ERC721 {
    using Strings for uint256;

    uint256 public nextTokenId = 1;
    mapping(address => bool) public hasMinted;

    constructor() ERC721("DAT620 Trader Pass", "PASS") {}

    /// @notice Mint your pass. Free, one per wallet, forever.
    function mint() external {
        require(!hasMinted[msg.sender], "already minted a pass");
        hasMinted[msg.sender] = true;
        uint256 tokenId = nextTokenId++;
        _safeMint(msg.sender, tokenId);
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
                '<rect width="360" height="220" rx="20" fill="#0a0b0d"/>',
                '<rect x="6" y="6" width="348" height="208" rx="16" fill="none" stroke="#ffb020" stroke-width="2"/>',
                '<circle cx="42" cy="42" r="16" fill="#ffb020"/>',
                '<text x="42" y="48" font-family="monospace" font-size="16" fill="#0a0b0d" font-weight="700" text-anchor="middle">P</text>',
                '<text x="72" y="48" font-family="monospace" font-size="18" fill="#eef1f7" font-weight="700">TRADER PASS</text>',
                '<text x="30" y="105" font-family="monospace" font-size="13" fill="#7a8290">BTC UP or DOWN</text>',
                '<text x="30" y="132" font-family="monospace" font-size="12" fill="#00e676">ACCESS: PREDICTION GAME</text>',
                '<text x="30" y="190" font-family="monospace" font-size="15" fill="#ffb020" font-weight="700">No. ',
                tokenId.toString(),
                '</text>',
                "</svg>"
            )
        );
    }
}
