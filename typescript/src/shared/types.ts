
export interface Message {
  id: string
  author: EthWalletAddress
  content: string
  timestamp: number // epoch
  channelId: ChannelId
  sequence: number
}

export function asMessage(obj: any): Message {
  if (isNull(obj)) throw new Error('Message is null')

  return {
    id: obj['id'],
    author: new EthWalletAddress(obj['author']),
    content: obj['content'],
    timestamp: obj['timestamp'],
    channelId: new ChannelId(obj['channelId']),
    sequence: asNumber(obj['sequence'])
  }
}

export function proofToMessage(json: any): Message | undefined {
  try {
    const data = JSON.parse(json.data)
    if (data.action === 1 && data.type === 'message' && !isNull(data.model?.body)) {
      return {
        id: json.id,
        content: data.model.body,
        channelId: new ChannelId(json.channelId),
        author: new EthWalletAddress(json.author),
        timestamp: json.serverTimestamp,
        sequence: asNumber(json.sequence)
      }
    }
  } catch (e: any) {
    console.log(`Error parsing message: ${e.message}`, e)
    return undefined
  }
}


import { ethers } from 'ethers'
import { Secp256k1PublicKey } from '../cryptography/secp256k1'
import { asNumber, isNull } from './functions'

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

  toJSON(): string {
    return this.raw
  }

  toString(): string {
    return this.raw
  }

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