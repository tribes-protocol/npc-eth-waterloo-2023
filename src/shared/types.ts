
export interface Message {
  id: string
  author: string
  content: string
  timestamp: number // epoch
  channelId: string
}

import { ethers } from 'ethers'

export function prepend0x(hex: string) {
  return hex.replace(/^(0x)?/i, '0x')
}

export class EthWalletAddress {
  private value_: string

  constructor(value: string) {
    if (!ethers.isAddress(value)) throw new Error(`Invalid ETH wallet address: ${value}`)

    this.value_ = prepend0x(value.toLowerCase())
  }

  get prefix(): string {
    return this.value.slice(0, 9)
  }

  get value(): string {
    return this.value_
  }

  toJSON() {
    return this.value
  }

  toString() {
    return this.value
  }
}

export enum EthChain {
  ethereum = 1,
  polygon = 137,
}


export interface EthNFTAddress {
  chainId: number,
  contractAddress: EthWalletAddress,
  tokenId: string,
}

export interface MessageToSignResponseEIP6551 {
  account: EthWalletAddress
  owner: EthWalletAddress
  type: 'eip6551'
  message: string
}