//@ts-nocheck
import axios from "axios"; // Axios
import { eth } from "@state/eth"; // ETH state
import { toast } from "react-toastify"; // Toast notifications
import { BigNumber, ethers } from "ethers"; // Ethers
import { ERC721ABI } from "@utils/abi/erc721"; // ABI: ERC721
import { createContainer } from "unstated-next"; // State
import { NFTverseBankABI } from "@utils/abi/NFTverseBank"; // ABI: NFTverseBank
import { NFTVERSE_BANK_ADDRESS } from "@utils/ethers"; // Utils

/*
  TODO: better types for option returns
  TODO: refactor various similar functions into one class
  TODO: fix arbitrary gas limits
*/

/**
 * Provides utility functions for use with option management
 */
function useOption() {
  // Collect provider from eth state
  const { provider } = eth.useContainer();

  /**
   * Generates new ERC721 contract from ERC721 token address
   * @param {string} address of ERC721 contract
   * @returns {ethers.Contract} connected to provider
   */
  async function collectERC721Contract(
    address: string
  ): Promise<ethers.Contract | undefined> {
    if (provider) {
      return new ethers.Contract(
        address,
        ERC721ABI,
        await provider.getSigner()
      );
    }
  }

  /**
   * Generates NFTverseBank contract
   * @returns {ethers.Contract} connected to provider
   */
  async function collectNFTverseBankContract(): Promise<
    ethers.Contract | undefined
  > {
    if (provider) {
      return new ethers.Contract(
        NFTVERSE_BANK_ADDRESS,
        NFTverseBankABI,
        await provider.getSigner()
      );
    }
  }

  /**
   * Allows underwriting an active option
   * @param {number} optionId to underwrite
   * @param {number} value to underwrite with
   */
  async function underwriteOption(optionId: number, value: number): Promise<void> {
    // Collect contract
    const NFTverseBank = await collectNFTverseBankContract();

    // Force contract != undefined
    if (NFTverseBank) {
      // Collect option
      const option: any = await NFTverseBank.nftverseOptions(optionId);

      let underWriteAmount: BigNumber;
      // If this is the first bid
      if (option.firstBidTime == 0) {
        // Run simple calculation
        underWriteAmount = ethers.utils.parseEther(value.toString());
      } else {
        // Required repayment
        const premium = await NFTverseBank.calculateTotalPremium(optionId, 120);
        // Else add new value
        underWriteAmount = ethers.utils
          .parseEther(value.toString())
          // To a 2m buffer
          .add(premium);
      }

      try {
        // Send transaction and wait
        const tx = await NFTverseBank.underwriteOption(optionId, {
          value: underWriteAmount,
          gasLimit: 150000,
        });
        await tx.wait(1);
        toast.success("Successfully underwrote NFT.");
      } catch (e) {
        // If error, alert
        console.error(e);
        toast.error(`Error when attempting to underwrite NFT.`);
      }
    }
  }

  /**
   * Allows repaying a option
   * @param {number} optionId to repay
   */
  async function repayOption(optionId: number): Promise<void> {
    // Collect contract
    const NFTverseBank = await collectNFTverseBankContract();

    // Force contract != undefined
    if (NFTverseBank) {
      // Calculate required payment (2m in future to account for inclusion time)
      const contractRequired = await NFTverseBank.calculateRequiredRepayment(
        optionId,
        120
      );

      try {
        // Send transaction and alert success
        const tx = await NFTverseBank.repayOption(optionId, {
          value: contractRequired,
          gasLimit: 300000,
        });
        await tx.wait(1);
        toast.success("Successfully repaid option.");
      } catch (e) {
        // If error, alert
        console.error(e);
        toast.error(`Error when attempting to repay option ${optionId}.`);
      }
    }
  }

  /**
   * Allows seizing NFT collateral from an expired option
   * @param {number} optionId to seize
   */
  async function seizeOption(optionId: number): Promise<void> {
    // Collect contract
    const NFTverseBank = await collectNFTverseBankContract();

    // Enforce contract != undefined
    if (NFTverseBank) {
      try {
        // Send seize transaction and wait for success
        const tx = await NFTverseBank.seizeNFT(optionId, { gasLimit: 120000 });
        await tx.wait(1);
        toast.success("Successfully seized NFT from option.");
      } catch (e) {
        // If erorr, alert failure
        console.error(e);
        toast.error(`Error when attempting to seize NFT from option ${optionId}.`);
      }
    }
  }

  /**
   * Draw option (as owner)
   * @param {number} optionId to draw from
   */
  async function drawOption(optionId: number): Promise<void> {
    // Collect contract
    const NFTverseBank = await collectNFTverseBankContract();

    // Enforce contract != undefined
    if (NFTverseBank) {
      try {
        // Send transaction and await success
        const tx = await NFTverseBank.drawOption(optionId, { gasLimit: 75000 });
        await tx.wait(1);
        toast.success("Successfully drew from option.");
      } catch (e) {
        // If error, alert
        console.error(e);
        toast.error(`Error when attempting to draw from option ${optionId}.`);
      }
    }
  }

  /**
   * Allows owner to cancel option
   * @param {number} optionId to cancel
   */
  async function cancelOption(optionId: number): Promise<void> {
    // Collect contract
    const NFTverseBank = await collectNFTverseBankContract();

    // Enforce contract != undefined
    if (NFTverseBank) {
      try {
        // Send tranaction and await success
        const tx = await NFTverseBank.cancelOption(optionId, { gasLimit: 75000 });
        await tx.wait(1);
        toast.success("Successfully cancelled option.");
      } catch (e) {
        // If error, alert
        console.error(e);
        toast.error(`Error when attempting to cancel option ${optionId}.`);
      }
    }
  }

  /**
   * Create NFTverseBank option
   * @param {string} contract address for NFT
   * @param {string} id NFT id
   * @param {number} rate premium rate
   * @param {number} amount bid ceiling
   * @param {number} completion timestamp of completion
   * @param {Record<string, string>} metadata temporary redis bypass for OpenSea
   * @returns {Promise<number | undefined>} option id
   */
  async function createOption(
    contract: string,
    id: string,
    rate: number,
    amount: number,
    completion: number,
    metadata: Record<string, string>
  ): Promise<number | undefined> {
    const nft = await collectERC721Contract(contract);
    const NFTverseBank = await collectNFTverseBankContract();

    // Ensure !undefined
    if (nft && NFTverseBank) {
      // FIXME: Temporary opensea bypass, post metadata to Redis
      await axios.post("/api/metadata", {
        tokenAddress: contract,
        tokenId: id,
        ...metadata,
      });

      // Force approve NFT
      const tx = await nft.approve(NFTVERSE_BANK_ADDRESS, id, { gasLimit: 50000 });
      await tx.wait(1);

      // Create option
      const nftverse = await NFTverseBank.createOption(
        contract,
        id,
        rate,
        ethers.utils.parseEther(amount.toString()),
        Math.round(completion / 1000),
        { gasLimit: 350000 }
      );
      // Collect Option Creation event
      const confirmed_tx = await nftverse.wait(1);
      const creation_event = confirmed_tx.events.filter(
        (event) => event && "event" in event && event.event === "OptionCreated"
      )[0];
      // Return option id
      return creation_event.args[0].toString();
    }
  }

  return {
    createOption,
    drawOption,
    seizeOption,
    cancelOption,
    underwriteOption,
    repayOption,
  };
}

// Create unstated-next container
export const option = createContainer(useOption);
