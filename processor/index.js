'use strict'

const { TransactionProcessor } = require('sawtooth-sdk/processor')
const VALIDATOR_URL = 'tcp://localhost:4004'

// Initialize Transaction Processor
const tp = new TransactionProcessor(VALIDATOR_URL)
tp.start()
