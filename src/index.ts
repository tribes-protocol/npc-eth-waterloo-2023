import 'cross-fetch/polyfill'
import express from 'express'
import path from 'path'
import { NPC } from './shared/npc'

const app = express()
const port = 42069

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