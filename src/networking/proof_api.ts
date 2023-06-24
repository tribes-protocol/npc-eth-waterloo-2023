import axios, { AxiosResponse } from 'axios'
import { kTribesHTTPAPI } from '../shared/constants'
import { JWT } from './account_api'

async function getProofs(
  channelId: string,
  limit: number,
  cursor?: string
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

  return { ownershipId: response.data.ownershipId }
}

export const ProofAPI = {
  getProofs
}