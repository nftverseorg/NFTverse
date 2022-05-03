# NFTverse [Contracts]

`NFTverseBank.sol` issues NFTverseOptions that track all details about an individual options. Users can `createOption`, `underwriteOption`, `drawOption`, `repayOption`, `cancelOption`, or `seizeNFT`.

Dependencies: [ABDKMath64x64](https://github.com/abdk-consulting/abdk-libraries-solidity/blob/master/ABDKMath64x64.sol), [OpenZeppelin IERC721](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC721/IERC721.sol)

## Run locally

```bash
# Install dependencies
npm install

# Optional: compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy contracts to Rinkeby
npx hardhat run scripts/deploy.ts --network rinkeby
```

Note: Tests don't check premium rate calculations implied in `calculateTotalPremium`.
