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

test('parse() good cases', (t) => {
  const commands = plugin.parse(
    'ppppp://invite/join/HOST/PORT/PUBKEY/TOKEN/follow/ALICE/promise.follow/identity.ALICE/ALICE_TOKEN'
  )
  assert.deepEqual(commands, [
    {
      type: 'join',
      address: 'net:HOST:PORT~shse:PUBKEY.TOKEN',
    },
    {
      type: 'follow',
      id: 'ALICE',
    },
    {
      type: 'promise.follow',
      issuerType: 'identity',
      issuer: 'ALICE',
      token: 'ALICE_TOKEN',
    },
  ])
})
