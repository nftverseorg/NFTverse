import { ethers } from "ethers"; // Ethers
import { NFTverseBankABI } from "@utils/abi/NFTverseBank"; // NFTverse Bank ABI

// Constant: NFTverse Bank deployed address
export const NFTVERSE_BANK_ADDRESS: string =
  process.env.NFTVERSE_BANK_ADDRESS ?? "0x1C04Ed3eC38144ebB91c467c8aC33e52753BBCe1";

// Export NFTverseBank contract w/ RPC
export const NFTverseBankRPC = new ethers.Contract(
  NFTVERSE_BANK_ADDRESS,
  NFTverseBankABI,
  new ethers.providers.JsonRpcProvider(
    `https://rinkeby.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_RPC}`,
    4
  )
);

/**
 * Converts BigNumber Ether value to number
 * @param {ethers.BigNumber} num bignumber ether value
 * @returns {number} formatted ether as number
 */
export function parseEther(num: ethers.BigNumber): number {
  return Number(ethers.utils.formatEther(num.toString()));
}
