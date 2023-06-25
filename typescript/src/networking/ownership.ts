
import axios, { AxiosResponse } from 'axios'
import { Eth } from '../ethereum/eth'
import { kTribesHTTPAPI } from '../shared/constants'
import { asNumber } from '../shared/functions'
import { ChannelId } from '../shared/types'
import { JWT } from './account_api'

interface GetOwnersResponse {
  ownershipId: string
}

export async function getOwners(channelId: string): Promise<GetOwnersResponse> {
  const body = {
    channelId: channelId
  }

  let response: AxiosResponse<GetOwnersResponse>
  try {
    response = await axios.post<GetOwnersResponse>(
      `${kTribesHTTPAPI}/get_owners`,
      body,
      {
        headers: { Authorization: `Bearer ${JWT.value()}` }
      }
    )
  } catch (error) {
    console.error('Error in getOwners:', error)
    throw new Error('Failed to get owners')
  }

  if (!response.data) {
    throw new Error('Failed to get owners')
  }

  return { ownershipId: response.data.ownershipId }
}

export async function getOwnershipId(channelId: ChannelId): Promise<string> {
  if (channelId.root.startsWith('erc721:')) {
    const chainId = asNumber(Number(channelId.root.split(':')[1]))
    const blockHeight = await Eth.getBlockNumber(chainId)
    const ownershipId = `${channelId.root}:${blockHeight}`
    return ownershipId
  }

  const owners = await getOwners(channelId.root)
  return owners.ownershipId
}
