
export interface Message {
  id: string
  author: EthWalletAddress
  content: string
  timestamp: number // epoch
  channelId: ChannelId
  sequence: number
}

import { ethers } from 'ethers'
import { Secp256k1PublicKey } from '../cryptography/secp256k1'

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

export class ChannelId {
  readonly raw: string
  readonly root: string

  constructor(raw: string) {
    this.raw = raw
    this.root = raw.split('/')[0]
  }

  static direct(user1: EthWalletAddress, user2: EthWalletAddress): ChannelId {
    const raw = `direct:${[user1.value, user2.value].sort().join('_')}`
    return new ChannelId(raw)
  }

  toMessageChannelId(): ChannelId {
    return new ChannelId([this.root, 'message'].join('/'))
  }

  toReactionChannelId(messageId: string): ChannelId {
    return new ChannelId([this.root, messageId, 'reaction'].join('/'))
  }

  toTipChannelId(messageId: string): ChannelId {
    return new ChannelId([this.root, messageId, 'tip'].join('/'))
  }
}

export interface ProofRequest {
  author: EthWalletAddress
  channelId: string
  data: string
  device: Secp256k1PublicKey
  signature: string
  clientTimestamp: number
  ownershipId: string
}