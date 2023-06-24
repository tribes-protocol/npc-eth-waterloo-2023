import fs from 'fs'
import os from 'os'
import path from 'path'
import sqlite3 from 'sqlite3'
import { ProofAPI } from '../networking/proof_api'
import { ChannelId, Message, asMessage } from './types'

export class Memory {
  private readonly db: sqlite3.Database

  static async create(uuid: string): Promise<Memory> {
    const instance = new Memory(uuid)
    await instance.setupDB()
    return instance
  }

  private constructor(uuid: string) {
    const dirPath = path.join(os.homedir(), '.npc')
    const dbPath = path.join(dirPath, `${uuid}.db`)

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
  }

  private async setupDB(): Promise<void> {
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS message (
      id VARCAR(255) NOT NULL PRIMARY KEY,
      author VARCAR(255) NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      channelId TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_message_channelId_timestamp ON message(channelId, timestamp);
  `
    await new Promise<void>((resolve, reject) => {
      this.db.run(createTableQuery, (error) => {
        if (error) {
          console.error('Error creating table:', error)
          reject(error)
        } else {
          console.log(`Table message created successfully.`)
          resolve()
        }
      })
    })
  }

  async sync(channelId: ChannelId) {
    try {
      const batchSize = 50
      let messages: Message[] = []
      let cursor: string | undefined

      do {
        const result = await ProofAPI.getMessages(channelId, batchSize, cursor)
        cursor = result.cursor
        messages = result.messages

        for (const message of messages) {
          await this.put(message)
        }
      } while (cursor)

      console.log(`Synced all messages for channel ${channelId.raw}`)
    } catch (e: any) {
      console.error(`Error syncing channel ${channelId.raw}: ${e.message}`, e)
    }
  }

  async search(query: string, limit: number): Promise<Message[]> {
    return new Promise((resolve, reject) => {
      const searchQuery = `
        SELECT * FROM message WHERE content LIKE ? LIMIT ?
      `

      const searchParam = `%${query}%`
      this.db.all(searchQuery, [searchParam, limit], (error, rows: { [key: string]: any }[]) => {
        if (error) {
          reject(error)
        } else {
          const messages: Message[] = rows.map(asMessage)
          resolve(messages)
        }
      })
    })
  }

  async put(data: Message): Promise<void> {
    return new Promise((resolve, reject) => {
      const insertQuery = `
          INSERT OR IGNORE INTO message (id, author, content, timestamp, channelId)
          VALUES (?, ?, ?, ?, ?)
        `

      const { id, author, content, timestamp, channelId } = data
      const values = [id, author.value, content, timestamp, channelId.raw]

      this.db.run(insertQuery, values, function (error) {
        if (error) {
          console.error('Unable to instert', error)
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  async getRecentMessages(channelId: ChannelId, limit: number, order: 'DESC' | 'ASC'): Promise<Message[]> {
    return new Promise((resolve, reject) => {
      const selectQuery = `
        SELECT * FROM message
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