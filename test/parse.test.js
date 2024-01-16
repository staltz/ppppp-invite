const test = require('node:test')
const assert = require('node:assert')
const plugin = require('../lib/index')

test('parse() error cases', (t) => {
  assert.throws(() => {
    plugin.parse('ssb://invite/join/ip4/127.0.0.1/tcp/HUB_PUBKEY/HUB_TOKEN')
  })
  assert.throws(() => {
    plugin.parse('ppppp:invite')
  })
  assert.throws(() => {
    plugin.parse('ppppp:invite/join/ip4/127.0.0.1')
  })
})

test('parse() good friend invite', (t) => {
  const commands = plugin.parse(
    'ppppp://invite/join/dns/example.com/tcp/8080/shse/PUBKEY.TOKEN/follow/ALICE/promise.follow/account.ALICE/ALICE_TOKEN'
  )
  assert.deepEqual(commands, [
    {
      type: 'join',
      multiaddr: '/dns/example.com/tcp/8080/shse/PUBKEY.TOKEN',
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
    'ppppp://invite/join/dns/example.com/tcp/8080/shse/PUBKEY.TOKEN/tunnel-connect/HUB_PUBKEY/OLD_PUBKEY/promise.account-add/account.ACCOUNT_ID/OLD_TOKEN'
  )
  assert.deepEqual(commands, [
    {
      type: 'join',
      multiaddr: '/dns/example.com/tcp/8080/shse/PUBKEY.TOKEN',
    },
    {
      type: 'tunnel-connect',
      multiaddr: '/tunnel/HUB_PUBKEY.OLD_PUBKEY/shse/OLD_PUBKEY',
    },
    {
      type: 'promise.account-add',
      issuerID: 'ACCOUNT_ID',
      token: 'OLD_TOKEN',
    },
  ])
})

test('parse() good tokenless join invite', (t) => {
  const commands = plugin.parse(
    'ppppp://invite/join/dns/example.com/tcp/8080/shse/PUBKEY'
  )
  assert.deepEqual(commands, [
    {
      type: 'join',
      multiaddr: '/dns/example.com/tcp/8080/shse/PUBKEY',
    },
  ])
})
