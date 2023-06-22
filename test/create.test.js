const test = require('node:test')
const assert = require('node:assert')
const Path = require('node:path')
const os = require('node:os')
const p = require('node:util').promisify
const rimraf = require('rimraf')
const Keypair = require('ppppp-keypair')
const caps = require('ppppp-caps')

test('create()', async (t) => {
  const path = Path.join(os.tmpdir(), 'ppppp-promise-create-0')
  rimraf.sync(path)
  const keypair = Keypair.generate('ed25519', 'alice')

  let connectCalled = false
  let createTokenCalled = false
  let createPromiseCalled = false

  const mockConn = {
    name: 'conn',
    manifest: {
      connect: 'async',
    },
    init() {
      return {
        connect(address, cb) {
          connectCalled = true
          assert.equal(address, 'net:example.com:8008~shse:HUB_PUBKEY')
          const mockRpc = {
            hub: {
              createToken(cb) {
                createTokenCalled = true
                cb(null, 'MOCK_TOKEN')
              },
            },
          }
          cb(null, mockRpc)
        },
      }
    },
  }

  const mockPromise = {
    name: 'promise',
    manifest: {
      create: 'async',
    },
    init() {
      return {
        create(opts, cb) {
          createPromiseCalled = true
          assert.deepEqual(opts, { type: 'follow' })
          cb(null, 'MOCK_PROMISE')
        },
      }
    },
  }

  const stack = require('secret-stack/lib/api')([], {})
    .use(require('secret-stack/lib/core'))
    .use(require('secret-stack/lib/plugins/net'))
    .use(require('secret-handshake-ext/secret-stack'))
    .use(mockConn)
    .use(mockPromise)
    .use(require('../lib'))
    .call(null, {
      path,
      caps,
      keypair,
      connections: {
        outgoing: {
          net: [{ transform: 'shse' }],
        },
      },
    })

  const uri = await p(stack.invite.create)({
    _hubMsAddr: 'net:example.com:8008~shse:HUB_PUBKEY',
    id: 'MOCK_ID',
  })
  assert.equal(
    uri,
    `ppppp://invite/join/example.com/8008/HUB_PUBKEY/MOCK_TOKEN/follow/MOCK_ID/promise.follow/identity.MOCK_ID/MOCK_PROMISE`
  )

  assert.ok(connectCalled)
  assert.ok(createTokenCalled)
  assert.ok(createPromiseCalled)
  await p(stack.close)()
})
