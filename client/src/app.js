'use strict'

const {
  getKeys,
  makeKeyPair,
  saveKeys,
  getState,
  submitUpdate
} = require('./state')

// Application Object
const app = { user: null, keys: [], assets: [], transfers: [] }

app.refresh = function () {
  getState(({ assets, transfers }) => {
    this.assets = assets
    this.transfers = transfers
  })
}

app.update = function (action, asset, owner) {
  if (this.user) {
    submitUpdate(
      { action, asset, owner },
      this.user.private,
      success => success ? this.refresh() : null
    )
  }
}

saveKeys([makeKeyPair()])
app.keys = getKeys()
app.user = app.keys[0]
app.update('create', 'foo' + Date.now())
