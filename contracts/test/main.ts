import { expect } from "chai"; // Testing
import { BigNumber, Contract, Signer, Transaction } from "ethers"; // Ethers
import { SquigglesABI } from "./abi/squiggles"; // ABI
import { ethers, waffle, network } from "hardhat"; // Hardhat

// Setup test Chromie Squiggle NFT
const SQUIGGLE_0: number = 0;

// Setup addresses
const ADDRESSES: Record<string, string> = {
  // Snowfro w/ Chromie Squiggle #0
  SNOWFRO: "0xf3860788D1597cecF938424bAABe976FaC87dC26",
  // Chromie Squiggles
  SQUIGGLE: "0x059EDD72Cd353dF5106D2B9cC5ab83a52287aC3a",
  // Binance
  OPTIONSELLER_ONE: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8",
  // Kraken
  OPTIONSELLER_TWO: "0x53d284357ec70cE289D6D64134DfAc8E511c8a3D",
  // Zero address
  ZERO: "0x0000000000000000000000000000000000000000",
};

// Potential revert error messages
const ERROR_MESSAGES: Record<string, Record<string, string>> = {
  CREATE: {
    NO_EXPIRED_OPTION: "Can't create options in past",
  },
  UNDERWRITE: {
    NO_0_UNDERWRITE: "Can't underwrite with 0 Ether.",
    OVER_MAX_UNDERWRITE: "Can't underwrite > max options.",
    INSUFFICIENT_BID: "Can't underwrite < top optionSeller.",
    ALREADY_REPAID: "Can't underwrite a repaid options.",
    EXPIRED: "Can't underwrite expired options.",
  },
  DRAW: {
    MAX_CAPACITY: "Max draw capacity reached.",
    NOT_OWNER: "Must be NFT owner to draw.",
  },
  REPAY: {
    NO_BIDS: "Can't repay options with 0 bids.",
    EXPIRED: "Can't repay expired options.",
    ALREADY_REPAID: "Can't repay paid options.",
  },
  CANCEL: {
    NON_ZERO_BIDS: "Can't cancel options with >0 bids.",
    NOT_OWNER: "Must be NFT owner to cancel.",
  },
  SEIZE: {
    NOT_EXPIRED: "Can't seize before expiry.",
    ALREADY_REPAID: "Can't seize from repaid options.",
  },
};

// Setup global contracts
let NFTverseBankContract: Contract;
let NFTverseBankContractAddress: string;

/**
 * Returns impersonated signer
 * @param {string} account to impersonate
 * @returns {Signer} authenticated as account
 */
async function impersonateSigner(account: string): Promise<Signer> {
  // Impersonate account
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [account],
  });

  // Return ethers signer
  return await ethers.provider.getSigner(account);
}

/**
 * Deploys contracts via OptionSeller one wallet funds and stores details globally
 */
async function deploy(): Promise<void> {
  // Impersonate Binance (OptionSeller One)
  const binanceSigner: Signer = await impersonateSigner(ADDRESSES.OPTIONSELLER_ONE);

  // Deploy NFTverseBank contracts
  const NFTverseBank = await ethers.getContractFactory("NFTverseBank");
  const contractWithSigner = NFTverseBank.connect(binanceSigner);
  const contract = await contractWithSigner.deploy();
  await contract.deployed();

  // Store contract details to global variables
  NFTverseBankContract = contract;
  NFTverseBankContractAddress = contract.address.toString();
}

/**
 * Collects Squiggles NFT contract connected to signer
 * @param {string} address of signer
 * @returns {Promise<Contract>} Squiggles NFT contract
 */
async function getSquigglesContract(address: string): Promise<Contract> {
  // Collect signer by address
  const signer = await impersonateSigner(address);
  // Return new contract w/ signer
  return new ethers.Contract(ADDRESSES.SQUIGGLE, SquigglesABI, signer);
}

/**
 * Scaffolds initial 1h options
 */
async function scaffoldOption(): Promise<void> {
  const { SnowfroBank } = await impersonateBanks();

  // Approve NFT for transfer
  const SquigglesContract = await getSquigglesContract(ADDRESSES.SNOWFRO);
  await SquigglesContract.approve(NFTverseBankContractAddress, SQUIGGLE_0);

  // Create options w/ Chrome Squiggle #0
  await SnowfroBank.createOption(
    // Token address
    ADDRESSES.SQUIGGLE,
    // Token ID
    SQUIGGLE_0,
    // Premium rate
    5,
    // Max options amount
    ethers.utils.parseEther("10"),
    // options completion time (in 1 hour from forking block)
    1626808526
  );
}

/**
 * Impersonates three actors and provides connected contracts
 * @returns {Promise<Record<string, Contract>>} actor: connected contract
 */
async function impersonateBanks(): Promise<Record<string, Contract>> {
  // Snowfro.eth
  const SnowfroSigner = await impersonateSigner(ADDRESSES.SNOWFRO);
  const SnowfroBank: Contract = NFTverseBankContract.connect(SnowfroSigner);

  // OptionSeller One
  const OptionSellerOneSigner = await impersonateSigner(ADDRESSES.OPTIONSELLER_ONE);
  const OptionSellerOneBank: Contract = NFTverseBankContract.connect(OptionSellerOneSigner);

  // OptionSeller Two
  const OptionSellerTwoSigner = await impersonateSigner(ADDRESSES.OPTIONSELLER_TWO);
  const OptionSellerTwoBank: Contract = NFTverseBankContract.connect(OptionSellerTwoSigner);

  // Return available connected contracts
  return { SnowfroBank, OptionSellerOneBank, OptionSellerTwoBank };
}

describe("NFTverseBank", () => {
  // Pre-setup
  beforeEach(async () => {
    // Reset hardhat forknet
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
            blockNumber: 12864983,
          },
        },
      ],
    });

    // Deploy contract
    await deploy();

    // Scaffold initial options
    await scaffoldOption();
  });

  describe("options creation", () => {
    it("Should allow creating a options", async () => {
      // Collect details
      const SquigglesContract: Contract = await getSquigglesContract(ADDRESSES.SNOWFRO);
      const SquiggleOwner: string = await SquigglesContract.ownerOf(SQUIGGLE_0);
      const SquiggleOGOwner: string = (await NFTverseBankContract.nftverseOptions(1)).tokenOwner;

      // Verify that contract holds NFT
      expect(SquiggleOwner).to.equal(NFTverseBankContractAddress);
      // Verify that NFTverseOption is created with correct owner
      expect(SquiggleOGOwner).to.equal(ADDRESSES.SNOWFRO);
    });

    it("Should prevent creating a options in the past", async () => {
      const { SnowfroBank } = await impersonateBanks();

      // Force delete scaffold options
      await SnowfroBank.cancelOption(1);

      // Approve NFT for transfer
      const SquigglesContract: Contract = await getSquigglesContract(ADDRESSES.SNOWFRO);
      await SquigglesContract.approve(NFTverseBankContractAddress, SQUIGGLE_0);

      // Create options w/ Chrome Squiggle #0 in past
      const tx: Transaction = SnowfroBank.createOption(
        // Token address
        ADDRESSES.SQUIGGLE,
        // Token ID
        SQUIGGLE_0,
        // Premium rate
        5,
        // Max options amount
        ethers.utils.parseEther("10"),
        // options completion time (5 years ago)
        Math.floor(Date.now() / 1000) - 157680000
      );

      // Expect tx to revert because options completion time < current time
      await expect(tx).revertedWith(ERROR_MESSAGES.CREATE.NO_EXPIRED_OPTION);
    });
  });

  describe("options underwriting", () => {
    it("Should allow underwriting a new options", async () => {
      const { OptionSellerOneBank } = await impersonateBanks();

      // Back options with 1 ETH
      await OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("1.0"),
      });

      // Collect details
      const NFTverseBankBalance: BigNumber = await waffle.provider.getBalance(NFTverseBankContractAddress);
      const NFTverseOptionDetails = await OptionSellerOneBank.nftverseOptions(1);

      // Verify contract balance is increased
      expect(NFTverseBankBalance.toString()).to.equal("1000000000000000000");
      // Verify options has 1 ether available to draw
      expect(NFTverseOptionDetails.optionAmount.toString()).to.equal("1000000000000000000");
      // Verify options has 0 capital drawn
      expect(NFTverseOptionDetails.optionAmountDrawn.toString()).to.equal("0");
      // Verify new optionSeller is OptionSeller One
      expect(NFTverseOptionDetails.optionSeller).to.equal(ADDRESSES.OPTIONSELLER_ONE);
    });

    it("Should prevent underwriting a new options with 0 Ether", async () => {
      const { OptionSellerOneBank } = await impersonateBanks();

      // Back options with 0 ETH
      const tx: Transaction = OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("0.0"),
      });

      // Expect tx to fail
      await expect(tx).revertedWith(ERROR_MESSAGES.UNDERWRITE.NO_0_UNDERWRITE);
    });

    it("Should prevent underwriting a repaid options", async () => {
      const { SnowfroBank, OptionSellerOneBank } = await impersonateBanks();

      // Back options with 1 ETH
      await OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("1.0"),
      });

      // Draw and repay options
      await SnowfroBank.drawOption(1);
      const repaymentAmount: BigNumber = await SnowfroBank.calculateRequiredRepayment(1, 0);
      await SnowfroBank.repayOption(1, { value: repaymentAmount.mul(101).div(100) });

      // Attempt to re-underwrite options
      const tx: Transaction = OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("1.1"),
      });

      // Expect revert
      await expect(tx).revertedWith(ERROR_MESSAGES.UNDERWRITE.ALREADY_REPAID);
    });

    it("Should prevent underwriting an expired options", async () => {
      const { OptionSellerOneBank } = await impersonateBanks();

      // Fast forward >1h
      await network.provider.send("evm_increaseTime", [3601]);
      await network.provider.send("evm_mine");

      // Back options with 1 ETH
      const tx: Transaction = OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("1.0"),
      });

      // Expect revert
      await expect(tx).revertedWith(ERROR_MESSAGES.UNDERWRITE.EXPIRED);
    });

    it("Should prevent underwriting a options under the current top bid", async () => {
      const { OptionSellerOneBank, OptionSellerTwoBank } = await impersonateBanks();

      // Back options with 1 ETH
      await OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("1.0"),
      });

      // Back options with <1 ETH
      const tx: Transaction = OptionSellerTwoBank.underwriteOption(1, {
        value: ethers.utils.parseEther("0.5"),
      });

      // Expect revert
      await expect(tx).revertedWith(ERROR_MESSAGES.UNDERWRITE.INSUFFICIENT_BID);
    });

    it("Should prevent underwriting a options over the maxOptionAmount", async () => {
      const { OptionSellerOneBank } = await impersonateBanks();

      // Back options with 11 ETH
      const tx: Transaction = OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("11.0"),
      });

      // Expect tx to fail
      await expect(tx).revertedWith(ERROR_MESSAGES.UNDERWRITE.OVER_MAX_UNDERWRITE);
    });

    it("Should allow underwriting a options with existing bid", async () => {
      const { OptionSellerOneBank, OptionSellerTwoBank } = await impersonateBanks();

      // First optionSeller balance
      const previousBalance: BigNumber = await waffle.provider.getBalance(ADDRESSES.OPTIONSELLER_ONE);

      // Back options with 5 ETH
      const tx = await OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("5.0"),
      });
      const receipt = await waffle.provider.getTransactionReceipt(tx.hash);

      // Back options with 6 ETH
      const totalPremium: BigNumber = await OptionSellerTwoBank.calculateTotalPremium(1, 1);
      const higherOption: BigNumber = ethers.utils.parseEther("6.0").add(totalPremium);
      await OptionSellerTwoBank.underwriteOption(1, { value: higherOption });

      // Collect details
      const NewTopOptionSeller: string = (await OptionSellerTwoBank.nftverseOptions(1)).optionSeller;
      const expectedOptionSellerOneBalance: BigNumber = previousBalance
        .sub(tx.gasPrice.mul(receipt.cumulativeGasUsed))
        .add(totalPremium);
      const acutalOptionSellerOneBalance: BigNumber = await waffle.provider.getBalance(
        ADDRESSES.OPTIONSELLER_ONE
      );

      // Verify first optionSeller received principle + premium
      expect(acutalOptionSellerOneBalance).to.be.gte(expectedOptionSellerOneBalance);
      // Verify second optionSeller is now top bidder
      expect(NewTopOptionSeller).to.equal(ADDRESSES.OPTIONSELLER_TWO);
    });
  });

  describe("options drawing", () => {
    it("Should allow drawing from a options", async () => {
      const { OptionSellerOneBank, SnowfroBank } = await impersonateBanks();

      // Back options with 5 ETH
      await OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("5.0"),
      });

      // Collect previous Snowfro balance
      const previousBalance: BigNumber = await waffle.provider.getBalance(ADDRESSES.SNOWFRO);

      // Draw 5ETH
      const tx = await SnowfroBank.drawOption(1);
      const receipt = await waffle.provider.getTransactionReceipt(tx.hash);

      // Collect after Snowfro balance
      const afterBalance: BigNumber = await waffle.provider.getBalance(ADDRESSES.SNOWFRO);
      const expectedAfterBalance: BigNumber = previousBalance
        .sub(tx.gasPrice.mul(receipt.cumulativeGasUsed))
        .add(ethers.utils.parseEther("5.0"));

      expect(afterBalance).to.equal(expectedAfterBalance);
    });

    it("Should allow drawing additional capital from a new bid", async () => {
      const { OptionSellerOneBank, OptionSellerTwoBank, SnowfroBank } = await impersonateBanks();

      // Back options with 5 ETH
      await OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("5.0"),
      });

      // Collect previous Snowfro balance
      const previousBalance: BigNumber = await waffle.provider.getBalance(ADDRESSES.SNOWFRO);

      // Draw 5ETH
      const tx = await SnowfroBank.drawOption(1);
      const receipt = await waffle.provider.getTransactionReceipt(tx.hash);

      // Check for Snowfro balance increment
      const afterBalance: BigNumber = await waffle.provider.getBalance(ADDRESSES.SNOWFRO);
      const expectedAfterBalance: BigNumber = previousBalance
        .sub(tx.gasPrice.mul(receipt.cumulativeGasUsed))
        .add(ethers.utils.parseEther("5.0"));
      expect(afterBalance).to.equal(expectedAfterBalance);

      // Back options with 6 ETH
      const totalPremium: BigNumber = await OptionSellerTwoBank.calculateTotalPremium(1, 5);
      const higherOption: BigNumber = ethers.utils.parseEther("6.0").add(totalPremium);
      await OptionSellerTwoBank.underwriteOption(1, { value: higherOption });

      // Draw 6ETH
      const tx2 = await SnowfroBank.drawOption(1);
      const receipt2 = await waffle.provider.getTransactionReceipt(tx2.hash);

      // Check for Snowfro balance increment
      const afterBalance2: BigNumber = await waffle.provider.getBalance(ADDRESSES.SNOWFRO);
      const expectedAfterBalance2: BigNumber = afterBalance
        .sub(tx2.gasPrice.mul(receipt2.cumulativeGasUsed))
        .add(ethers.utils.parseEther("1.0"));

      expect(afterBalance2).to.be.gte(expectedAfterBalance2);
    });

    it("Should prevent drawing from a options with no bids", async () => {
      const { SnowfroBank } = await impersonateBanks();

      // Attempt to draw ETH
      const tx: Transaction = SnowfroBank.drawOption(1);

      // Expect revert
      await expect(tx).revertedWith(ERROR_MESSAGES.DRAW.MAX_CAPACITY);
    });

    it("Should prevent non-owners from drawing from options", async () => {
      const { OptionSellerOneBank } = await impersonateBanks();

      // Back options with 5 ETH
      await OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("5.0"),
      });

      // Attempt to collect options as OptionSeller
      const tx: Transaction = OptionSellerOneBank.drawOption(1);

      // Expect revert
      await expect(tx).revertedWith(ERROR_MESSAGES.DRAW.NOT_OWNER);
    });

    it("Should prevent consecutive draws from a options", async () => {
      const { OptionSellerOneBank, SnowfroBank } = await impersonateBanks();

      // Back options with 5 ETH
      await OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("5.0"),
      });

      // Draw 5ETH
      await SnowfroBank.drawOption(1);
      // Attempt to redraw
      const tx: Transaction = SnowfroBank.drawOption(1);

      await expect(tx).revertedWith(ERROR_MESSAGES.DRAW.MAX_CAPACITY);
    });

    it("Should allow drawing options after NFT seizure", async () => {
      const { OptionSellerOneBank, SnowfroBank } = await impersonateBanks();

      // Back options with 1 ETH
      await OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("5.0"),
      });

      // Fast forward >1h
      await network.provider.send("evm_increaseTime", [3601]);
      await network.provider.send("evm_mine");

      // Seize NFT
      await OptionSellerOneBank.seizeNFT(1);

      // Collect previous Snowfro balance
      const previousBalance: BigNumber = await waffle.provider.getBalance(ADDRESSES.SNOWFRO);

      // Draw 5ETH
      const tx = await SnowfroBank.drawOption(1);
      const receipt = await waffle.provider.getTransactionReceipt(tx.hash);

      // Collect after Snowfro balance
      const afterBalance: BigNumber = await waffle.provider.getBalance(ADDRESSES.SNOWFRO);
      const expectedAfterBalance: BigNumber = previousBalance
        .sub(tx.gasPrice.mul(receipt.cumulativeGasUsed))
        .add(ethers.utils.parseEther("5.0"));

      // Expect increase in balance
      expect(afterBalance).to.equal(expectedAfterBalance);
    });
  });

  describe("options repayment", () => {
    it("Should allow repaying options", async () => {
      const { OptionSellerOneBank, SnowfroBank } = await impersonateBanks();

      // Back options with 5 ETH
      await OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("5.0"),
      });

      // Record OptionSeller balance
      const previousOptionSellerBalance: BigNumber = await waffle.provider.getBalance(
        ADDRESSES.OPTIONSELLER_ONE
      );

      // Fast forward <1h
      await network.provider.send("evm_increaseTime", [3500]);
      await network.provider.send("evm_mine");

      // Calculate repayment amount
      const repaymentAmount: BigNumber = await SnowfroBank.calculateRequiredRepayment(1, 0);
      const repaymentBuffer: BigNumber = repaymentAmount.mul(101).div(100);

      // Repay options
      await SnowfroBank.repayOption(1, { value: repaymentBuffer });

      // Expect options to be closed
      const NewOptionOwner: string = (await SnowfroBank.nftverseOptions(1)).tokenOwner;
      expect(NewOptionOwner).to.equal(ADDRESSES.ZERO);

      // Expect NFT to be owned by original owner
      const SquigglesContract: Contract = await getSquigglesContract(ADDRESSES.SNOWFRO);
      const SquiggleOwner: string = await SquigglesContract.ownerOf(SQUIGGLE_0);
      expect(SquiggleOwner).to.equal(ADDRESSES.SNOWFRO);

      // Expect increase in OptionSeller One balance by ~.243 ETH
      const afterOptionSellerBalance: BigNumber = await waffle.provider.getBalance(ADDRESSES.OPTIONSELLER_ONE);
      expect(afterOptionSellerBalance).to.be.gte(previousOptionSellerBalance.add(repaymentAmount));
    });

    it("Should allow repaying someone elses options", async () => {
      const { OptionSellerOneBank, OptionSellerTwoBank } = await impersonateBanks();

      // Back options with 5 ETH
      await OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("5.0"),
      });

      // Record OptionSeller balance
      const previousOptionSellerBalance: BigNumber = await waffle.provider.getBalance(
        ADDRESSES.OPTIONSELLER_ONE
      );

      // Fast forward <1h
      await network.provider.send("evm_increaseTime", [3500]);
      await network.provider.send("evm_mine");

      // Calculate repayment amount
      const repaymentAmount: BigNumber = await OptionSellerTwoBank.calculateRequiredRepayment(1, 0);
      const repaymentBuffer: BigNumber = repaymentAmount.mul(101).div(100);

      // Repay options
      await OptionSellerTwoBank.repayOption(1, { value: repaymentBuffer });

      // Expect options to be closed
      const NewOptionOwner: string = (await OptionSellerTwoBank.nftverseOptions(1)).tokenOwner;
      expect(NewOptionOwner).to.equal(ADDRESSES.ZERO);

      // Expect NFT to be owned by original owner
      const SquigglesContract: Contract = await getSquigglesContract(ADDRESSES.SNOWFRO);
      const SquiggleOwner: string = await SquigglesContract.ownerOf(SQUIGGLE_0);
      expect(SquiggleOwner).to.equal(ADDRESSES.SNOWFRO);

      // Expect increase in OptionSeller One balance by ~.243 ETH
      const afterOptionSellerBalance: BigNumber = await waffle.provider.getBalance(ADDRESSES.OPTIONSELLER_ONE);
      expect(afterOptionSellerBalance).to.be.gte(previousOptionSellerBalance.add(repaymentAmount));
    });

    it("Should prevent repaying options w/ 0 bids", async () => {
      const { SnowfroBank } = await impersonateBanks();

      // Attempt to repay options
      const tx: Transaction = SnowfroBank.repayOption(1);

      // Expect revert
      await expect(tx).revertedWith(ERROR_MESSAGES.REPAY.NO_BIDS);
    });

    it("Should prevent repaying expired options", async () => {
      const { OptionSellerOneBank, SnowfroBank } = await impersonateBanks();

      // Back options with 1 ETH
      await OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("1.0"),
      });

      // Fast forward >1h
      await network.provider.send("evm_increaseTime", [3601]);
      await network.provider.send("evm_mine");

      // Attempt to repay options
      const tx: Transaction = SnowfroBank.repayOption(1);

      // Expect revert
      await expect(tx).revertedWith(ERROR_MESSAGES.REPAY.EXPIRED);
    });

    it("Should prevent repaying paid options", async () => {
      const { OptionSellerOneBank, SnowfroBank } = await impersonateBanks();

      // Back options with 1 ETH
      await OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("1.0"),
      });

      // Fast forward <1h
      await network.provider.send("evm_increaseTime", [3500]);
      await network.provider.send("evm_mine");

      // Calculate repayment amount
      const repaymentAmount: BigNumber = await SnowfroBank.calculateRequiredRepayment(1, 0);
      const repaymentBuffer: BigNumber = repaymentAmount.mul(101).div(100);

      // Repay options
      await SnowfroBank.repayOption(1, { value: repaymentBuffer });

      // Attempt to re-repay options
      const tx: Transaction = SnowfroBank.repayOption(1);

      // Expect revert
      await expect(tx).revertedWith(ERROR_MESSAGES.REPAY.ALREADY_REPAID);
    });
  });

  describe("options cancellation", () => {
    it("Should allow cancelling options with 0 bids", async () => {
      const { SnowfroBank } = await impersonateBanks();

      // Cancel options
      await SnowfroBank.cancelOption(1);

      // Collect details
      const SquigglesContract: Contract = await getSquigglesContract(ADDRESSES.SNOWFRO);
      const SquiggleOwner: string = await SquigglesContract.ownerOf(SQUIGGLE_0);
      const NewOptionOwner: string = (await SnowfroBank.nftverseOptions(1)).tokenOwner;

      // Verify that Snowfro holds NFT
      expect(SquiggleOwner).to.equal(ADDRESSES.SNOWFRO);
      // Verify that NFTverseOption is nullifed w/ 0 address
      expect(NewOptionOwner).to.equal(ADDRESSES.ZERO);
    });

    it("Should prevent cancelling options with >0 bids", async () => {
      const { OptionSellerOneBank, SnowfroBank } = await impersonateBanks();

      // Back options with 1 ETH
      await OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("1.0"),
      });

      // Attempt to cancel options with 1.0 bid existing
      const tx: Transaction = SnowfroBank.cancelOption(1);

      // Expect revert
      await expect(tx).revertedWith(ERROR_MESSAGES.CANCEL.NON_ZERO_BIDS);
    });

    it("Should prevent cancelling options if not owner", async () => {
      const { OptionSellerOneBank } = await impersonateBanks();

      // Attempt to cancel options as OptionSeller One
      const tx: Transaction = OptionSellerOneBank.cancelOption(1);

      // Expect revert
      await expect(tx).revertedWith(ERROR_MESSAGES.CANCEL.NOT_OWNER);
    });
  });

  describe("options seizing", () => {
    it("Should allow optionSeller to seize NFT", async () => {
      const { OptionSellerOneBank } = await impersonateBanks();

      // Back options with 1 ETH
      await OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("1.0"),
      });

      // Fast forward >1h
      await network.provider.send("evm_increaseTime", [3601]);
      await network.provider.send("evm_mine");

      // Seize NFT
      await OptionSellerOneBank.seizeNFT(1);

      // Collect details
      const SquigglesContract: Contract = await getSquigglesContract(ADDRESSES.SNOWFRO);
      const SquiggleOwner: string = await SquigglesContract.ownerOf(SQUIGGLE_0);

      // Verify that OptionSeller One holds NFT
      expect(SquiggleOwner).to.equal(ADDRESSES.OPTIONSELLER_ONE);
    });

    it("Should allow anyone to seize NFT on behalf of optionSeller", async () => {
      const { OptionSellerOneBank, OptionSellerTwoBank } = await impersonateBanks();

      // Back options with 1 ETH
      await OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("1.0"),
      });

      // Fast forward >1h
      await network.provider.send("evm_increaseTime", [3601]);
      await network.provider.send("evm_mine");

      // Seize NFT
      await OptionSellerTwoBank.seizeNFT(1);

      // Collect details
      const SquigglesContract: Contract = await getSquigglesContract(ADDRESSES.SNOWFRO);
      const SquiggleOwner: string = await SquigglesContract.ownerOf(SQUIGGLE_0);

      // Verify that OptionSeller One holds NFT
      expect(SquiggleOwner).to.equal(ADDRESSES.OPTIONSELLER_ONE);
    });

    it("Should prevent seizing NFT before options expiration", async () => {
      const { OptionSellerOneBank } = await impersonateBanks();

      // Back options with 1 ETH
      await OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("1.0"),
      });

      // Seize NFT
      const tx: Transaction = OptionSellerOneBank.seizeNFT(1);

      // Expect revert
      await expect(tx).revertedWith(ERROR_MESSAGES.SEIZE.NOT_EXPIRED);
    });

    it("Should prevent seizing repaid options", async () => {
      const { OptionSellerOneBank, SnowfroBank } = await impersonateBanks();

      // Back options with 1 ETH
      await OptionSellerOneBank.underwriteOption(1, {
        value: ethers.utils.parseEther("1.0"),
      });

      // Draw and repay options
      await SnowfroBank.drawOption(1);
      const repaymentAmount: BigNumber = await SnowfroBank.calculateRequiredRepayment(1, 0);
      await SnowfroBank.repayOption(1, { value: repaymentAmount.mul(101).div(100) });

      // Seize NFT
      const tx: Transaction = OptionSellerOneBank.seizeNFT(1);

      // Expect revert
      await expect(tx).revertedWith(ERROR_MESSAGES.SEIZE.ALREADY_REPAID);
    });
  });
});
