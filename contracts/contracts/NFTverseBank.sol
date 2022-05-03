//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

// ============ Imports ============

import "abdk-libraries-solidity/ABDKMath64x64.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title NFTverseBank: NFT-collateralized options
 * @author Platinum Hands
 * @dev Completed options are represented as tokenOwner = 0x0 to prevent
 *      errors w.r.t stack too deep (too large of a struct to include a bool)
 * @dev Unlike original spec., optionSellers are paid for only active duration (D')
 */
contract NFTverseBank {
  // ============ Structs ============

  // Individual options
  struct NFTverseOption {
    // NFT token address
    address tokenAddress;
    // NFT token owner (options initiator or 0x0 for repaid)
    address tokenOwner;
    // Current top optionSeller/bidder
    address optionSeller;
    // NFT token id
    uint256 tokenId;
    // Fixed premium rate
    uint256 premiumRate;
    // Current max bid
    uint256 optionAmount;
    // Maximum bid
    uint256 maxOptionAmount;
    // Current options utilization
    uint256 optionAmountDrawn;
    // Timestamp of first bid
    uint256 firstBidTime;
    // Timestamp of last bid
    uint256 lastBidTime;
    // Premium paid by top bidder, thus far
    uint256 historicPremium;
    // Timestamp of options completion
    uint256 optionCompleteTime;
  }

  // ============ Mutable storage ============

  // Number of options issued
  uint256 public numOptions;
  // Mapping of options number to options struct
  mapping(uint256 => NFTverseOption) public nftverseOptions;
  // ============ Events ============

  // options creation event with indexed NFT owner
  event OptionCreated(
    uint256 id,
    address indexed owner,
    address tokenAddress,
    uint256 tokenId,
    uint256 maxOptionAmount,
    uint256 optionCompleteTime
  );
  // New options optionSeller/bidder
  event OptionUnderwritten(uint256 id, address optionSeller);
  // options drawn by NFT owner
  event OptionDrawn(uint256 id);
  // options repayed by address
  event OptionRepayed(uint256 id, address optionSeller, address repayer);
  // options cancelled by NFT owner
  event OptionCancelled(uint256 id);
  // NFT seized by optionSeller
  event OptionSeized(uint256 id, address optionSeller, address caller);

  // ============ Functions ============

  /**
   * Enables an NFT owner to create a options, specifying parameters
   * @param _tokenAddress NFT token address
   * @param _tokenId NFT token id
   * @param _premiumRate percentage fixed premium rate for period
   * @param _maxOptionAmount maximum allowed Ether bid
   * @param _optionCompleteTime time of options completion
   * @return options id
   */
  function createOption(
    address _tokenAddress,
    uint256 _tokenId,
    uint256 _premiumRate,
    uint256 _maxOptionAmount,
    uint256 _optionCompleteTime
  ) external returns (uint256) {
    // Enforce creating future-dated options
    require(_optionCompleteTime > block.timestamp, "Can't create options in past");

    // NFT id
    uint256 optionId = ++numOptions;

    // Transfer NFT from owner to contract
    IERC721(_tokenAddress).transferFrom(msg.sender, address(this), _tokenId);

    // Create options
    nftverseOptions[optionId].tokenAddress = _tokenAddress;
    nftverseOptions[optionId].tokenOwner = msg.sender;
    nftverseOptions[optionId].tokenId = _tokenId;
    nftverseOptions[optionId].premiumRate = _premiumRate;
    nftverseOptions[optionId].maxOptionAmount = _maxOptionAmount;
    nftverseOptions[optionId].optionCompleteTime = _optionCompleteTime;

    // Emit creation event
    emit OptionCreated(
      optionId,
      msg.sender,
      _tokenAddress,
      _tokenId,
      _maxOptionAmount,
      _optionCompleteTime
    );

    // Return options id
    return optionId;
  }

  /**
   * Helper: Calculate accrued premium for a particular optionSeller
   * @param _optionId NFTverseOption id
   * @param _future allows calculating accrued premium in future
   * @return Accrued premium on current top bid, in Ether
   */
  function calculatePremiumAccrued(uint256 _optionId, uint256 _future)
    public
    view
    returns (uint256)
  {
    NFTverseOption memory options = nftverseOptions[_optionId];
    // Seconds that current bid has stayed at top
    uint256 _secondsAsTopBid = block.timestamp + _future - options.lastBidTime;
    // Seconds that any options has been active
    uint256 _secondsSinceFirstBid = options.optionCompleteTime - options.firstBidTime;
    // Duration of total options time that current bid has been active
    int128 _durationAsTopBid = ABDKMath64x64.divu(_secondsAsTopBid, _secondsSinceFirstBid);
    // Premium rate
    int128 _premiumRate = ABDKMath64x64.divu(options.premiumRate, 100);
    // Calculating the maximum premium if paying _premiumRate for all _secondsSinceFirstBid
    uint256 _maxPremium = ABDKMath64x64.mulu(_premiumRate, options.optionAmount);
    // Calculating the share of maximum premium to pay to top bidder
    return ABDKMath64x64.mulu(_durationAsTopBid, _maxPremium);
  }

  /**
   * Helper: Calculates required additional capital (over topbid) to outbid options
   * @param _optionId NFTverseOption id
   * @param _future allows calculating required additional capital in future
   * @return required premium payment to cover current top bidder
   */
  function calculateTotalPremium(uint256 _optionId, uint256 _future) public view returns (uint256) {
    NFTverseOption memory options = nftverseOptions[_optionId];

    // past optionSeller premium + current accrued premium
    return options.historicPremium + calculatePremiumAccrued(_optionId, _future);
  }

  /**
   * Helper: Calculate required capital to repay options
   * @param _optionId NFTverseOption id
   * @param _future allows calculating require payment in future
   * @return required options repayment in Ether
   */
  function calculateRequiredRepayment(uint256 _optionId, uint256 _future)
    public
    view
    returns (uint256)
  {
    NFTverseOption memory options = nftverseOptions[_optionId];

    // amount withdrawn + total premium to be paid
    return options.optionAmountDrawn + calculateTotalPremium(_optionId, _future);
  }

  /**
   * Enables a optionSeller/bidder to underwrite a options, given it is the top bid
   * @param _optionId id of options to underwrite
   * @dev Requires an unpaid options, where currentBid < newBid <= maxBid
   */
  function underwriteOption(uint256 _optionId) external payable {
    NFTverseOption storage options = nftverseOptions[_optionId];
    // Prevent underwriting with 0 value
    require(msg.value > 0, "Can't underwrite with 0 Ether.");
    // Prevent underwriting a repaid options
    require(options.tokenOwner != address(0), "Can't underwrite a repaid options.");
    // Prevent underwriting an expired options
    require(options.optionCompleteTime >= block.timestamp, "Can't underwrite expired options.");

    // If options has a previous bid:
    if (options.firstBidTime != 0) {
      // Historic premium paid to previous top bidders + accrued premium to current bidder
      // As of current block (future = 0 seconds)
      uint256 _totalPremium = calculateTotalPremium(_optionId, 0);
      // Calculate total payout for previous bidder
      uint256 _bidPayout = options.optionAmount + _totalPremium;

      // Prevent underwriting a options with value < required payout
      require(_bidPayout < msg.value, "Can't underwrite < top optionSeller.");
      // Prevent underwriting a options with value greater than max bid + pending premium
      require(options.maxOptionAmount + _totalPremium >= msg.value, "Can't underwrite > max options.");

      // Buyout current top bidder
      (bool sent, ) = payable(options.optionSeller).call{value: _bidPayout}("");
      require(sent == true, "Failed to buyout top bidder.");

      // Increment historic paid premium
      options.historicPremium += _totalPremium;
      // Update new options amount
      options.optionAmount = msg.value - _totalPremium;
    } else {
      // Prevent underwriting a options with value greater than max bid
      require(options.maxOptionAmount >= msg.value, "Can't underwrite > max options.");
      // If options doesn't have a previous bid (to buyout), set first bid time
      options.firstBidTime = block.timestamp;
      // Update new options amount
      options.optionAmount = msg.value;
    }

    // Update new optionSeller address
    options.optionSeller = msg.sender;
    // Update last bid time
    options.lastBidTime = block.timestamp;

    // Emit new underwriting event
    emit OptionUnderwritten(_optionId, msg.sender);
  }

  /**
   * Enables NFT owner to draw capital from top bid
   * @param _optionId id of options to draw from
   */
  function drawOption(uint256 _optionId) external {
    NFTverseOption storage options = nftverseOptions[_optionId];
    // Prevent non-options-owner from drawing
    require(options.tokenOwner == msg.sender, "Must be NFT owner to draw.");
    // Prevent drawing from a options with 0 available capital
    require(options.optionAmountDrawn < options.optionAmount, "Max draw capacity reached.");

    // Calculate capital to draw
    uint256 _availableCapital = options.optionAmount - options.optionAmountDrawn;
    // Update drawn amount to current options capacity
    options.optionAmountDrawn = options.optionAmount;
    // Draw the maximum available options capital
    (bool sent, ) = payable(msg.sender).call{value: _availableCapital}("");
    require(sent, "Failed to draw capital.");

    // Emit draw event
    emit OptionDrawn(_optionId);
  }

  /**
   * Enables anyone to repay a options on behalf of owner
   * @param _optionId id of options to repay
   */
  function repayOption(uint256 _optionId) external payable {
    NFTverseOption storage options = nftverseOptions[_optionId];
    // Prevent repaying repaid options
    require(options.tokenOwner != address(0), "Can't repay paid options.");
    // Prevent repaying options without bids
    require(options.firstBidTime != 0, "Can't repay options with 0 bids.");
    // Prevent repaying options after expiry
    require(options.optionCompleteTime >= block.timestamp, "Can't repay expired options.");

    // Add historic premium paid to previous top bidders + accrued premium to top bidder
    // As of current block (future = 0 seconds)
    uint256 _totalPremium = calculateTotalPremium(_optionId, 0);
    // Calculate additional capital required to process payout
    uint256 _additionalCapital = options.optionAmountDrawn + _totalPremium;
    // Enforce additional required capital is passed to contract
    require(msg.value >= _additionalCapital, "Insufficient repayment.");

    // Payout current top bidder (options amount + total pending premium)
    (bool sent, ) = payable(options.optionSeller).call{value: (options.optionAmount + _totalPremium)}("");
    require(sent, "Failed to repay options.");

    // Transfer NFT back to owner
    IERC721(options.tokenAddress).transferFrom(address(this), options.tokenOwner, options.tokenId);

    // Toggle options repayment (nullify tokenOwner)
    options.tokenOwner = address(0);

    // Emit repayment event
    emit OptionRepayed(_optionId, options.optionSeller, msg.sender);
  }

  /**
   * Enables owner to cancel options
   * @param _optionId id of options to cancel
   * @dev requires no active bids to be placed (else, use repay)
   */
  function cancelOption(uint256 _optionId) external {
    NFTverseOption storage options = nftverseOptions[_optionId];
    // Enforce options ownership
    require(options.tokenOwner == msg.sender, "Must be NFT owner to cancel.");
    // Enforce options has no bids
    require(options.firstBidTime == 0, "Can't cancel options with >0 bids.");

    // Return NFT to owner
    IERC721(options.tokenAddress).transferFrom(address(this), msg.sender, options.tokenId);

    // Nullify options
    options.tokenOwner = address(0);

    // Emit cancelleation event
    emit OptionCancelled(_optionId);
  }

  /**
   * Enables anyone to seize NFT, for optionSeller, on options default
   * @param _optionId id of options to seize collateral
   */
  function seizeNFT(uint256 _optionId) external {
    NFTverseOption memory options = nftverseOptions[_optionId];
    // Enforce options is unpaid
    require(options.tokenOwner != address(0), "Can't seize from repaid options.");
    // Enforce options is expired
    require(options.optionCompleteTime < block.timestamp, "Can't seize before expiry.");

    // Transfer NFT to optionSeller
    IERC721(options.tokenAddress).transferFrom(address(this), options.optionSeller, options.tokenId);

    // Emit seize event
    emit OptionSeized(_optionId, options.optionSeller, msg.sender);
  }
}
