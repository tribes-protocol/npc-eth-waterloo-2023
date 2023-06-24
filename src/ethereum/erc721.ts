import { ethers } from "ethers"
import { EthNFTAddress, EthWalletAddress } from "../shared/types"
import { Eth } from "./eth"

async function getOwner(
  address: EthNFTAddress
): Promise<EthWalletAddress> {
  const contractABI = [
    // ERC721
    'function ownerOf(uint256 tokenId) external view returns (address)'
  ]

  const provider = Eth.getRpcProvider(address.chainId)
  const contract = new ethers.Contract(address.contractAddress.value, contractABI, provider)

  const owner = await contract.ownerOf(address.tokenId)

  return new EthWalletAddress(owner)
}

export const ERC721 = {
  getOwner,
}