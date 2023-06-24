import { Alchemy, Network, NftTokenType } from "alchemy-sdk"
import 'cross-fetch/polyfill'
import dotenv from 'dotenv'
import { ec as EC } from 'elliptic'
import { ethers } from 'ethers'
import { ChatCompletionFunctions, ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai'
import path from 'path'
import { Secp256k1, Secp256k1PublicKey } from '../cryptography/secp256k1'
import { EIP6551 } from '../ethereum/eip6551'
import { ERC721 } from '../ethereum/erc721'
import { Eth } from '../ethereum/eth'
import { AccountAPI } from '../networking/account_api'
import { ProofAPI } from "../networking/proof_api"
import { WebSocketConnection } from '../networking/websocket'
import { npcSystemPrompt, personalityProfileFromERC721Metadata } from "../prompts/personality"
import { kTribesWSAPI } from './constants'
import { Disk } from './disk'
import { asNumber, asString, isNull, toJsonTree } from './functions'
import { Memory } from "./memory"
import { EthChain, EthNFTAddress, EthWalletAddress, Message, proofToMessage } from './types'

const ec = new EC('secp256k1')

export class NPC {
  private readonly openai: OpenAIApi
  private readonly systemPrompt: string
  private readonly alchemyAPIKey: string
  private readonly memory: Memory

  readonly nft: EthNFTAddress
  readonly owner: EthWalletAddress
  readonly wallet: ethers.HDNodeWallet
  readonly account: EthWalletAddress
  readonly device: EC.KeyPair

  private constructor(
    params: {
      nft: EthNFTAddress,
      openai: OpenAIApi,
      owner: EthWalletAddress,
      wallet: ethers.HDNodeWallet,
      alchemyAPIKey: string,
      systemPrompt: string,
      account: EthWalletAddress,
      device: EC.KeyPair,
      memory: Memory,
    }
  ) {
    this.nft = params.nft
    this.owner = params.owner
    this.wallet = params.wallet
    this.alchemyAPIKey = params.alchemyAPIKey
    this.openai = params.openai
    this.systemPrompt = params.systemPrompt
    this.account = params.account
    this.device = params.device
    this.memory = params.memory
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
          model: 'gpt-3.5-turbo-16k',
          messages: [
            { role: 'system', content: prompt }
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
    const memory = await Memory.create(account.value)
    const npc = new NPC({
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
      account,
      device,
      memory,
    })

    websocket.on('message', async (msg) => {
      try {
        const json = JSON.parse(msg)
        if (json.type !== 'new_proof') {
          return undefined
        }

        const parsedMessage = proofToMessage(json.body)
        if (isNull(parsedMessage) || parsedMessage.author.value === account.value) {
          return
        }

        await this.handleMessage(parsedMessage, npc)
      } catch (e: any) {
        console.log(`Error handling message: ${e.message}`, e)
      }
    })

    websocket.connect(jwt)

    console.log(`NPC ${account.value} logged in!`)
    return npc
  }

  private static async handleMessage(msg: Message, npc: NPC): Promise<void> {
    const isDM = msg.channelId.root.startsWith('direct:')
    if (!isDM) {
      return
    }


    const response = await npc.llm(msg)

    console.info('Human:', msg.id, msg.content)
    console.info('AI: ', response)

    if (!isNull(response) && response.trim().length > 0) {
      await ProofAPI.sendMessage(npc, response, msg.channelId, undefined)
    }

    await npc.memory.put(msg)
    npc.memory.sync(msg.channelId)
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

  async llm(message: Message): Promise<string | undefined> {
    const recents = [
      ...(await this.memory.getRecentMessages(message.channelId, 5, 'DESC')),
      message
    ]
    const messages: ChatCompletionRequestMessage[] = recents.map((r) => {
      return {
        role: r.author.value === this.account.value ? 'assistant' : 'user',
        content: r.content,
      }
    })

    const functions: ChatCompletionFunctions[] = [
      {
        name: 'search_messages',
        description: 'Use this to search all chat history or if you want to lookup something that happened in the past',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'A string query to use for searching'
            }
          },
          required: ['query']
        }
      },
    ]

    let limit = 0
    do {
      const completion = await this.openai.createChatCompletion({
        model: 'gpt-3.5-turbo-0613',
        messages: [
          { 'role': 'system', 'content': this.systemPrompt },
          ...messages
        ],
        temperature: 0,
        functions,
        function_call: 'auto'
      })

      const response = completion.data.choices[0].message
      const functionCall = response?.function_call

      if (
        response?.role === 'assistant' &&
        !isNull(functionCall) &&
        functionCall.name === 'search_messages'
      ) {
        messages.push(response)

        const params = JSON.parse(functionCall.arguments ?? '{}')
        const query = params.query
        if (isNull(query) || query.trim().length === 0) {
          break
        }
        const searchResults = this.memory.search(message.channelId, query, 5)

        messages.push({
          role: 'function',
          name: functionCall.name,
          content: JSON.stringify({
            results: (await searchResults).map(toJsonTree)
          })
        })
      } else {
        const content = response?.content?.trim()
        return content
      }

      limit++
    } while (limit < 10)

    return undefined
  }
}