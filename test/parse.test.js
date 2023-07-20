const test = require('node:test')
const assert = require('node:assert')
const plugin = require('../lib/index')

test('parse() error cases', (t) => {
  assert.throws(() => {
    plugin.parse('ssb://invite/join/HUB_ADDR/HUB_PUBKEY/HUB_TOKEN')
  })
  assert.throws(() => {
    plugin.parse('ppppp:invite')
  })
  assert.throws(() => {
    plugin.parse('ppppp:invite/join/HUB_ADDR')
  })
})

test('parse() good friend invite', (t) => {
  const commands = plugin.parse(
    'ppppp://invite/join/HOST/PORT/PUBKEY/TOKEN/follow/ALICE/promise.follow/identity.ALICE/ALICE_TOKEN'
  )
  assert.deepEqual(commands, [
    {
      type: 'join',
      address: 'net:HOST:PORT~shse:PUBKEY:TOKEN',
    },
    {
      type: 'follow',
      id: 'ALICE',
    },
    {
      type: 'promise.follow',
      issuerID: 'ALICE',
      token: 'ALICE_TOKEN',
    },
  ])
})

test('parse() good myself invite', (t) => {
  const commands = plugin.parse(
    'ppppp://invite/join/HOST/PORT/PUBKEY/TOKEN/tunnel-connect/HUB_PUBKEY/OLD_PUBKEY/promise.identity-add/identity.IDENTITY_ID/OLD_TOKEN'
  )
  assert.deepEqual(commands, [
    {
      type: 'join',
      address: 'net:HOST:PORT~shse:PUBKEY:TOKEN',
    },
    {
      type: 'tunnel-connect',
      address: 'tunnel:HUB_PUBKEY:OLD_PUBKEY~shse:OLD_PUBKEY',
    },
    {
      type: 'promise.identity-add',
      issuerID: 'IDENTITY_ID',
      token: 'OLD_TOKEN',
    },
  ])
})

