import { ProofAPI } from '../networking/proof_api'
import { ChannelId, EthWalletAddress, Message } from '../shared/types'
import { LocalChromaMemory } from './local_chroma_memory'
import { SqliteMemory } from './sqlite_memory'

export class Memory {
  private readonly sqlite: SqliteMemory
  private readonly chroma: LocalChromaMemory

  static async create(account: EthWalletAddress): Promise<Memory> {
    const sqlite = await SqliteMemory.create(account)
    const chroma = new LocalChromaMemory()
    const memory = new Memory({ sqlite, chroma })
    return memory
  }

  private constructor({ sqlite, chroma }: { sqlite: SqliteMemory, chroma: LocalChromaMemory }) {
    this.sqlite = sqlite
    this.chroma = chroma
  }

  async sync(channelId: ChannelId) {
    try {
      const batchSize = 50
      let messages: Message[] = []
      let cursor: string | undefined
      const highestSequenceNumber: number = await this.sqlite.getMessagePosition(channelId)
      const latestMessages = await ProofAPI.getMessages(channelId, 1)
      const latestMessage = latestMessages.messages[0]
      if (latestMessage && highestSequenceNumber >= latestMessage.sequence) {
        console.log(`nothing to sync ${highestSequenceNumber} >= ${latestMessage.sequence}`)
        return
      }

      let nextHighestSequenceNumber = highestSequenceNumber

      do {
        const result = await ProofAPI.getMessages(channelId, batchSize, cursor)
        cursor = result.cursor
        messages = result.messages

        for (const message of messages) {
          if (message.sequence < highestSequenceNumber) {
            cursor = undefined
            break
          }

          await this.put(message) // Store the message in the database
          nextHighestSequenceNumber = Math.max(nextHighestSequenceNumber, message.sequence)
        }
      } while (cursor)

      // put highest message into table
      await this.sqlite.putMessagePosition(channelId, nextHighestSequenceNumber)

    } catch (e: any) {
      console.error(`Error syncing channel ${channelId.raw}: ${e.message} `, e)
    }
  }

  async put(data: Message): Promise<void> {
    const putSqlite = this.sqlite.put(data)
      .catch((error) => console.error('Unable to insert to sqlite', error.message))

    const putChroma = this.chroma.put(data)
      .catch((error) => console.error('Unable to insert to chroma', error.message))

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

