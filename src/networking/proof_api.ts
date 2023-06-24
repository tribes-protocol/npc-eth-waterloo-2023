import axios, { AxiosResponse } from 'axios'
import { ec as EC } from 'elliptic'
import { Secp256k1, Secp256k1PublicKey } from '../cryptography/secp256k1'
import { kTribesHTTPAPI } from '../shared/constants'
import { compactMap, isNull } from '../shared/functions'
import { NPC } from '../shared/npc'
import { ChannelId, Message, ProofRequest } from '../shared/types'
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

function parseUserMessage(json: any): Message | undefined {
  try {
    const data = JSON.parse(json.data)
    if (data.action === 1 && data.type === 'message' && !isNull(data.model?.body)) {
      return {
        id: json.id,
        content: data.model.body,
        channelId: json.channelId,
        author: json.author,
        timestamp: json.serverTimestamp,
      }
    }
  } catch (e: any) {
    console.log(`Error parsing message: ${e.message}`, e)
    return undefined
  }
}

async function getMessages(
  channelId: ChannelId,
  limit: number,
  cursor?: string
): Promise<{ messages: Message[], cursor?: string }> {
  const result = await getProofs(channelId, limit, cursor)
  return {
    messages: result.proofs.map(parseUserMessage),
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

export async function sendMessage(
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
}