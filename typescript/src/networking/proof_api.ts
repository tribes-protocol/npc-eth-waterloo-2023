import axios, { AxiosResponse } from 'axios'
import BN from 'bn.js'
import { ec as EC } from 'elliptic'
import { ethers } from 'ethers'
import { Secp256k1, Secp256k1PublicKey } from '../cryptography/secp256k1'
import { kTribesHTTPAPI } from '../shared/constants'
import { compactMap, toJsonTree } from '../shared/functions'
import { NPC } from '../shared/npc'
import { ChannelId, EthChain, EthWalletAddress, Message, ProofRequest, proofToMessage } from '../shared/types'
import { JWT } from './account_api'
import { getOwnershipId } from './ownership'

async function getProofs(
  channelId: ChannelId,
  limit: number,
  cursor?: string,
): Promise<any> {
  const body: any = {
    channelId: channelId.raw,
    limit: limit
  }

  if (cursor) {
    body['cursor'] = cursor
  }

  let response: AxiosResponse<any>
  try {
    response = await axios.post<any>(
      `${kTribesHTTPAPI}/get_proofs`,
      body,
      { headers: { Authorization: `Bearer ${JWT.value()}` } }
    )
  } catch (error) {
    console.error('Error in getProofs:', error)
    throw new Error('Failed to get proofs')
  }

  if (!response.data) {
    throw new Error('Failed to get proofs')
  }

  return response.data
}


async function getMessages(
  channelId: ChannelId,
  limit: number,
  cursor?: string
): Promise<{ messages: Message[], cursor?: string }> {
  const result = await getProofs(channelId, limit, cursor)
  return {
    messages: result.proofs.map(proofToMessage),
    cursor: result.cursor
  }
}

function signProofRequest(request: ProofRequest, keyPair: EC.KeyPair): ProofRequest {
  const messageDigest = proofDigest(request)
  const signature = Secp256k1.signMessage(messageDigest, keyPair)
  return { ...request, signature }
}

function proofDigest(request: ProofRequest): string {
  const { channelId, author, data, clientTimestamp, ownershipId } = request
  return compactMap(
    [channelId, author.value, data, clientTimestamp.toString(), ownershipId]
  ).join(':')
}


async function pushProof(npc: NPC, channelId: ChannelId, data: any): Promise<string> {
  const ownershipId = await getOwnershipId(channelId)
  const devicePubKey = Secp256k1PublicKey.fromEcKeyPair(npc.device)

  const proof: ProofRequest = {
    author: npc.account,
    channelId: channelId.raw,
    data: JSON.stringify(data),
    device: devicePubKey,
    signature: '',
    clientTimestamp: Date.now(),
    ownershipId
  }

  const signedProof = signProofRequest(proof, npc.device)

  const body = {
    author: signedProof.author.value,
    channelId: signedProof.channelId,
    data: signedProof.data,
    device: signedProof.device.value,
    signature: signedProof.signature,
    clientTimestamp: signedProof.clientTimestamp,
    ownershipId: signedProof.ownershipId
  }

  let response: AxiosResponse<any>
  try {
    response = await axios.post<any>(
      `${kTribesHTTPAPI}/push_proof`,
      body,
      {
        headers: { Authorization: `Bearer ${JWT.value()}` }
      }
    )

    return response.data.id
  } catch (error: any) {
    console.error(`Error in sendMessage: ${error.message}`, error)
    throw new Error('Failed to sendMessage')
  }
}


async function addReaction(
  npc: NPC,
  value: string,
  messageId: string,
  channelId: ChannelId
): Promise<void> {
  if (value.trim().length === 0) {
    return
  }
  await pushProof(
    npc,
    channelId.toReactionChannelId(messageId),
    { action: 1, type: 'reaction', model: { value, messageId } }
  )
}

function generateDataForERC20Transfer({
  erc20,
  to,
  amount
}: {
  erc20: {
    chainId: EthChain
    contractAddress: EthWalletAddress
  }
  to: EthWalletAddress
  amount: BN
}): string {
  const abi = ['function transfer(address recipient, uint256 amount)']

  const contract = new ethers.Contract(
    erc20.contractAddress.value,
    abi
  )

  const data = contract.interface.encodeFunctionData('transfer', [
    to.value,
    amount.toString()
  ])

  return data
}

interface ERC20AssetId {
  chainId: EthChain
  address: EthWalletAddress
  type: 'erc20'
}

interface TipDTO {
  assetId: ERC20AssetId
  amount: string
  to: EthWalletAddress
  from: EthWalletAddress
  txHash: string
  messageId: string
}

async function sendTip(
  npc: NPC,
  messageId: string,
  channelId: ChannelId,
  to: EthWalletAddress,
  from: EthWalletAddress,
  message?: string
) {
  const assetId: ERC20AssetId = {
    chainId: EthChain.ethereum,
    address: new EthWalletAddress('0x8Ae452D9F8F08F21FF81c94260Cb85302a31Ac30'),
    type: 'erc20'
  }

  const data = generateDataForERC20Transfer(
    {
      erc20: {
        chainId: assetId.chainId,
        contractAddress: assetId.address
      },
      to,
      amount: new BN('1000000000000000000')
    }
  )

  const abi = [
    'function executeCall(address to, uint256 value, bytes data) payable returns (bytes)'
  ]
  const eip6551 = new ethers.Contract(npc.account.value, abi, npc.wallet)
  const response = await eip6551.executeCall(assetId.address.value, '0', data)

  const tip: TipDTO = {
    assetId,
    amount: '1000000000000000000',
    to,
    from,
    messageId,
    txHash: response.hash
  }
  await pushProof(
    npc,
    channelId.toTipChannelId(messageId),
    { action: 1, type: 'tip', model: toJsonTree(tip) }
  )

  if (message) {
    await sendMessage(npc, message, channelId, messageId)
  }
}

async function sendMessage(
  npc: NPC,
  text: string,
  channelId: ChannelId,
  replyMessageId?: string
): Promise<string> {
  const model: any = { body: text }
  const dto: any = { action: 1, type: 'message', model }
  if (replyMessageId) {
    dto.model.replyMessageId = replyMessageId
  }
  return pushProof(
    npc,
    channelId.toMessageChannelId(),
    dto
  )
}


export const ProofAPI = {
  getProofs,
  getMessages,
  sendMessage,
  addReaction,
  sendTip,
}