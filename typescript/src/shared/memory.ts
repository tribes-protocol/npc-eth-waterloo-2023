import { ChromaClient, OpenAIEmbeddingFunction } from 'chromadb'
import fs from 'fs'
import os from 'os'
import path from 'path'
import sqlite3 from 'sqlite3'
import { keccak256 } from '../cryptography/keccak256'
import { ProofAPI } from '../networking/proof_api'
import { asString, isNull } from './functions'
import { ChannelId, EthWalletAddress, Message, asMessage } from './types'

export class Memory {
  private readonly db: sqlite3.Database
  private readonly chroma: ChromaClient
  private readonly account: EthWalletAddress

  static async create(account: EthWalletAddress): Promise<Memory> {
    const instance = new Memory(account)
    await instance.setupSqlite()
    return instance
  }

  private constructor(account: EthWalletAddress) {
    const uuid = account.value
    const dirPath = path.join(os.homedir(), '.npc')
    const dbPath = path.join(dirPath, `${uuid}.db`)

    this.account = account

    // check if directory does not exist
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
      console.log('~/.npc Directory is created.')
    }

    // create db instance
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        throw new Error(err.message)
      }
      console.log('Connected to the local SQLite database.')
    })

    // chromadb
    this.chroma = new ChromaClient()
  }


  private async setupSqlite(): Promise<void> {
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS message (
      id VARCAR(255) NOT NULL PRIMARY KEY,
      author VARCAR(255) NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      channelId TEXT NOT NULL,
      sequence INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS message_positions (
      channelId TEXT NOT NULL PRIMARY KEY,
      position INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_message_channelId_timestamp ON message(channelId, timestamp);
  `

    await new Promise<void>((resolve, reject) => {
      this.db.exec(createTableQuery, (error) => {
        if (error) {
          console.error('Error creating table:', error)
          reject(error)
        } else {
          console.log(`Tables created successfully.`)
          resolve()
        }
      })
    })
  }

  private async getMessagePosition(channelId: ChannelId): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const getPositionQuery = "SELECT position FROM message_positions WHERE channelId = ?"

      this.db.get(getPositionQuery, [channelId.raw], (error, row) => {
        if (error) {
          console.error(`Error retrieving position for channel ${channelId.raw}: ${error.message} `)
          reject(error)
        } else {
          if (row) {
            resolve((row as any).position)
          } else {
            resolve(-1)
          }
        }
      })
    })
  }

  async sync(channelId: ChannelId) {
    try {
      const batchSize = 50
      let messages: Message[] = []
      let cursor: string | undefined
      let highestSequenceNumber: number = await this.getMessagePosition(channelId)

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
          highestSequenceNumber = Math.max(highestSequenceNumber, message.sequence)
        }
      } while (cursor)

      // put highest message into table
      await this.putPosition(channelId, highestSequenceNumber)

    } catch (e: any) {
      console.error(`Error syncing channel ${channelId.raw}: ${e.message} `, e)
    }
  }


  private async putPosition(channelId: ChannelId, sequence: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const insertQuery = `
      INSERT or REPLACE INTO message_positions (channelId, position)
      SELECT ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM message_positions WHERE channelId = ? AND position >= ?
      )
      OR (
        SELECT position FROM message_positions WHERE channelId = ?
      ) < ?
        `

      const values = [channelId.raw, sequence, channelId.raw, sequence, channelId.raw, sequence]

      this.db.run(insertQuery, values, function (error) {
        if (error) {
          console.error('Unable to insert', error)
          reject(error)
        } else {
          resolve()
        }
      })
    })
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
    const putSqlite = new Promise<void>((resolve, reject) => {
      const insertQuery = `
          INSERT OR IGNORE INTO message(id, author, content, timestamp, channelId, sequence)
      VALUES(?, ?, ?, ?, ?, ?)
      `

      const { id, author, content, timestamp, channelId } = data
      const values = [id, author.value, content, timestamp, channelId.raw, data.sequence]

      this.db.run(insertQuery, values, function (error) {
        if (error) {
          console.error('Unable to insert', error)
          reject(error)
        } else {
          resolve()
        }
      })
    })
      .catch((error) => console.error('Unable to insert to sqlite', error))

    const collection = await this.chromaCollectionForChannelId(data.channelId)
    const ids = [data.id]
    const metadatas = [{
      author: data.author.value,
      channelId: data.channelId.raw,
      timestamp: data.timestamp,
      sequence: data.sequence
    }]

    const documents = [data.content]
    const putChroma = collection.add({ ids, metadatas, documents })
      .catch((error) => console.error('Unable to insert to chroma', error))

    await Promise.all([putSqlite, putChroma])
  }

  async search(channelId: ChannelId, query: string, limit: number): Promise<Message[]> {
    const [sqliteResults, chromadbResults] = await Promise.all([
      this.querySqlite(channelId, query, limit),
      this.queryChromadb(channelId, query, limit)
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

  private async querySqlite(
    channelId: ChannelId,
    query: string,
    limit: number
  ): Promise<Message[]> {
    return new Promise((resolve, reject) => {
      const searchQuery = `
      SELECT * FROM message WHERE channelId = ? AND content LIKE ? LIMIT ?
        `

      const searchParam = `%${query}%`
      this.db.all(
        searchQuery,
        [channelId.raw, searchParam, limit],
        (error, rows: { [key: string]: any }[]) => {
          if (error) {
            reject(error)
          } else {
            const messages: Message[] = rows.map(asMessage)
            resolve(messages)
          }
        })
    })
  }

  private async queryChromadb(
    channelId: ChannelId,
    queryText: string,
    limit: number
  ): Promise<Message[]> {
    const collection = await this.chromaCollectionForChannelId(channelId)
    const results = await collection.query({ nResults: limit, queryTexts: [queryText] })
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

  async getRecentMessages(
    channelId: ChannelId,
    limit: number,
    order: 'DESC' | 'ASC'
  ): Promise<Message[]> {
    return new Promise((resolve, reject) => {
      const selectQuery = `
      SELECT * 
         FROM message
        WHERE channelId = ?
        ORDER BY timestamp ${order}
      LIMIT ?
        `

      this.db.all(selectQuery, [channelId.raw, limit], (error, rows) => {
        if (error) {
          console.error('Unable to retrieve messages', error)
          reject(error)
        } else {
          const messages: Message[] = rows.map(asMessage)
          resolve(messages)
        }
      })
    })
  }

}

