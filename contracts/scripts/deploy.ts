import { ethers } from "hardhat"; // Hardhat

async function main(): Promise<void> {
  // Collect deployer
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy NFTverseBank
  const NFTverseBank = await ethers.getContractFactory("NFTverseBank");
  const nftversebank = await NFTverseBank.deploy();

  console.log("Deployed NFTverseBank address:", nftversebank.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
