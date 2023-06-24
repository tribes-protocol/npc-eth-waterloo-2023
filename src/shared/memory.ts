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
    CREATE TABLE IF NOT EXISTS message_positions (
      channelId TEXT NOT NULL PRIMARY KEY,
      position INTEGER NOT NULL
    );
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

    // await new Promise<void>((resolve, reject) => {
    //   this.db.run(createMessagePositionsTableQuery, (error) => {
    //     if (error) {
    //       console.error('Error creating message_positions table:', error);
    //       reject(error);
    //     } else {
    //       console.log('Table message_positions created successfully.');
    //       resolve();
    //     }
    //   })
    // })
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

      await this.putPosition(channelId, highestSequenceNumber)

      // put highest message into table
    } catch (e: any) {
      console.error(`Error syncing channel ${channelId.raw}: ${e.message} `, e)
    }
  }

  async search(query: string, limit: number): Promise<Message[]> {
    return new Promise((resolve, reject) => {
      const searchQuery = `
      SELECT * FROM message WHERE content LIKE ? LIMIT ?
        `

      const searchParam = `% ${query}% `
      this.db.all(searchQuery, [searchParam, limit], (error, rows: { [key: string]: any }[]) => {
        if (error) {
          reject(error)
        } else {
          const messages: Message[] = rows.map(row => ({
            id: row['id'],
            author: row['author'],
            content: row['content'],
            timestamp: row['timestamp'],
            channelId: row['channelId'],
            sequence: row['sequence']
          }))
          resolve(messages)
        }
      })
    })
  }

  async putPosition(channelId: ChannelId, sequence: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const insertQuery = `
    INSERT OR REPLACE INTO message_positions(channelId, position)
      VALUES(?, ?)
        `
      const values = [channelId.raw, sequence]

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

  async put(data: Message): Promise<void> {
    return new Promise((resolve, reject) => {
      const insertQuery = `
          INSERT OR IGNORE INTO message(id, author, content, timestamp)
      VALUES(?, ?, ?, ?)
        `

      const { id, author, content, timestamp } = data
      const values = [id, author, content, timestamp]

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
}