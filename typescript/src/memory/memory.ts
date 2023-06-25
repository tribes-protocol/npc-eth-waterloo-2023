import { ChannelId, EthWalletAddress, Message } from '../shared/types'
import { ChromaMemory } from './chroma_memory'
import { SqliteMemory } from './sqlite_memory'

export class Memory {
  private readonly sqlite: SqliteMemory
  private readonly chroma: ChromaMemory

  static async create(account: EthWalletAddress): Promise<Memory> {
    const sqlite = await SqliteMemory.create(account)
    const chroma = new ChromaMemory()
    const memory = new Memory({ sqlite, chroma })
    return memory
  }

  private constructor({ sqlite, chroma }: { sqlite: SqliteMemory, chroma: ChromaMemory }) {
    this.sqlite = sqlite
    this.chroma = chroma
  }

  async sync(channelId: ChannelId) {
    await this.sqlite.sync(channelId)
  }

  async put(data: Message): Promise<void> {
    const putSqlite = this.sqlite.put(data)
      .catch((error) => console.error('Unable to insert to sqlite', error))

    const putChroma = this.chroma.put(data)
      .catch((error) => console.error('Unable to insert to chroma', error))

    await Promise.all([putSqlite, putChroma])
  }

  async search(channelId: ChannelId, query: string, limit: number): Promise<Message[]> {
    const [sqliteResults, chromadbResults] = await Promise.all([
      this.sqlite.search(channelId, query, limit),
      this.chroma.search(channelId, query, limit)
    ])

    const uniques = new Map<string, Message>()
    for (const message of chromadbResults) {
      uniques.set(message.id, message)
    }
    for (const message of sqliteResults) {
      uniques.set(message.id, message)
    }

    const results = Array.from(uniques.values())
    return results
  }

  async getRecentMessages(
    channelId: ChannelId,
    limit: number,
    order: 'DESC' | 'ASC'
  ): Promise<Message[]> {
    return this.sqlite.getRecentMessages(channelId, limit, order)
  }

}

