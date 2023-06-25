import axios, { AxiosResponse } from 'axios'
import { Secp256k1PublicKey } from "../cryptography/secp256k1"
import { kTribesHTTPAPI } from "../shared/constants"
import { EthWalletAddress, MessageToSignResponseEIP6551 } from "../shared/types"

async function getMessageToSignBy6551(
  chainId: number,
  contractAddress: EthWalletAddress,
  tokenId: string,
  device: Secp256k1PublicKey
): Promise<MessageToSignResponseEIP6551> {
  const body = {
    type: 'eip6551',
    contractAddress: contractAddress.value,
    chainId: chainId,
    tokenId: tokenId,
    proxy: device.value
  }

  let response: AxiosResponse<MessageToSignResponseEIP6551>
  try {
    response = await axios.post<MessageToSignResponseEIP6551>(
      `${kTribesHTTPAPI}/get_message_to_sign`,
      body
    )
  } catch (error) {
    console.error('Error in getMessageToSign:', error)
    throw new Error('getMessageToSign failed')
  }

  if (!response.data) {
    throw new Error('getMessageToSign failed')
  }

  return {
    owner: new EthWalletAddress(response.data.owner as any),
    account: new EthWalletAddress(response.data.account as any),
    type: response.data.type,
    message: response.data.message
  }
}

let jwtToken: string | undefined

async function login(
  message: string,
  signature: string,
  deviceSignature: string
): Promise<string> {
  const body = {
    message: message,
    signature: signature,
    deviceSignature: deviceSignature
  }

  let response: AxiosResponse<string>
  try {
    response = await axios.post<string>(`${kTribesHTTPAPI}/login`, body)
  } catch (error) {
    console.error('Error in login:', error)
    throw new Error('login failed')
  }

  if (!response.data) {
    throw new Error('login failed')
  }

  jwtToken = response.data

  return response.data
}

export const AccountAPI = {
  getMessageToSignBy6551,
  login
}

export const JWT = {
  value: () => jwtToken
}
