import fs from 'fs'
import os from 'os'
import path from 'path'
import sqlite3 from 'sqlite3'
import { ChannelId, EthWalletAddress, Message, asMessage } from '../shared/types'

export class SqliteMemory {
  private readonly db: sqlite3.Database

  static async create(account: EthWalletAddress): Promise<SqliteMemory> {
    const instance = new SqliteMemory(account)
    await instance.setupSqlite()
    return instance
  }

  private constructor(account: EthWalletAddress) {
    const uuid = account.value
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

  async getMessagePosition(channelId: ChannelId): Promise<number> {
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

  async putMessagePosition(channelId: ChannelId, sequence: number): Promise<void> {
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

  async put(data: Message): Promise<void> {
    return new Promise<void>((resolve, reject) => {
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
  }

  async search(channelId: ChannelId, query: string, limit: number): Promise<Message[]> {
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

