'use strict'

const {
  getKeys,
  makeKeyPair,
  saveKeys,
  getState
} = require('./state')

saveKeys([makeKeyPair()])
console.log(getKeys())
getState(data => console.log(data))
