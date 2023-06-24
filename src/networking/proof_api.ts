import axios, { AxiosResponse } from 'axios'
import { kTribesHTTPAPI } from '../shared/constants'
import { JWT } from './account_api'
import { EthWalletAddress, Message } from '../shared/types'
import { isNull } from '../shared/functions'

async function getProofs(
  channelId: string,
  limit: number,
  cursor?: string,
): Promise<any> {
  const body: any = {
    channelId: channelId,
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
  channelId: string,
  limit: number,
  cursor?: string
): Promise<{ messages: Message[], cursor?: string }> {
  const result = await getProofs(channelId, limit, cursor)
  return {
    messages: result.proofs.map(parseUserMessage),
    cursor: result.cursor
  }
}

export const ProofAPI = {
  getProofs,
  getMessages
}