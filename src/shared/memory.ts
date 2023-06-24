import fs from 'fs'
import os from 'os'
import path from 'path'
import sqlite3 from 'sqlite3'
import { ProofAPI } from '../networking/proof_api'
import { ChannelId, Message } from './types'

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
      id VARCAR(255) PRIMARY KEY,
      author VARCAR(255),
      content TEXT,
      timestamp INTEGER,
      channelId TEXT
    );
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

  public async sync(channelId: ChannelId) {
    try {
      const batchSize = 50
      let messages: Message[] = []
      let cursor: string | undefined

      do {
        const result = await ProofAPI.getMessages(channelId, batchSize, cursor)
        cursor = result.cursor
        messages = result.messages

        for (const message of messages) {
          await this.put(message) // Store the message in the database
        }
      } while (cursor)

    } catch (e: any) {
      console.error(`Error syncing channel ${channelId.raw}: ${e.message}`, e)
    }
  }

  public async search(query: string, limit: number): Promise<Message[]> {
    return new Promise((resolve, reject) => {
      const searchQuery = `
        SELECT * FROM message WHERE content LIKE ? LIMIT ?
      `

      const searchParam = `%${query}%`
      this.db.all(searchQuery, [searchParam, limit], (error, rows: { [key: string]: any }[]) => {
        if (error) {
          reject(error)
        } else {
          const messages: Message[] = rows.map(row => ({
            id: row['id'],
            author: row['author'],
            content: row['content'],
            timestamp: row['timestamp'],
            channelId: row['channelId']
          }))
          resolve(messages)
        }
      })
    })
  }

  public async put(data: Message): Promise<void> {
    return new Promise((resolve, reject) => {
      const insertQuery = `
          INSERT OR IGNORE INTO message (id, author, content, timestamp)
          VALUES (?, ?, ?, ?)
        `

      const { id, author, content, timestamp } = data
      const values = [id, author, content, timestamp]

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
}