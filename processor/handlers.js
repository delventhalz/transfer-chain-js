'use strict'

const { createHash } = require('crypto')
const { TransactionHandler } = require('sawtooth-sdk/processor')
const { InvalidTransaction } = require('sawtooth-sdk/processor/exceptions')
const { TransactionHeader } = require('sawtooth-sdk/protobuf')

var eccrypto = require("eccrypto");

//const prompt = require('prompt-sync')();

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

// Encoding helpers and constants
const getAddress = (key, length = 64) => {
  return createHash('sha512').update(key).digest('hex').slice(0, length)
}



const FAMILY = 'transfer-chain'
const PREFIX = getAddress(FAMILY, 6)

const getAssetAddress = name => PREFIX + '00' + getAddress(name, 62)
const getTransferAddress = asset => PREFIX + '01' + getAddress(asset, 62)
const getAssetParameters = asset => String(PREFIX + '02' + getAddress(asset, 62)) //trying to generate unique parameters  for each device

const encode = obj => Buffer.from(JSON.stringify(obj, Object.keys(obj).sort()))
const decode = buf => JSON.parse(buf.toString())

/* const {
  //makeKeyPair2,
  eciesTransfer
} = require('./encTransfer')//new
 */



// Add a new asset to state
const createAsset = (asset, owner,  state) => {
  const address = getAssetAddress(asset)
  //console.log('The asset parameters:')
  //console.log(getAssetParameters(asset))
  
  //console.log(typeof parameters)
  

  return state.get([address])
    .then(entries => {
      const entry = entries[address]
      if (entry && entry.length > 0) {
        throw new InvalidTransaction('Asset name in use')
      }

      return state.set({
        [address]: encode({name: asset, owner})
      })
    })
}


// Add a new transfer to state
const transferAsset = (asset, owner, signer, state) => {
  const address = getTransferAddress(asset)
  const assetAddress = getAssetAddress(asset)
  //const parameters = getAssetParameters(asset)

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
          'Transfers can only be accepted by the new owner'
        )
      }

      //const transferKeys = makeKeyPair2()
      // const output = eciesTransfer(parameters/* , transferKeys.receiverPublicKey, transferKeys.receiverPrivateKey */)
      // console.log(output);

      

      var privateKeyB = eccrypto.generatePrivate();
      var publicKeyB = eccrypto.getPublic(privateKeyB);

    // Encrypting the message for B.
      eccrypto.encrypt(publicKeyB, parameters).then(function(encrypted) {
        // B decrypting the message.
        eccrypto.decrypt(privateKeyB, encrypted).then(function(plaintext) {
          console.log("Parameters:", plaintext.toString());
        });
      });


      readline.question('Do you want to bootstrap the device?(y/n)', bs => {
        if(bs == 'n'){
          // throw new InvalidTransaction(
          //   'Bootstrapping cancelled')
            console.log('Bootstrapping cancelled')
        }
        else{
          console.log('Device Bootstrapped')
        }
        readline.close();
      });

      // const bs = prompt('Do you want to bootstrap the device?(y/n)');
      //   if(bs == 'n'){
      //     throw new InvalidTransaction(
      //       'Bootstrapping cancelled')
      //   }
      //   console.log('Device Bootstrapped')

      return state.set({
        [address]: Buffer(0),
        [getAssetAddress(asset)]: encode({name: asset, owner: signer})
      })
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

      return state.set({
        [address]: Buffer(0)
      })
    })
}

// const bootstrap = (/* asset, */ signer, state) => {
//   //const parameters = getAssetParameters(asset)
  
//   return state.get([address])
//     .then(entries => {
//       const entry = entries[address]

//       if (signer !== decode(entry).owner) {
//         throw new InvalidTransaction(
//           'Only the owner can initiate bootstrapping')
//       }
//       // if (parameters !== decode(entry).parameters) {
//       //   throw new InvalidTransaction(
//       //     'parameters do not match the ones in records')
//       // }

//       return state.set({
//         [address]: Buffer(0)
//       })
//     })
// }


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
