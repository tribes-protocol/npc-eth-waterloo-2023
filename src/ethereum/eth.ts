import { ethers } from 'ethers'
import { asString } from '../shared/functions'
import { EthChain } from '../shared/types'

export const Eth = {
  getRpcProvider(chainId: EthChain): ethers.JsonRpcProvider {
    switch (chainId) {
      case EthChain.ethereum:
        return new ethers.JsonRpcProvider(asString(process.env.WEB3_PROVIDER_MAINNET))
      case EthChain.polygon:
        return new ethers.JsonRpcProvider(asString(process.env.WEB3_PROVIDER_POLYGON))
    }
  },

  async getBlockNumber(chainId: EthChain): Promise<number> {
    return Eth.getRpcProvider(chainId).getBlockNumber()
  }
}
