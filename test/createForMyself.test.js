const test = require('node:test')
const assert = require('node:assert')
const Path = require('node:path')
const os = require('node:os')
const p = require('node:util').promisify
const rimraf = require('rimraf')
const Keypair = require('ppppp-keypair')
const caps = require('ppppp-caps')

test('createForMyself()', async (t) => {
  const path = Path.join(os.tmpdir(), 'ppppp-promise-createForMyself-0')
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
          assert.deepEqual(opts, { type: 'account-add', account: 'MOCK_ID' })
          cb(null, 'MOCK_PROMISE')
        },
      }
    },
  }

  const local = require('secret-stack/bare')()
    .use(require('secret-stack/plugins/net'))
    .use(require('secret-handshake-ext/secret-stack'))
    .use(mockConn)
    .use(mockPromise)
    .use(require('../lib'))
    .call(null, {
      shse: { caps },
      global: {
        path,
        keypair,
        connections: {
          outgoing: {
            net: [{ transform: 'shse' }],
          },
        },
      },
    })

  const { uri, url } = await p(local.invite.createForMyself)({
    _hubMsAddr: 'net:example.com:8008~shse:HUB_PUBKEY',
    id: 'MOCK_ID',
  })
  assert.equal(
    uri,
    `ppppp://invite/join/example.com/8008/HUB_PUBKEY/MOCK_TOKEN/tunnel-connect/HUB_PUBKEY/${local.shse.pubkey}/promise.account-add/account.MOCK_ID/MOCK_PROMISE`
  )
  assert.equal(
    url,
    `http://example.com/invite#ppppp%3A%2F%2Finvite%2Fjoin%2Fexample.com%2F8008%2FHUB_PUBKEY%2FMOCK_TOKEN%2Ftunnel-connect%2FHUB_PUBKEY%2F${local.shse.pubkey}%2Fpromise.account-add%2Faccount.MOCK_ID%2FMOCK_PROMISE`
  )

  assert.ok(connectCalled)
  assert.ok(createTokenCalled)
  assert.ok(createPromiseCalled)
  await p(local.close)()
})
