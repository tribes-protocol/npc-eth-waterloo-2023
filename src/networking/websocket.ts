import { EventEmitter } from 'events'
import WebSocket from 'ws'

export class WebSocketConnection extends EventEmitter {
  private url: string
  private websocket?: WebSocket
  private isConnected: boolean
  private forceClose: boolean
  private pingInterval: any
  private readonly PING_MESSAGE = { action: 'ping', data: '' }
  private readonly PING_INTERVAL_MS = 60000

  constructor(url: string) {
    super()
    this.url = url
    this.isConnected = false
    this.forceClose = false
  }

  send(data: any) {
    this.websocket?.send(JSON.stringify(data))
  }

  connect(jwt: string) {
    this.websocket = new WebSocket(this.url)
    this.forceClose = false

    this.websocket.onopen = () => {
      this.isConnected = true
      console.log(`Websocket connected`)
      this.send({ action: 'auth', token: jwt })
      this.pingInterval = setInterval(() => {
        if (this.isConnected) {
          this.websocket?.send(JSON.stringify(this.PING_MESSAGE))
          // console.log(`Ping sent to ${this.url}`)
        }
      }, this.PING_INTERVAL_MS)
    }

    this.websocket.onmessage = (event) => {
      // Here you can handle incoming messages
      // console.log('Received: ', event.data)
      this.emit('message', event.data)
    }

    this.websocket.onclose = (event) => {
      console.log('WebSocket is closed. Reconnect will be attempted in 1 second.', event.reason)
      this.isConnected = false
      clearInterval(this.pingInterval)
      if (!this.forceClose) {
        setTimeout(() => {
          if (!this.isConnected) {
            this.connect(jwt)
          }
        }, 1000)
      }
    }

    this.websocket.onerror = (err) => {
      console.error('WebSocket encountered error: ', err, 'Closing socket')
      this.websocket?.close()
    }
  }

  disconnect() {
    this.forceClose = true
    this.isConnected = false
    clearInterval(this.pingInterval)
    this.websocket?.close()
  }
}
