const WebSocket = require('ws')

function Counter() {
    this.current = 0
    this.increment = () => {
        this.current += 1
        return this.current
    }
}

/**
 * Constructor for the Tradovate WebSocket
 */
function TradovateSocket() {
    this.ws = null
    this.counter = new Counter()    
}

TradovateSocket.prototype.getSocket = function() {
    return this.ws
}

/**
 * Makes a request and returns a promise that will resolve with the response JSON data
 */
TradovateSocket.prototype.request = function({url, query, body}) {
    const ws = this.ws
    const id = this.counter.increment()
    const promise = new Promise((res, rej) => {
        const resSubscription = msg => {

            if(msg.data.slice(0, 1) !== 'a') { return }
            const data = JSON.parse(msg.data.slice(1))

            let datas = []
            data.forEach(item => {
                if(item.i === id) {
                    ws.removeEventListener('message', resSubscription)
                    res(item.d)
                }
            })
            // res(datas)
        } 
        console.log(ws.listeners('message'))
        console.log(ws.listeners('close'))
        ws.addEventListener('message', resSubscription)
    })
    this.ws.send(`${url}\n${id}\n${query}\n${JSON.stringify(body)}`)
    return promise
}

TradovateSocket.prototype.synchronize = async function() {
    if(!this.ws || this.ws.readyState == 3 || this.ws.readyState == 2) {
        console.warn('no websocket connection available, please connect the websocket and try again.')
        return
    }
    return await this.request({
        url: 'user/syncrequest',
        body: { users: [parseInt(process.env.USER_ID, 10)] }
    })
}

/**
 * Set a function to be called when the socket synchronizes.
 */
TradovateSocket.prototype.onSync = function(callback, fields) {
    this.ws.addEventListener('message', async msg => {
        const { data } = msg
        const kind = data.slice(0,1)
        switch(kind) {
            case 'a':
                const  [...parsedData] = JSON.parse(msg.data.slice(1))
                // console.log(parsedData)
                let schemaOk = {}
                const schemafields = fields || ['users']
                parsedData.forEach(data => {
                    schemafields.forEach(k => {
                        if(schemaOk && !schemaOk.value) {
                            return
                        }
                        if(Object.keys(data.d).includes(k) && Array.isArray(data.d[k])) {
                            schemaOk = { value: true }
                        } 
                        // else {
                        //     schemaOk = { value: false }
                        // }
                    })
                    
                    if(schemaOk.value) {
                        callback(data.d)
                    }
                })
                break
            default:
                break
        }
    })
}

TradovateSocket.prototype.connect = async function(url) {
    if(!this.ws || this.ws.readyState == 3 || this.ws.readyState == 2) {
        this.ws = new WebSocket(url)
    }

    let interval

    return new Promise((res, rej) => {
        this.ws.addEventListener('message', async msg => {
            const { type, data } = msg
            const kind = data.slice(0,1)
            if(type !== 'message') {
                console.log('non-message type received')
                return
            }
        
            //message discriminator
            switch(kind) {
                case 'o':      
                    // console.log('Making WS auth request...')
                    const token = this.constructor.name === 'TradovateSocket' ? process.env.ACCESS_TOKEN : process.env.MD_ACCESS_TOKEN
                    this.ws.send(`authorize\n0\n\n${token}`)          
                    interval = setInterval(() => {
                        if(this.ws.readyState == 3 || this.ws.readyState == 2) {
                            clearInterval(interval)
                            return
                        }
                        // console.log('sending response heartbeat...')
                        this.ws.send('[]')
                    }, 2500)
                    break
                case 'h':
                    // console.log('receieved server heartbeat...')
                    break
                case 'a':
                    const parsedData = JSON.parse(msg.data.slice(1))
                    const [first] = parsedData
                    if(first.i === 0 && first.s === 200) {
                        res()
                    } else rej()
                    break
                case 'c':
                    console.log('closing websocket')
                    clearInterval(interval)
                    break
                default:
                    console.error('Unexpected response token received:')
                    console.error(msg)
                    break
            }
        })
    })    
}

TradovateSocket.prototype.disconnect = function() {
    console.log('closing websocket connection')
    this.ws.close(1000, `Client initiated disconnect.`)
}

TradovateSocket.prototype.isConnected = function() {
    return this.ws && this.ws.readyState != 2 && this.ws.readyState != 3
}

module.exports = { TradovateSocket }