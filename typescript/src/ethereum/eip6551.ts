import { ethers } from 'ethers'
import { EthNFTAddress, EthWalletAddress } from '../shared/types'
import { Eth } from './eth'

async function getAccountAddress(
  eip6651: EthNFTAddress
): Promise<EthWalletAddress> {
  const { chainId, tokenId, contractAddress } = eip6651

  const contractABI = [
    'function account(address implementation, uint256 chainId, address tokenContract,' +
    ' uint256 tokenId, uint256 salt) external view returns (address)'
  ]

  const provider = Eth.getRpcProvider(chainId)
  const contract = new ethers.Contract(
    '0x02101dfB77FDE026414827Fdc604ddAF224F0921',
    contractABI,
    provider
  )

  try {
    const accountAddress = await contract.account(
      '0x2d25602551487c3f3354dd80d76d54383a243358',
      chainId,
      contractAddress.value,
      tokenId,
      0
    )
    return new EthWalletAddress(accountAddress)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const EIP6551 = {
  getAccountAddress
}
