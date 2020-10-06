const parentModule = require('bluetooth-serial-port')
const EventEmitter = require('events')
let express
let ws

function bufferToAsciiEscaped(buffer) {
  let ascii = ''
  for (const char of buffer) {
    if (char === 0x00) ascii += '\\0'
    else if (char === 0x08) ascii += '\\b'
    else if (char === 0x09) ascii += '\\t'
    else if (char === 0x0a) ascii += '\\n'
    else if (char === 0x0b) ascii += '\\v'
    else if (char === 0x0c) ascii += '\\f'
    else if (char === 0x0d) ascii += '\\r'
    else if (char === 0x5c) ascii += '\\\\'
    else if (char >= 0x20 && char <= 0x7e) ascii += String.fromCharCode(char)
    else ascii += char.toString(16).padStart(2, '0')
  }
  return ascii
}

class BluetoothMITM extends EventEmitter {
  constructor() {
    super()
    this._dataLoggerEnabled = true
    this._init()
  }
  disableLogger() {
    this._dataLoggerEnabled = false
  }
  enableLogger() {
    this._dataLoggerEnabled = false
  }
  _init() {
    this.client = new parentModule.BluetoothSerialPort()
    this.client.on('closed', () => {
      this.emit('client.closed')
    })
    this.client.on('data', (data) => {
      this.emit('client.data', data)
      if (this._dataLoggerEnabled) {
        console.log('host : ' + bufferToAsciiEscaped(data))
      }
      this._writeToServer(data)
    })
    this.client.on('debug', () => {
      this.emit('client.debug')
    })
    this.client.on('disconnect', () => {
      this.emit('client.disconnect')
    })
    this.client.on('error', (error) => {
      this.emit('client.error', error)
    })
    this.client.on('failure', () => {
      this.emit('client.failure')
    })
    this.server = parentModule.BluetoothSerialPortServer()
    this.server.on('closed', () => {
      this.emit('server.closed')
    })
    this.server.on('data', (data) => {
      this.emit('server.data', data)
      if (this._dataLoggerEnabled) {
        console.log('slave: ' + bufferToAsciiEscaped(data))
      }
      this._writeToClient(data)
    })
    this.server.on('disconnected', () => {
      this.emit('server.disconnected')
    })
    this.server.on('error', (error) => {
      this.emit('server.error', error)
    })
    this.server.on('failure', () => {
      this.emit('server.failure')
    })
  }
  /**
   * @async
   */
  inquire() {
    return new Promise(ok => {
      const devices = []
      const found = (address, name) => {
        devices.push({
          address: address,
          name: name
        })
      }
      const finished = () => {
        this.client.removeListener('found', found)
        this.client.removeListener('finished', finished)
        this.nearby = devices
        ok(devices)
      }
      this.client.on('found', found)
      this.client.on('finished', finished)
      this.client.inquire()
    })
  }
  /**
   * @async
   */
  autoconnect(query) {
    const search = new RegExp(query.replace(/\W/g, ''), 'gi')
    return new Promise((ok, fail) => {
      const found = (address, name) => {
        if (
          !query ||
          address.replace(/\W/g, '').search(search) !== -1 ||
          name.replace(/\W/g, '').search(search) !== -1
        ) {
          this.client.removeListener('finished', finished)
          this.client.removeListener('found', found)
          this.client.findSerialPortChannel(address, channel => {
            this.client.connect(address, channel, () => {
              this.clientName = name
              this.clientAddress = address
              this.clientChannel = channel
              ok()
            }, error => {
              fail(error)
            })
          }, () => {
            fail(new Error('Unable to find serial port channel'))
          })
        }
      }
      const finished = () => {
        this.client.removeListener('finished', finished)
        this.client.removeListener('found', found)
        fail(new Error('No matching devices found to autoconnect to.'))
      }
      this.client.on('found', found)
      this.client.on('finished', finished)
      this.client.inquire()
    })
  }
  /**
   * @async
   */
  _findSerialPortChannel(address) {
    return new Promise((ok, fail) => {
      this.client.findSerialPortChannel(address, channel => {
        ok(channel)
      }, () => {
        fail(new Error('Unable to find serial port channel'))
      })
    })
  }
  /**
   * @async
   */
  connect(address, channel) {
    return new Promise(async (ok, fail) => {
      try {
        if (channel === undefined) {
          channel = await this._findSerialPortChannel(address)
        }
        this.client.connect(address, channel, () => {
          this.address = address
          this.channel = channel
          ok()
        }, error => {
          fail(error)
        })
      } catch (error) {
        fail(error)
      }
    })
  }
  disconnectClient() {
    this.client.close()
  }
  close() {
    this.server.disconnectClient()
    this.server.close()
    this.client.close()
    this._init()
  }
  /**
   * @async
   */
  listPairedDevices() {
    return new Promise(ok => {
      this.client.listPairedDevices(pairedDevices => {
        ok(pairedDevices)
      })
    })
  }
  /**
   * @async
   */
  listen(a, b) {
    var options = {}
    if (a && a.constructor === Object) {
      Object.assign(options, a)
    }
    if (typeof a === 'number') {
      options.channel = a
    } else if (typeof a === 'string') {
      options.uuid = a
    }
    if (typeof b === 'number') {
      options.channel = b
    } else if (typeof b === 'string') {
      options.uuid = b
    }
    return new Promise((ok, fail) => {
      this.server.listen(clientAddress => {
        this.emit('server.newclient', clientAddress)
        ok(clientAddress)
      }, function(error) {
        fail(error)
      }, options);
    })
  }
  /**
   * @async
   */
  _writeToClient(buffer) {
    if (typeof buffer === 'string') {
      buffer = Buffer.from(buffer, 'utf8')
    }
    return new Promise((ok, fail) => {
      this.client.write(buffer, (error, bytesWritten) => {
        if (error) {
          fail(error)
        } else {
          ok()
        }
      })
    })
  }
  /**
   * @async
   */
  _writeToServer(buffer) {
    if (typeof buffer === 'string') {
      buffer = Buffer.from(buffer, 'utf8')
    }
    return new Promise((ok, fail) => {
      this.server.write(buffer, (error, bytesWritten) => {
        if (error) {
          fail(error)
        } else {
          ok()
        }
      })
    })
  }
}

class BluetoothToHttpServer extends EventEmitter {
  constructor(config) {
    super()
    let port = 8080
    let host = undefined
    if (config) {
      if (config.port) {
        port = config.port
      }
      if (config.host) {
        host = config.host
      }
    }
    if (express === undefined) {
      express = require('express')
    }
    if (ws === undefined) {
      ws = require('ws')
    }
    this.app = express()
    this.wsServer = new ws.Server({ noServer: true })
    this._wsConnections = []
    this.wsServer.on('connection', this._onWsConnection.bind(this))

    this.server = this.app.listen(port, host)
    this.server.on('upgrade', (request, socket, head) => {
      this.wsServer.handleUpgrade(request, socket, head, socket => {
        this.wsServer.emit('connection', socket, request)
      })
    })

    this.app.get('/lib.js', (req, res) => {
      res.send(`
function _getsocket(cb) {
  if (window._ws !== undefined) {
    if (window._ws.readyState === WebSocket.OPEN) {
      cb(window._ws);
      return;
    }
    if (window._ws.readyState === WebSocket.CONNECTING) {
      window._ws.onopen = function() {
        cb(window._ws);
      };
      return;
    }
  }
  window._ws = new WebSocket('ws://' + window.location.host);
  window._ws.onmessage = function(event) {
    try {
      msg = event.data;
      json = JSON.parse(msg);
      console.log(json);
    } catch (error) {
      console.error(error);
    }
  };
  if (window._ws.readyState !== WebSocket.OPEN) {
    window._ws.onopen = function() {
      cb(window._ws);
    };
  } else {
    cb(window._ws);
  }
}

function autoconnect(query) {
  _getsocket(function(ws) {
    ws.send(JSON.stringify({ type: 'autoconnect', query: query }));
  });
}

function connect(address, channel) {
  _getsocket(function(ws) {
    ws.send(JSON.stringify({ type: 'connect', address: address, channel: channel }));
  });
}

function inquire(data) {
  _getsocket(function(ws) {
    ws.send(JSON.stringify({ type: 'inquire' }));
  });
}

function write(data) {
  _getsocket(function(ws) {
    ws.send(JSON.stringify({ type: 'write', data: data }));
  });
}

function disconnect() {
  _getsocket(function(ws) {
    ws.send(JSON.stringify({ type: 'disconnect' }));
  });
}

      `)
    })
    this.app.get('/', (req, res) => {
      res.send(`
<script type="text/javascript" src="/lib.js"></script>
Hello!
      `)
    })

    this._init()
  }
  _wsSend(connection, type, packet) {
    if (packet === undefined) {
      if (typeof type === 'string') {
        packet = { type }
      } else if (type instanceof Object) {
        packet = type
      } else {
        throw new Error('Expected first argument to be either an object or string')
      }
    } else {
      packet.type = type
    }
    const jsonText = JSON.stringify(packet)
    connection.send(jsonText)
  }
  _wsBroadcast(type, packet) {
    if (packet === undefined) {
      if (typeof type === 'string') {
        packet = { type }
      } else if (type instanceof Object) {
        packet = type
      } else {
        throw new Error('Expected first argument to be either an object or string')
      }
    } else {
      packet.type = type
    }
    const jsonText = JSON.stringify(packet)
    for (const connection of this._wsConnections) {
      connection.send(jsonText)
    }
  }
  _init() {
    this.client = new parentModule.BluetoothSerialPort()
    this.client.on('closed', () => {
      this._wsBroadcast('bt.closed')
      this.emit('bt.closed')
    })
    this.client.on('data', (data) => {
      this._wsBroadcast('bt.data', { data: bufferToAsciiEscaped(data) })
      this.emit('bt.data', data)
    })
    this.client.on('debug', () => {
      this._wsBroadcast('bt.debug')
      this.emit('bt.debug')
    })
    this.client.on('disconnect', () => {
      this._wsBroadcast('bt.disconnected')
      this.emit('bt.disconnect')
    })
    this.client.on('error', (error) => {
      this._wsBroadcast('bt.error', { error: error })
      this.emit('bt.error', error)
    })
    this.client.on('failure', () => {
      this._wsBroadcast('bt.failure')
      this.emit('bt.failure')
    })
  }
  _onWsConnection(socket) {
    this._wsConnections.push(socket)
    socket.on('message', async message => {
      try {
        const json = JSON.parse(message)
        if (!(json instanceof Object)) {
          this._wsSend(socket, 'formaterror', { msg: 'expected json object' })
          console.error('JSON message not an object!')
          console.debug('  Message:', message)
          return;
        }
        if (typeof json.type !== 'string') {
          this._wsSend(socket, 'formaterror', { msg: 'expected string key named "type"' })
          console.error('Expected message to have a string key named "type"')
          console.debug('  Message:', message)
          return;
        }

        if (json.type === 'inquire') {
          await this.inquire()
          return;
        }

        if (json.type === 'autoconnect') {
          let query = json.query
          if (typeof query !== 'string' && query !== undefined) {
            this._wsSend(socket, 'formaterror', { msg: 'expected key named "query" to be string or undefined' })
            console.error('Expected message to have a key named "query" which is either undefined or a string')
            console.debug('  Message:', message)
            return;
          }
          await this.autoconnect(query)
          return;
        }

        if (json.type === 'connect') {
          let address = json.address
          let channel = json.channel
          if (typeof address !== 'string' && address !== undefined) {
            this._wsSend(socket, 'formaterror', { msg: 'expected string key named "address"' })
            console.error('Expected message to have a string key named "address"')
            console.debug('  Message:', message)
            return;
          }
          if (typeof channel !== 'string' && typeof channel !== 'number' && channel !== undefined) {
            this._wsSend(socket, 'formaterror', { msg: 'expected key named "channel" to be string, number, or undefined' })
            console.error('Expected message to have a key named "channel" which is either a string, number, or undefined')
            console.debug('  Message:', message)
            return;
          }
          await this.connect(address, channel)
          return;
        }

        if (json.type === 'write') {
          const data = json.data
          if (typeof data !== 'string') {
            this._wsSend(socket, 'formaterror', { msg: 'expected string key named "data"' })
            console.error('Expected message to have a string key named "data"')
            console.debug('  Message:', message)
            return;
          }
          const buffer = Buffer.from(data)
          console.log('Sending data to bluetooth socket:', bufferToAsciiEscaped(buffer))
          await this._writeToClient(buffer)
          return;
        }

        if (json.type === 'disconnect') {
          this.close()
          return;
        }

        this._wsSend(socket, 'formaterror', { msg: 'message type not recongized' })
        console.error('Message "type" is not recongized! type=', json.type)
      } catch (error) {
        if (error && error.constructor === SyntaxError) {
          this._wsSend(socket, 'formaterror', { msg: 'invalid json' })
          console.error('Received invalid JSON:', error.message)
          console.debug('  Message:', message)
        } else {
          if (typeof error === 'string') {
            this._wsSend(socket, 'error', { error })
            console.error(error)
          } else {
            console.error('Error when receiving message:', error)
            console.debug('  Message:', message)
          }
        }
      }
    })
  }

  /**
   * @async
   */
  inquire() {
    return new Promise(ok => {
      const devices = []
      const found = (address, name) => {
        this._wsBroadcast('bt.found', { address, name })
        devices.push({
          address: address,
          name: name
        })
      }
      const finished = () => {
        this._wsBroadcast('bt.finished')
        this.client.removeListener('found', found)
        this.client.removeListener('finished', finished)
        this.nearby = devices
        ok(devices)
      }
      this.client.on('found', found)
      this.client.on('finished', finished)
      this.client.inquire()
    })
  }
  /**
   * @async
   */
  autoconnect(query) {
    if (query === undefined) query = ''
    const search = new RegExp(query.replace(/\W/g, ''), 'gi')
    return new Promise((ok, fail) => {
      const found = (address, name) => {
        this._wsBroadcast('bt.found', { address, name })
        if (
          !query ||
          address.replace(/\W/g, '').search(search) !== -1 ||
          name.replace(/\W/g, '').search(search) !== -1
        ) {
          this.client.removeListener('finished', finished)
          this.client.removeListener('found', found)
          this.client.findSerialPortChannel(address, channel => {
            this.client.connect(address, channel, () => {
              this._wsBroadcast('bt.connected')
              this.clientName = name
              this.clientAddress = address
              this.clientChannel = channel
              ok()
            }, error => {
              fail(error)
            })
          }, () => {
            fail(new Error('Unable to find serial port channel'))
          })
        }
      }
      const finished = () => {
        this._wsBroadcast('bt.finished')
        this.client.removeListener('finished', finished)
        this.client.removeListener('found', found)
        fail(new Error('No matching devices found to autoconnect to.'))
      }
      this.client.on('found', found)
      this.client.on('finished', finished)
      this.client.inquire()
    })
  }
  /**
   * @async
   */
  _findSerialPortChannel(address) {
    return new Promise((ok, fail) => {
      this.client.findSerialPortChannel(address, channel => {
        ok(channel)
      }, () => {
        ok(null)
      })
    })
  }
  /**
   * @async
   */
  connect(address, channel) {
    return new Promise(async (ok, fail) => {
      try {
        if (channel === undefined) {
          channel = await this._findSerialPortChannel(address)
          if (channel === null) {
            return fail('Unable to find serial port channel')
          }
        }
        this.client.connect(address, channel, () => {
          this._wsBroadcast('bt.connected')
          this.address = address
          this.channel = channel
          ok()
        }, error => {
          fail(error)
        })
      } catch (error) {
        fail(error)
      }
    })
  }
  close() {
    this.client.close()
    this._init()
  }
  /**
   * @async
   */
  listPairedDevices() {
    return new Promise(ok => {
      this.client.listPairedDevices(pairedDevices => {
        ok(pairedDevices)
      })
    })
  }
  /**
   * @async
   */
  _writeToClient(buffer) {
    if (typeof buffer === 'string') {
      buffer = Buffer.from(buffer, 'utf8')
    }
    return new Promise((ok, fail) => {
      try {
        this.client.write(buffer, (error, bytesWritten) => {
          if (bytesWritten !== buffer.length) {
            return fail('Unable to write full message')
          }
          if (error) {
            fail(error)
          } else {
            ok()
          }
        })
      } catch (error) {
        fail(error)
      }
    })
  }
}

module.exports = { BluetoothMITM, BluetoothToHttpServer }
