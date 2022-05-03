// Base NFT Option
export interface Option {
  // Retrievable id
  optionId: number;
  // NFT token address
  tokenAddress: string;
  // NFT token original owner
  tokenOwner: string;
  // Current optionSeller
  optionSeller: string;
  // NFT token id
  tokenId: number;
  // Fixed premium rate
  premiumRate: number;
  // Currently raised option amount
  optionAmount: number;
  // Bid ceiling
  maxOptionAmount: number;
  // Currently drawn option amount
  optionAmountDrawn: number;
  // Timestamp of first bid
  firstBidTime: number;
  // Timestamp of last bid
  lastBidTime: number;
  // Historic premium accrued
  historicPremium: number;
  // Timestamp of option completion
  optionCompleteTime: number;
}

// Option w/ added Metadata to render card
export interface OptionWithMetadata extends Option {
  // NFT image
  imageURL: string;
  // NFT name
  name: string;
  // NFT description
  description: string;
}
