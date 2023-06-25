import axios, { AxiosResponse } from 'axios'
import { ChromaClient } from 'chromadb'

import { toJsonTree } from '../shared/functions'
import { ChannelId, Message, asMessage } from '../shared/types'

export class LocalChromaMemory {
  private readonly chroma: ChromaClient

  constructor() {
    this.chroma = new ChromaClient()
  }

  async put(data: Message): Promise<void> {
    const response: AxiosResponse = await axios.post('http://localhost:7020/add', toJsonTree(data))
    if (response.status !== 200) {
      throw new Error(`Unexpected response code: ${response.status}`)
    }
  }

  async search(channelId: ChannelId, query: string, limit: number): Promise<Message[]> {
    const response: AxiosResponse = await axios.get(`http://localhost:7020/query?channelId=${channelId.raw}&q=${encodeURIComponent(query)}&limit=${limit}`)

    if (response.status !== 200) {
      throw new Error(`Unexpected response code: ${response.status}`)
    }

    const data = response.data.messages ?? []
    const result = data.map(asMessage)
    return result
  }
}