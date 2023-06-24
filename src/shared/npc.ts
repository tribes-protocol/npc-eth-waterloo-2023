import 'cross-fetch/polyfill'
import dotenv from 'dotenv'
import { ec as EC } from 'elliptic'
import { ethers } from 'ethers'
import path from 'path'
import { Secp256k1, Secp256k1PublicKey } from '../cryptography/secp256k1'
import { ERC721 } from '../ethereum/erc721'
import { Eth } from '../ethereum/eth'
import { AccountAPI } from '../networking/account_api'
import { WebSocketConnection } from '../networking/websocket'
import { kTribesWSAPI } from './constants'
import { Disk } from './disk'
import { asNumber, asString, isNull } from './functions'
import { EthNFTAddress, EthWalletAddress } from './types'

const ec = new EC('secp256k1')

export class NPC {
  private readonly openaiAPIKey: string

  readonly nft: EthNFTAddress
  readonly owner: EthWalletAddress
  readonly wallet: ethers.HDNodeWallet

  private constructor(
    params: {
      nft: EthNFTAddress,
      openaiAPIKey: string,
      owner: EthWalletAddress,
      wallet: ethers.HDNodeWallet
    }
  ) {
    this.nft = params.nft
    this.openaiAPIKey = params.openaiAPIKey
    this.owner = params.owner
    this.wallet = params.wallet
  }

  static async login(opts: { envPath?: string } = {}) {
    const { envPath } = opts
    if (envPath) {
      dotenv.config({ path: envPath })
    } else {
      dotenv.config()
    }

    const npcDirectory = Disk.directory

    // get NFT details
    const nftChainId = asNumber(Number(process.env.NFT_CHAIN_ID))
    const nftContract = new EthWalletAddress(asString(process.env.NFT_CONTRACT))
    const nftTokenId = asString(process.env.NFT_TOKEN_ID)

    // get the NFT owner
    const owner = await ERC721.getOwner({
      chainId: nftChainId,
      contractAddress: nftContract,
      tokenId: nftTokenId,
    })

    // create or get device keypair
    const deviceJsonPath = path.join(npcDirectory, `${owner.value}_device.json`)
    let json: any = await Disk.readJson(deviceJsonPath)
    if (isNull(json)) {
      const device = Secp256k1.generateKeyPair()
      const publicKey = device.getPublic(true, 'hex')
      const privateKey = device.getPrivate('hex')
      json = {
        publicKey,
        privateKey,
      }

      Disk.writeJson(deviceJsonPath, json)
      console.log(`Created device public key: ${publicKey}`)
    }
    const device = ec.keyFromPrivate(json.privateKey, 'hex')

    // Get wallet
    const mnemonic = asString(process.env.MNEMONIC)
    const wallet = ethers.Wallet.fromPhrase(mnemonic, Eth.getRpcProvider(nftChainId))

    // login
    const msgToSign = await AccountAPI.getMessageToSignBy6551(
      nftChainId,
      nftContract,
      nftTokenId,
      new Secp256k1PublicKey(json.publicKey)
    )

    const signature = await wallet.signMessage(msgToSign.message)
    const deviceSignature = Secp256k1.signMessage(msgToSign.message, device)
    const jwt = await AccountAPI.login(msgToSign.message, signature, deviceSignature)

    const websocket = new WebSocketConnection(kTribesWSAPI)
    websocket.connect(jwt)

    console.log('NPC logged in!')

    return new NPC({
      nft: {
        chainId: nftChainId,
        contractAddress: nftContract,
        tokenId: nftTokenId,
      },
      openaiAPIKey: asString(process.env.OPENAI_API_KEY),
      owner,
      wallet,
    })
  }
}