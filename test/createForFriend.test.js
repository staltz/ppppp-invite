const test = require('node:test')
const assert = require('node:assert')
const Path = require('node:path')
const os = require('node:os')
const p = require('node:util').promisify
const rimraf = require('rimraf')
const Keypair = require('ppppp-keypair')
const caps = require('ppppp-caps')

test('createForFriend()', async (t) => {
  const path = Path.join(os.tmpdir(), 'ppppp-promise-createForFriend-0')
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

  const local = require('secret-stack/bare')({caps})
    .use(require('secret-stack/plugins/net'))
    .use(require('secret-handshake-ext/secret-stack'))
    .use(mockConn)
    .use(mockPromise)
    .use(require('../lib'))
    .call(null, {
      path,
      keypair,
      connections: {
        outgoing: {
          net: [{ transform: 'shse' }],
        },
      },
    })

  const { uri, url } = await p(local.invite.createForFriend)({
    _hubMsAddr: 'net:example.com:8008~shse:HUB_PUBKEY',
    id: 'MOCK_ID',
  })
  assert.equal(
    uri,
    `ppppp://invite/join/example.com/8008/HUB_PUBKEY/MOCK_TOKEN/follow/MOCK_ID/promise.follow/identity.MOCK_ID/MOCK_PROMISE`
  )
  assert.equal(
    url,
    `http://example.com/invite#ppppp%3A%2F%2Finvite%2Fjoin%2Fexample.com%2F8008%2FHUB_PUBKEY%2FMOCK_TOKEN%2Ffollow%2FMOCK_ID%2Fpromise.follow%2Fidentity.MOCK_ID%2FMOCK_PROMISE`
  )

  assert.ok(connectCalled)
  assert.ok(createTokenCalled)
  assert.ok(createPromiseCalled)
  await p(local.close)()
})
