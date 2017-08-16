'use strict'

const {
  getKeys,
  makeKeyPair,
  saveKeys,
  getState,
  submitUpdate
} = require('./state')

saveKeys([makeKeyPair()])
console.log(getKeys())
submitUpdate(
  {action: 'create', asset: 'foo' + Date.now()},
  getKeys()[0].private,
  success => getState(data => console.log(data))
)
