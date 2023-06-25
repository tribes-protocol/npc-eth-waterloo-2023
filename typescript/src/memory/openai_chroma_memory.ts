import { ChromaClient, OpenAIEmbeddingFunction } from 'chromadb'
import { keccak256 } from '../cryptography/keccak256'
import { asString, isNull } from '../shared/functions'
import { ChannelId, EthWalletAddress, Message } from '../shared/types'

export class OpenAIChromaMemory {
  private readonly chroma: ChromaClient

  constructor() {
    this.chroma = new ChromaClient()
  }

  private async chromaCollectionForChannelId(channelId: ChannelId) {
    const computedChannelId = keccak256(channelId.raw.split('/')[0]).substring(0, 62)
    const name = `c${computedChannelId}`
    const apiKey = asString(process.env.OPENAI_API_KEY)
    const embeddingFunction = new OpenAIEmbeddingFunction({ openai_api_key: apiKey })
    const collection = await this.chroma.getOrCreateCollection({ name, embeddingFunction })
    return collection
  }

  async put(data: Message): Promise<void> {
    const collection = await this.chromaCollectionForChannelId(data.channelId)
    const ids = [data.id]
    const metadatas = [{
      author: data.author.value,
      channelId: data.channelId.raw,
      timestamp: data.timestamp,
      sequence: data.sequence
    }]

    const documents = [data.content]
    await collection.add({ ids, metadatas, documents })
  }

  async search(channelId: ChannelId, query: string, limit: number): Promise<Message[]> {
    const collection = await this.chromaCollectionForChannelId(channelId)
    const results = await collection.query({ nResults: limit, queryTexts: [query] })
    const total = results.ids[0].length

    if (total === 0) {
      return []
    }

    const metadatas = results.metadatas[0]
    const documents = results.documents[0]
    const ids = results.ids[0]
    const messages: Message[] = []

    for (let i = 0; i < total; i++) {
      const itemMetadata = metadatas[i]
      const itemDocument = documents[i]
      const itemId = ids[i]

      if (isNull(itemMetadata) || isNull(itemDocument) || isNull(itemId)) {
        continue
      }

      const author = new EthWalletAddress(itemMetadata.author as string)
      const timestamp = itemMetadata.timestamp as number
      const channelId = new ChannelId(itemMetadata.channelId as string)
      const sequence = itemMetadata.sequence as number
      const content = itemDocument

      messages.push({
        author,
        timestamp,
        channelId,
        sequence,
        content,
        id: itemId
      })
    }

    return messages
  }
}