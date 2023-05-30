'use strict'

const { createHash } = require('crypto')
const { TransactionHandler } = require('sawtooth-sdk/processor')
const { InvalidTransaction } = require('sawtooth-sdk/processor/exceptions')
const { TransactionHeader } = require('sawtooth-sdk/protobuf')
//const { eccryptoencryption } = require('eccryptojs')
//var crypto = require("crypto");
var eccrypto = require("eccrypto");
//import * as eccrypto from 'eccrypto-js';


// const encryptParameters = (receiverPublicKey, parameters) => {
//   return eccrypto.encrypt(receiverPublicKey, Buffer.from(parameters))
//   //console.log(eccrypto.encrypt(receiverPublicKey, Buffer.from(parameters)))
// }


const encryptParameters = (receiverPublicKey, parameters) => {
  return eccrypto.encrypt(receiverPublicKey, Buffer.from(parameters))
    .then((encryptedData) => {
      // Handle successful encryption
      return encryptedData;
    })
    .catch((error) => {
      // Handle promise rejection (error)
      console.error('Encryption failed:', error);
      throw error; // Optional: rethrow the error to propagate it further
    });
};


// const encryptParameters = (receiverPublicKey, parameters).then(result => {
//   ressult = eccrypto.encrypt(receiverPublicKey, Buffer.from(parameters));
//   return result;
// })


const decryptParameters = (receiverPrivateKey, encryptedParameters) => {
  return eccrypto.decrypt(receiverPrivateKey, encryptedParameters)
  //console.log(eccrypto.decrypt(receiverPrivateKey, encryptedParameters))
}


// Encoding helpers and constants
const getAddress = (key, length = 64) => {
  return createHash('sha512').update(key).digest('hex').slice(0, length)
}


//Signing key pair
//var senderPrivateKey2 = eccrypto.generatePrivate();
//var senderPublicKey2 = eccrypto.getPublic(senderPrivateKey2);

//var receiverPrivateKey2 = eccrypto.generatePrivate();
//var receiverPublicKey2 = eccrypto.getPublic(receiverPrivateKey2);


// Encrypted and signed transfer of parameters
// const ecc = (receiverPublicKey, receiverPrivateKey, param = 'passphrase') => {
//   const msg = eccrypto.encrypt(receiverPublicKey, Buffer.from(param)).then(function(encrypted) {
//     // B decrypting the message.
//     eccrypto.decrypt(receiverPrivateKey, encrypted).then(function(plaintext) {
//       console.log("Message to receiver:", plaintext.toString());
//     });
//   });
//   eccrypto.sign(senderPrivateKey2, msg).then(function(sig) {
//     console.log("Signature in DER format:", sig);
//     eccrypto.verify(senderPublicKey2, msg, sig).then(function() {
//       console.log("Signature is OK");
//     }).catch(function() {
//       console.log("Signature is BAD");
//     });
//   });
// }


//eccrypto functions for the transfer

const signMessage = (senderSigningKey, msg) => {
  return eccrypto.sign(senderSigningKey, msg)
}

const verifySignature = (senderVerificationKey, msg, sig) => {
  return eccrypto.verify(senderVerificationKey, msg, sig)
}


const FAMILY = 'transfer-chain'
const PREFIX = getAddress(FAMILY, 6)

const getAssetAddress = name => PREFIX + '00' + getAddress(name, 62)
const getTransferAddress = asset => PREFIX + '01' + getAddress(asset, 62)
const getAssetParameters = param => PREFIX + '02' + getAddress(param, 62) //trying to generate unique parameters  for each device

const encode = obj => Buffer.from(JSON.stringify(obj, Object.keys(obj).sort()))
const decode = buf => JSON.parse(buf.toString())



// Add a new asset to state
const createAsset = (asset, owner, state) => {
  const address = getAssetAddress(asset)
  const parameters = getAssetParameters(asset)
  //console.log(parameters) //see what's generated
  const encryptedParameters = encryptParameters(owner, parameters)

  return state.get([address])
    .then(entries => {
      const entry = entries[address]
      if (entry && entry.length > 0) {
        throw new InvalidTransaction('Asset name in use')
      }

      return state.set({
        [address]: encode({name: asset, owner, encryptedParameters})
      })
    })
}


// Add a new transfer to state
const transferAsset = (asset, owner, signer, encryptedParameters, state) => {
  const address = getTransferAddress(asset)
  const assetAddress = getAssetAddress(asset)
  const parameters = decryptParameters(owner, encryptedParameters)

  return state.get([assetAddress])
    .then(entries => {
      const entry = entries[assetAddress]
      if (!entry || entry.length === 0) {
        throw new InvalidTransaction('Asset does not exist')
      }

      if (signer !== decode(entry).owner) {
        throw new InvalidTransaction('Only an Asset\'s owner may transfer it')
      }

      const reencryptedParameters = encryptParameters(owner, parameters)


      return state.set({
        [address]: encode({asset, owner, reencryptedParameters})
      })
    })
}

// Accept a transfer, clearing it and changing asset ownership
const acceptTransfer = (asset, signer, state) => {
  const address = getTransferAddress(asset)

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
    const { action, asset, owner, encryptedParameters } = JSON.parse(txn.payload)

    // Call the appropriate function based on the payload's action
    console.log(`Handling transaction:  ${action} > ${asset}`,
                owner ? `> ${owner.slice(0, 8)}... ` : '',
                `:: ${signer.slice(0, 8)}...`)

    if (action === 'create') return createAsset(asset, signer, state)
    if (action === 'transfer') return transferAsset(asset, owner, signer, encryptedParameters, state)
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
