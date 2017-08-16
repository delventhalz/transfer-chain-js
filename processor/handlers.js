'use strict'

const { createHash } = require('crypto')
const { TransactionHandler } = require('sawtooth-sdk/processor')
const { InvalidTransaction } = require('sawtooth-sdk/processor/exceptions')

const FAMILY = 'transfer-chain'
const PREFIX = createHash('sha512').update(FAMILY).digest('hex').slice(0, 6)

// Handler for JSON encoded payloads
class JSONHandler extends TransactionHandler {
  constructor () {
    super(FAMILY, '0.0', 'application/json', [PREFIX])
  }

  apply (txn, state) {
    return Promise.resolve().then(() => {
      throw new InvalidTransaction(
        "I don't know how to handle any transactions!"
      )
    })
  }
}

module.exports = {
  JSONHandler
}
