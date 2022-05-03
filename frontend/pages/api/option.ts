//@ts-nocheck
import Redis from "ioredis"; // Redis
import { parseEther, NFTverseBankRPC } from "@utils/ethers"; // RPC

// Types
import type { OptionWithMetadata } from "@utils/types";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Collects data about a single option
 * @param {number} optionId to collect data
 * @returns {Promise<OptionWithMetadata>}
 */
export async function collectSingleOption(
  optionId: number
): Promise<OptionWithMetadata> {
  // FIXME: hack to bypass OpenSea depencency
  // Retrieve metadata for all NFTs
  const client = new Redis(process.env.REDIS_URL);
  let request = await client.get("metadata");
  let metadata: Record<string, Record<string, string>> = {};
  if (request) {
    metadata = JSON.parse(request);
  }

  // Collect option
  const option: any[] = await NFTverseBankRPC.nftverseOptions(optionId);
  // Collect option metadata from temporary Redis store
  const { name, description, imageURL } =
    metadata[`${option[0].toLowerCase()}-${option[3].toString()}`];

  // Push option data
  return {
    optionId,
    name,
    description,
    imageURL,
    tokenAddress: option[0],
    tokenOwner: option[1],
    optionSeller: option[2],
    tokenId: option[3].toNumber(),
    premiumRate: option[4].toNumber(),
    optionAmount: parseEther(option[5]),
    maxOptionAmount: parseEther(option[6]),
    optionAmountDrawn: parseEther(option[7]),
    firstBidTime: option[8].toNumber(),
    lastBidTime: option[9].toNumber(),
    historicPremium: parseEther(option[10]),
    optionCompleteTime: option[11].toNumber(),
  };
}

// Return option data
const options = async (req: NextApiRequest, res: NextApiResponse) => {
  const { id } = req.query;

  res.send(await collectSingleOption(Number(id)));
};

export default options;
