import fs from 'fs'
import os from 'os'
import path from 'path'
import sqlite3 from 'sqlite3'
import { SearchableMessage } from './types'

export class Store {
  private readonly db: sqlite3.Database


static async create(uuid: string): Promise<Store> {
  const instance = new Store(uuid)
  await instance.setupDB()
  return instance;
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

    // create the table if it does not exist
    // implement this



  


  } //end of class

  private async setupDB(): Promise<void> {
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS message (
   
      id INTEGER PRIMARY KEY,
      author VARCAR(255),
      content TEXT,
      timestamp INTEGER
    );
  `;

    await new Promise<void>((resolve, reject) => {
      this.db.run(createTableQuery, (error) => {
        if (error) {
          console.error('Error creating table:', error);
          reject(error)
        } else {
          console.log(`Table message created successfully.`);
          resolve()
        }
      });
    })
  }





  public async search(query: string, limit: number): Promise<SearchableMessage[]> {
    return new Promise((resolve, reject) => {
      const searchQuery = `
        SELECT * FROM message WHERE content LIKE ? LIMIT ?
      `;
  
      const searchParam = `%${query}%`;
      this.db.all(searchQuery, [searchParam, limit], (error, rows: { [key: string]: any }[]) => {
        if (error) {
          reject(error);
        } else {
          const messages: SearchableMessage[] = rows.map(row => ({
            id: row['id'],
            author: row['author'],
            content: row['content'],
            timestamp: row['timestamp']
          }));
          resolve(messages);
        }
      });
    });
  }  
   
  
    public async put(data: SearchableMessage): Promise<void> {
      return new Promise((resolve, reject) => {
        const insertQuery = `
          INSERT OR IGNORE INTO message (id, author, content, timestamp)
          VALUES (?, ?, ?, ?)
        `;
    
        const { id, author, content, timestamp } = data;
        const values = [id, author, content, timestamp];
    
        this.db.run(insertQuery, values, function(error) {
          if (error) {
            console.error('Unable to instert', error);
            reject(error);
          } else {
            resolve();
          }
        });
      });
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