import { Alchemy, Network, NftTokenType } from "alchemy-sdk"
import 'cross-fetch/polyfill'
import dotenv from 'dotenv'
import { ec as EC } from 'elliptic'
import { ethers } from 'ethers'
import { Configuration, OpenAIApi } from 'openai'
import path from 'path'
import { Secp256k1, Secp256k1PublicKey } from '../cryptography/secp256k1'
import { EIP6551 } from '../ethereum/eip6551'
import { ERC721 } from '../ethereum/erc721'
import { Eth } from '../ethereum/eth'
import { AccountAPI } from '../networking/account_api'
import { WebSocketConnection } from '../networking/websocket'
import { npcSystemPrompt, personalityProfileFromERC721Metadata } from "../prompts/personality"
import { kTribesWSAPI } from './constants'
import { Disk } from './disk'
import { asNumber, asString, isNull } from './functions'
import { EthChain, EthNFTAddress, EthWalletAddress } from './types'
const ec = new EC('secp256k1')


// how to extract the api key and make sure you can reference it from npc class


export class NPC {
  private readonly openai: OpenAIApi
  private readonly systemPrompt: string

  readonly nft: EthNFTAddress
  readonly owner: EthWalletAddress
  readonly wallet: ethers.HDNodeWallet
  readonly alchemyAPIKey: string

  private constructor(
    params: {
      nft: EthNFTAddress,
      openai: OpenAIApi,
      owner: EthWalletAddress,
      wallet: ethers.HDNodeWallet,
      alchemyAPIKey: string,
      systemPrompt: string
    }
  ) {
    this.nft = params.nft
    this.owner = params.owner
    this.wallet = params.wallet
    this.alchemyAPIKey = params.alchemyAPIKey
    this.openai = params.openai
    this.systemPrompt = params.systemPrompt
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
    const nftAddress: EthNFTAddress = {
      chainId: nftChainId,
      contractAddress: nftContract,
      tokenId: nftTokenId,
    }
    const owner = await ERC721.getOwner(nftAddress)
    const account = await EIP6551.getAccountAddress(nftAddress)

    // create or get device keypair
    const deviceJsonPath = path.join(npcDirectory, `${account}_device.json`)
    let deviceJson: any = await Disk.readJson(deviceJsonPath)
    if (isNull(deviceJson)) {
      const device = Secp256k1.generateKeyPair()
      const publicKey = device.getPublic(true, 'hex')
      const privateKey = device.getPrivate('hex')
      deviceJson = {
        publicKey,
        privateKey,
      }

      Disk.writeJson(deviceJsonPath, deviceJson)
      console.log(`Created device public key: ${publicKey}`)
    }
    const device = ec.keyFromPrivate(deviceJson.privateKey, 'hex')

    // Get wallet
    const mnemonic = asString(process.env.MNEMONIC)
    const wallet = ethers.Wallet.fromPhrase(mnemonic, Eth.getRpcProvider(nftChainId))

    // initialize OpenAI LLM
    const openAIConfig = new Configuration({ apiKey: asString(process.env.OPENAI_API_KEY) })
    const openai = new OpenAIApi(openAIConfig)

    // build the personality profile if it doesn't exist
    const personalityJsonPath = path.join(npcDirectory, `${account}_personality.json`)
    let personalityJson: any = await Disk.readJson(personalityJsonPath)
    if (isNull(personalityJson)) {
      const metadata = await this.getERC721Metadata(
        nftChainId,
        nftContract,
        nftTokenId,
      )
      const prompt = personalityProfileFromERC721Metadata(metadata.rawMetadata)
      try {
        const completion = await openai.createChatCompletion({
          model: 'gpt-3.5-turbo-0613',
          messages: [
            { role: 'system', content: 'create a fake funny personality profile' }
          ],
          temperature: 0.9
        })

        const response = completion.data.choices[0].message
        const content = response?.content?.trim()

        if (isNull(content)) {
          throw new Error('Failed to create personality profile')
        }

        personalityJson = { content }

        Disk.writeJson(personalityJsonPath, personalityJson)
        console.log(`Created personality profile.`)

      } catch (E: any) {
        console.log(E.message)
        throw E
      }

    }

    // login
    const msgToSign = await AccountAPI.getMessageToSignBy6551(
      nftChainId,
      nftContract,
      nftTokenId,
      new Secp256k1PublicKey(deviceJson.publicKey)
    )

    const signature = await wallet.signMessage(msgToSign.message)
    const deviceSignature = Secp256k1.signMessage(msgToSign.message, device)
    const jwt = await AccountAPI.login(msgToSign.message, signature, deviceSignature)

    const websocket = new WebSocketConnection(kTribesWSAPI)
    // websocket.on('message', async (msg) => {
    //   try {
    //     await handleMessage(msg)
    //   } catch (e: any) {
    //     console.log(`Error handling message: ${e.message}`, e)
    //   }
    // })

    websocket.connect(jwt)

    console.log('NPC logged in!')

    return new NPC({
      nft: {
        chainId: nftChainId,
        contractAddress: nftContract,
        tokenId: nftTokenId,
      },
      openai,
      owner,
      wallet,
      alchemyAPIKey: asString(process.env.ALCHEMY_POLYGON_API_KEY),
      systemPrompt: npcSystemPrompt(personalityJson.content),
    })
  }

  private static async getERC721Metadata(
    chainId: EthChain,
    contractAddress: EthWalletAddress,
    tokenId: string,
  ): Promise<any> {
    let network: Network
    let apiKey: string
    switch (chainId) {
      case EthChain.ethereum:
        network = Network.ETH_MAINNET
        apiKey = asString(process.env.ALCHEMY_MAINNET_API_KEY)
        break
      case EthChain.polygon:
        network = Network.MATIC_MAINNET
        apiKey = asString(process.env.ALCHEMY_POLYGON_API_KEY)
        break
    }

    const settings = {
      apiKey: apiKey,
      network: network,
    }

    const alchemy = new Alchemy(settings)
    const metadata = await alchemy.nft.getNftMetadata(
      contractAddress.value,
      tokenId,
      { tokenType: NftTokenType.ERC721, tokenUriTimeoutInMs: 6000 },
    )

    return metadata
  }

  async llm(message: string): Promise<string> {
    const completion = await this.openai.createChatCompletion({
      model: 'gpt-3.5-turbo-0613',
      messages: [
        { 'role': 'system', 'content': this.systemPrompt },
        // ...messages.toArray()
      ],
      temperature: 0,
    })
    const response = completion.data.choices[0].message
    const content = response?.content?.trim()
    return content ?? ''
  }
}