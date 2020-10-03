const parentModule = require('bluetooth-serial-port')
const EventEmitter = require('events')

function bufferToAsciiEscaped(buffer) {
  let ascii = ''
  for (const char in buffer) {
    if (char === 0x00) ascii += '\\0'
    if (char === 0x08) ascii += '\\b'
    if (char === 0x09) ascii += '\\t'
    if (char === 0x0a) ascii += '\\n'
    if (char === 0x0b) ascii += '\\v'
    if (char === 0x0c) ascii += '\\f'
    if (char === 0x0d) ascii += '\\r'
    if (char === 0x5c) ascii += '\\\\'
    if (char >= 0x20 && char <= 0x7e) ascii += String.fromCharCode(char)
    ascii += hex.toString(16).padStart(2, '0')
  }
  return ascii
}

class BluetoothMITM extends EventEmitter {
  constructor() {
    super()
    this._dataLoggerEnabled = true
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

module.exports = { BluetoothMITM }
