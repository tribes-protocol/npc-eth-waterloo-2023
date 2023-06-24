import 'cross-fetch/polyfill'
import express from 'express'
import path from 'path'
import { NPC } from './shared/npc'
import { ProofAPI } from './networking/proof_api'
import { Store } from './database/store';
import { Message } from './shared/types'


const app = express()
const port = 42069

let offset: number = 0;

async function storeTexts(channel: string, limit: number, tableName: Store) {

    const batchSize = 50;
    let messages: Message[] = [];
    let cursor: string | undefined;

    do {
        const result = await ProofAPI.getMessages(channel, batchSize, cursor);
        cursor = result.cursor
        messages = result.messages

        for (const message of messages) {
            await tableName.put(message); // Store the message in the database
        }
    } while (cursor);

    console.log('Chat history stored successfully!');
}




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

        const channelId = 'direct:0x844f5ba207f5cc234d1c77d245d727af30ae8519_0xdaeb5b9e283460b6e2d1fb45484d5d07d1b55e67/message'
        const limit = 2
        const store = await Store.create('test');
        storeTexts(channelId, limit, store);
        let x: 7;
    })
}

main()