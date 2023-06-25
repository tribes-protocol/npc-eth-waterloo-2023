import { ec as EC } from 'elliptic'
import { keccak256 } from './keccak256'

const ec = new EC('secp256k1')

// Verify the signature using the public key and the original message
function verifySignature(
  message: string,
  signature: string,
  publicKey: Secp256k1PublicKey
): boolean {
  try {
    const messageHash = keccak256(message)
    return publicKey.toEcKeyPair().verify(messageHash, signature)
  } catch (e: any) {
    return false
  }
}

// Generate a secp256k1 private/public key pair
function generateKeyPair(): EC.KeyPair {
  return ec.genKeyPair()
}

// Sign the message using the private key
function signMessage(message: string, privateKey: EC.KeyPair): string {
  const messageHash = keccak256(message)
  const signature = privateKey.sign(messageHash)
  return signature.toDER('hex')
}

function isValidPublicKey(publicKeyString: string): boolean {
  try {
    // Attempt to create a public key from the given string
    ec.keyFromPublic(publicKeyString, 'hex')
    return true
  } catch (error) {
    // If an error occurs during the key creation, the public key is not valid
    return false
  }
}

export const Secp256k1 = {
  generateKeyPair,
  signMessage,
  verifySignature,
  isValidPublicKey
}

export class Secp256k1PublicKey {
  readonly value: string

  constructor(value: string) {
    if (!Secp256k1.isValidPublicKey(value)) {
      throw new Error('Invalid secp256k1 public key: ' + value)
    }
    this.value = value
  }

  static fromEcKeyPair(keyPair: EC.KeyPair): Secp256k1PublicKey {
    return new Secp256k1PublicKey(keyPair.getPublic(true, 'hex'))
  }

  toEcKeyPair(): EC.KeyPair {
    return ec.keyFromPublic(this.value, 'hex')
  }

  toJSON(): string {
    return this.value
  }

  toString(): string {
    return this.value
  }
}
