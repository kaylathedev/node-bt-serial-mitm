const { BluetoothMITM } = require('bt-serial-mitm')

const mitm = new(require('bt-serial-mitm'))

async function main() {
  await mitm.autoconnect('obd')
  mitm.on('server.newclient', address => {
    console.log('New connection: ' + address)
  })
  mitm.listen()
}
main()
