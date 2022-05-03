//@ts-nocheck
import Redis from "ioredis"; // Redis
import { parseEther, NFTverseBankRPC } from "@utils/ethers"; // RPC

// Types
import type { BigNumber } from "ethers";
import type { OptionWithMetadata } from "@utils/types";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Collects data about all options
 * @returns {Promise<OptionWithMetadata[]>}
 */
 // Fix it by same method as EKA to gets and stores metadata
async function collectAllOptions(): Promise<OptionWithMetadata[]> {
  // FIXME: hack to bypass OpenSea depencency
  // Retrieve metadata for all NFTs
  const client = new Redis(process.env.REDIS_URL);
  let request = await client.get("metadata");
  let metadata: Record<string, Record<string, string>> = {};
  if (request) {
    metadata = JSON.parse(request);
  }

  // Collect number of created options
  const numOptions: BigNumber = await NFTverseBankRPC.numOptions();
  const numOptionsInt: number = numOptions.toNumber();

  // Temporary array to store option data
  let options: OptionWithMetadata[] = [];

  // For each option Commented for now by me

  console.log("My Logs: Total numbers of options are : ", numOptionsInt);

  for (let i = 1; i <= numOptionsInt; i++) {
  try {
    // Collect option information from contract
    const option: any[] = await NFTverseBankRPC.nftverseOptions(i);
    //console.log("My Logs: options are : ", option);

    // Collect option metadata from temporary Redis store
    const { name, description, imageURL } =
    metadata[`${option[0].toLowerCase()}-${option[3].toString()}`];

    // Need to get metadata of NFT and put here to fix all issues
    // Push option data
    options.push({
      optionId: i,
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
    });
    }
    catch (e: unknown) {
    console.log("My Logs: Error :",i,e.message);
    }
  }

  // Return options (ordered by recency in creation)
  return options.reverse();
}

// Return option data
const options = async (req: NextApiRequest, res: NextApiResponse) => {
  res.send(await collectAllOptions());
};

export default options;
