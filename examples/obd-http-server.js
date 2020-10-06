const { BluetoothToHttpServer } = require('bt-serial-mitm')

const server = new BluetoothToHttpServer({ host: '0.0.0.0' })
