const parentModule = require('bluetooth-serial-port')
const EventEmitter = require('events')

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
        console.log('host : ' + data)
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
        console.log('slave: ' + data)
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
  _findSerialPortChannel(address) {
    return new Promise((ok, fail) => {
      this.client.findSerialPortChannel(address, channel => {
        ok(channel)
      }, () => {
        fail(new Error('Unable to find serial port channel'))
      })
    })
  }
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
  /*isOpen() {
    return this.client.isOpen()
  }*/
  listPairedDevices() {
    return new Promise(ok => {
      this.client.listPairedDevices(pairedDevices => {
        ok(pairedDevices)
      })
    })
  }
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
      this.server.listen(function(clientAddress) {
        ok(clientAddress)
      }, function(error) {
        fail(error)
      }, options);
    })
  }
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
