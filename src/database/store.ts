import fs from 'fs'
import os from 'os'
import path from 'path'
import sqlite3 from 'sqlite3'
import { SearchableMessage } from '../shared/types'

export class Store {
  private readonly db: sqlite3.Database

  constructor(uuid: string) {
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

    // create the table if it does not exist
    // implement this
  }

  public async search(query: string): Promise<SearchableMessage[]> {
    // implement search
    throw new Error('Not implemented')
  }

  public async put(data: SearchableMessage) {
    // implement save
    throw new Error('Not implemented')
  }
}
  

/*

import sqlite3 from 'sqlite3';

// Open a database handle
const db = new sqlite3.Database('./myDatabase.db', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to the local SQLite database.');
});

db.serialize(() => {
  // Create a new table named 'messages'
  db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY,
      message TEXT
  )`, (err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log('Messages table created.');
  });

  // Enable FTS on the "messages" table
  db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(content, tokenize = 'porter')`, (err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log('Messages FTS table created.');
  });

  // Inserting data into "messages" table
  let stmt = db.prepare(`INSERT INTO messages VALUES (?, ?)`);
  for (let i = 1; i <= 10; i++) {
    stmt.run(i, `This is message ${i}`);
  }
  stmt.finalize();

  // Populating the FTS table with data from the "messages" table
  db.run(`INSERT INTO messages_fts (rowid, content) SELECT id, message FROM messages`, (err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log('Data inserted into FTS table.');
  });
});

// Close the database connection
db.close((err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Closed the database connection.');
});
*/