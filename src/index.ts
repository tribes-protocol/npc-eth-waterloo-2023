import 'cross-fetch/polyfill'
import express from 'express'
import path from 'path'
import { NPC } from './shared/npc'


const app = express()
const port = 42069


// async function storeTexts(channel: string, limit: number, tableName: Store) {

//     const batchSize = 50;
//     let messages: Message[] = [];
//     let cursor: string | undefined;

//     do {
//         const result = await ProofAPI.getMessages(channel, batchSize, cursor);
//         cursor = result.cursor
//         messages = result.messages

//         for (const message of messages) {
//             await tableName.put(message); // Store the message in the database
//         }
//     } while (cursor);

//     console.log('Chat history stored successfully!');
// }


// const messages = await ProofAPI.getMessages(channel, limit);


// for (const message of messages) {
//     await tableName.put(message); // Store the message in the database
// }

// console.log('Chat history stored successfully!');

async function main() {
  app.get('/heartbeat', async (req, res) => {
    res.json({ heartbeat: Date.now() })
  })

  app.listen(port, async () => {
    console.log('ⵣ NPC starting')
    const envPath = path.join(__dirname, '.env')
    await NPC.login({ envPath })
  })
}

main()