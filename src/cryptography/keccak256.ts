import { ethers } from 'ethers'

export function keccak256(message: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(message))
}
