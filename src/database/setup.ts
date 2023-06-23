import fs from 'fs'
import os from 'os'
import path from 'path'
import sqlite3 from 'sqlite3'

const dirPath = path.join(os.homedir(), '.npc')

// check if directory does not exist
if (!fs.existsSync(dirPath)) {
  // create directory
  fs.mkdirSync(dirPath, { recursive: true })
  console.log('Directory is created.')
}

const dbPath = path.join(dirPath, 'npc.db')

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    throw new Error(err.message)
  }
  console.log('Connected to the local SQLite database.')
})