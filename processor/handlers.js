'use strict'

const { createHash } = require('crypto')
const { TransactionHandler } = require('sawtooth-sdk/processor')
const { InvalidTransaction } = require('sawtooth-sdk/processor/exceptions')
const { TransactionHeader } = require('sawtooth-sdk/protobuf')

var eccrypto = require("eccrypto");

//const prompt = require('prompt-sync')();

// const readline = require('readline').createInterface({
//   input: process.stdin,
//   output: process.stdout
// });

// Encoding helpers and constants (Encoding function)
const getAddress = (key, length = 64) => {
  return createHash('sha512').update(key).digest('hex').slice(0, length)
}



const FAMILY = 'transfer-chain'
const PREFIX = getAddress(FAMILY, 6)

//address pointing to where the asset and its respective owner is stored
const getAssetAddress = name => PREFIX + '00' + getAddress(name, 62)

//same as above but here the asset is being transferred
const getTransferAddress = asset => PREFIX + '01' + getAddress(asset, 62)

//parameter generation function f
const getAssetParameters = (asset, owner) => {
  var nonce = require('crypto').randomBytes(16).toString('base64');
  const parameters = String(getAddress(asset, 62)+String(owner)+nonce); 
  return parameters;
} 


const encode = obj => Buffer.from(JSON.stringify(obj, Object.keys(obj).sort()))
const decode = buf => JSON.parse(buf.toString())





// Add a new asset to state
const createAsset = (asset, owner,  state) => 
{
  const address = getAssetAddress(asset)
  

  return state.get([address])
    .then(entries => {
      const entry = entries[address]
      if (entry && entry.length > 0) {
        throw new InvalidTransaction('Device name in use')
      }
      console.log('Device Created. \nDefault Device Parameters: ')
      // new parameters generated for the device
      console.log(getAssetParameters(asset)) 
      return state.set({
        [address]: encode({name: asset, owner}) // this address maps to device and owner
      })
    })
}


// Add a new transfer to state
const transferAsset = (asset, owner, signer, state) => {
  
  const assetAddress = getAssetAddress(asset) 
  const address = getTransferAddress(asset)

  return state.get([assetAddress])
    .then(entries => {
      const entry = entries[assetAddress]
      if (!entry || entry.length === 0) {
        throw new InvalidTransaction('Asset does not exist')
      }

      if (signer !== decode(entry).owner) {
        throw new InvalidTransaction('Only an Asset\'s owner may transfer it')
      }
      console.log("Initiating transfer");


      return state.set({

        //this address points to a state change where the asset is being transferred by its owner
        [address]: encode({asset, owner}) 
      })
    })
}

// Accept a transfer, clearing it and changing asset ownership
const acceptTransfer = (asset, signer, state) => {
  const address = getTransferAddress(asset)
  const parameters = getAssetParameters(asset)

  return state.get([address])
    .then(entries => {
      const entry = entries[address]
      if (!entry || entry.length === 0) {
        throw new InvalidTransaction('Asset is not being transfered')
      }

      if (signer !== decode(entry).owner) {
        throw new InvalidTransaction(
          'Transfers not initiated by previous owner'
        )
      }

      console.log('transferring parameters')

      var privateKeyBuyer = eccrypto.generatePrivate();
      var publicKeyBuyer = eccrypto.getPublic(privateKeyBuyer);

      // Encrypting the message for Buyer.
      eccrypto.encrypt(publicKeyBuyer, parameters).then(function(encrypted) {
      // Buyer decrypting the message.
      eccrypto.decrypt(privateKeyBuyer, encrypted).then(function(plaintext) {
      console.log("Parameters:", plaintext.toString());
    });
  });

      return state.set({
        // the address pointing to the asset that was being transferred now points to nothing since the transfer has been accepted
        [address]: Buffer(0),  
        // new address of asset with new owner
        [getAssetAddress(asset)]: encode({name: asset, owner: signer}) 
      })
    })
}

//bootstrapping function

const bootstrap = (asset, signer, state) => { 

  const assetAddress = getAssetAddress(asset)
  console.log("Broadcasting Bootstrapping Network")
  return state.get([assetAddress])
    .then(entries => {
      const entry = entries[assetAddress]

      //matches the signature of the record of acceptance with the device's owner

      if (signer !== decode(entry).owner) {
        throw new InvalidTransaction('Only Device\'s owner may bootstrap it')
      }
      console.log("Secure Bootstrapping Network Established");
    })
}



// Reject a transfer, clearing it
const rejectTransfer = (asset, signer, state) => {
  const address = getTransferAddress(asset)

  return state.get([address])
    .then(entries => {
      const entry = entries[address]
      if (!entry || entry.length === 0) {
        throw new InvalidTransaction('Asset is not being transfered')
      }

      if (signer !== decode(entry).owner) {
        throw new InvalidTransaction(
          'Transfers can only be rejected by the potential new owner')
      }
      // the address pointing to the asset that was being transferred now points to nothing since the transfer has been rejected
      return state.set({
        [address]: Buffer(0)
      })
    })
}




// Handler for JSON encoded payloads
class JSONHandler extends TransactionHandler {
  constructor () {
    console.log('Initializing JSON handler for Transfer-Chain')
    super(FAMILY, '0.0', 'application/json', [PREFIX])
  }

  apply (txn, state) {
    // Parse the transaction header and payload
    const header = TransactionHeader.decode(txn.header)
    const signer = header.signerPubkey  
    const { action, asset, owner } = JSON.parse(txn.payload)

    // Call the appropriate function based on the payload's action
    console.log(`Handling transaction:  ${action} > ${asset}`,
                owner ? `> ${owner.slice(0, 8)}... ` : '',
                `:: ${signer.slice(0, 8)}...`)

    if (action === 'create') return createAsset(asset, signer, state)
    if (action === 'transfer') return transferAsset(asset, owner, signer, state)
    if (action === 'accept') return acceptTransfer(asset, signer, state)
    if (action === 'reject') return rejectTransfer(asset, signer, state)
    if (action === 'bootstrap') return bootstrap(asset, signer, state)

    return Promise.resolve().then(() => {
      throw new InvalidTransaction(
        'Action must be "create", "transfer", "accept", or "reject"'
      )
    })
  }
}

module.exports = {
  JSONHandler
}


