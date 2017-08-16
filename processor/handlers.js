'use strict'

const { createHash } = require('crypto')
const { TransactionHandler } = require('sawtooth-sdk/processor')
const { InvalidTransaction } = require('sawtooth-sdk/processor/exceptions')
const { TransactionHeader } = require('sawtooth-sdk/protobuf')

// Encoding helpers and constants
const getAddress = (key, length = 64) => {
  return createHash('sha512').update(key).digest('hex').slice(0, length)
}

const FAMILY = 'transfer-chain'
const PREFIX = getAddress(FAMILY, 6)

const getAssetAddress = name => PREFIX + '00' + getAddress(name, 62)
const encode = obj => Buffer.from(JSON.stringify(obj, Object.keys(obj).sort()))

// Add a new asset to state
const createAsset = (asset, owner, state) => {
  const address = getAssetAddress(asset)
  return state.set({[address]: encode({name: asset, owner})})
}

// Handler for JSON encoded payloads
class JSONHandler extends TransactionHandler {
  constructor () {
    super(FAMILY, '0.0', 'application/json', [PREFIX])
  }

  apply (txn, state) {
    // Parse the transaction header and payload
    const header = TransactionHeader.decode(txn.header)
    const signer = header.signerPubkey
    const { action, asset } = JSON.parse(txn.payload)

    // Call the appropriate function based on the payload's action
    if (action === 'create') return createAsset(asset, signer, state)

    return Promise.resolve().then(() => {
      throw new InvalidTransaction(
        'Action must be "create"'
      )
    })
  }
}

module.exports = {
  JSONHandler
}