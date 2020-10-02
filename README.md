# node-bt-serial-mitm

**This library was created to view the communication between a bluetooth device and an app on my smartphone connected to it. I am not responsible for any damage caused by malicious use of this library!**

NodeJS Library to perform a MITM attack for bluetooth serial port devices

## Dependencies

> bluetooth-serial-port

## Introduction

Bluetooth serial communication usually consists of a host and at least one slave.

For example, most car mechanics will use a device called an OBD reader. This allows the mechanic to see more info about the car's performance and view codes causing the "Check Engine Light". A lot of OBD readers take advantage of bluetooth, which means the mechanic can use their smartphone or tablet to connect to the car.

Traditionally, if you wanted to understand the data that is being sent between the smartphone and the OBD reader, you would have to learn about the ELM327 protocol and go through many, many pages of documentation. But this library will allow you to see the communication in real-time.

This library uses the term *"slave"* and *"host"*. In the above scenario, your smartphone would be the *"slave"*. And your bluetooth device would be the *"host"*.

## Usage

Construct a new BluetoothMITM object and connect to your host (aka, your bluetooth device).

```js
mitm = new (require('bt-serial-mitm')).BluetoothMITM
mitm.connect('01:23:45:67:89:AB')
```

Start the server

```js
mitm.listen()
```

On your actual client (ex: smartphone), instead of connecting to the actual bluetooth device, connect to the computer that this script is running on. You may have to pair your phone with the computer before connecting to it.

After your smartphone is connected to the computer, you should start seeing logs in the terminal that look like this.

```
slave: ATZ\r\n
host : OK\r\n
```

For example, if your smartphone is connecting to an OBD reader in your car, then your smartphone is the `slave` and your OBD reader is the `host`.
