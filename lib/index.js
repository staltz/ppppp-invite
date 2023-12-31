// @ts-ignore
const MultiserverAddress = require('multiserver-address')
const p = require('promisify-tuple')

/**
 * @typedef {{ pubkey: string }} SHSE
 * @typedef {ReturnType<import('ppppp-promise').init>} PPPPPPromise
 * @typedef {{connect: (addr: string, cb: CB<any>) => void}} ConnPlugin
 * @typedef {{
 *   type: 'join',
 *   address: string,
 * }} JoinCommand
 * @typedef {`join/${string}/${string}/${string}/${string}`} JoinCommandStr
 * @typedef {{
 *   type: 'follow',
 *   id: string,
 * }} FollowCommand
 * @typedef {`follow/${string}`} FollowCommandStr
 * @typedef {{
 *   type: 'tunnel-connect',
 *   address: string,
 * }} TunnelConnectCommand
 * @typedef {`tunnel-connect/${string}/${string}`} TunnelConnectCommandStr
 * @typedef {{
 *   type: 'promise.follow',
 *   issuerID: string,
 *   token: string,
 * }} PromiseFollowCommand
 * @typedef {`promise.follow/account.${string}/${string}`} PromiseFollowCommandStr
 * @typedef {{
 *   type: 'promise.account-add',
 *   issuerID: string,
 *   token: string,
 * }} PromiseAccountAddCommand
 * @typedef {`promise.account-add/account.${string}/${string}`} PromiseAccountAddCommandStr
 * @typedef {| JoinCommand
 *   | FollowCommand
 *   | TunnelConnectCommand
 *   | PromiseFollowCommand
 *   | PromiseAccountAddCommand
 * } Command
 */

/**
 * @template T
 * @typedef {(...args: [NodeJS.ErrnoException] | [null, T]) => void} CB<T>
 */

/**
 * @param {Array<string>} pieces
 * @param {string} uri
 * @returns {JoinCommand}
 */
function parseJoinCommand(pieces, uri) {
  const [, host, port, pubkey, token] = pieces
  if (!host) {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, missing join hub address`)
  }
  // TODO: numeric validation for the port
  if (!port) {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, missing join hub port`)
  }
  // TODO: base58 validation for the pubkey (and maybe length)
  if (!pubkey) {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, missing join hub pubkey`)
  }
  // TODO: base58 validation for the token
  if (!token) {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, missing join hub token`)
  }
  pieces.shift()
  pieces.shift()
  pieces.shift()
  pieces.shift()
  pieces.shift()
  const shse = `shse:${pubkey}:${token}`
  const address = `net:${host}:${port}~${shse}` // TODO: add ws address here
  return { type: 'join', address }
}

/**
 * @param {Array<string>} pieces
 * @param {string} uri
 * @returns {FollowCommand}
 */
function parseFollowCommand(pieces, uri) {
  const [, id] = pieces
  if (!id) {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, missing follow id`)
  }
  pieces.shift()
  pieces.shift()
  return { type: 'follow', id }
}

/**
 * @param {Array<string>} pieces
 * @param {string} uri
 * @returns {TunnelConnectCommand}
 */
function parseTunnelConnectCommand(pieces, uri) {
  const [, hubPubkey, targetPubkey] = pieces
  // TODO: base58 validation for the hubPubkey (and maybe length)
  if (!hubPubkey) {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, missing tunnel connect hubPubkey`)
  }
  // TODO: base58 validation for the targetPubkey (and maybe length)
  if (!targetPubkey) {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, missing tunnel connect targetPubkey`)
  }
  pieces.shift()
  pieces.shift()
  pieces.shift()
  const address = `tunnel:${hubPubkey}:${targetPubkey}~shse:${targetPubkey}`
  return { type: 'tunnel-connect', address }
}

/**
 * @param {Array<string>} pieces
 * @param {string} uri
 * @returns {PromiseFollowCommand}
 */
function parsePromiseFollowCommand(pieces, uri) {
  const [, issuerAndType, token] = pieces
  if (!issuerAndType) {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, missing promise.follow issuer`)
  }
  if (!token) {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, missing promise.follow token`)
  }
  pieces.shift()
  pieces.shift()
  pieces.shift()
  const [issuerType, issuerID] = issuerAndType.split('.')
  if (issuerType !== 'account') {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, invalid promise.follow issuer type "${issuerType}"`)
  }
  return { type: 'promise.follow', issuerID, token }
}

/**
 * @param {Array<string>} pieces
 * @param {string} uri
 * @returns {PromiseAccountAddCommand}
 */
function parsePromiseAccountAddCommand(pieces, uri) {
  const [, issuerAndType, token] = pieces
  if (!issuerAndType) {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, missing promise.account-add issuer`)
  }
  if (!token) {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, missing promise.account-add token`)
  }
  pieces.shift()
  pieces.shift()
  pieces.shift()
  const [issuerType, issuerID] = issuerAndType.split('.')
  if (issuerType !== 'account') {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, invalid promise.account-add issuer type "${issuerType}"`)
  }
  return { type: 'promise.account-add', issuerID, token }
}

/**
 * @param {`ppppp://invite/${string}`} uri
 * @returns {Array<Command>}
 */
function parse(uri) {
  const url = new URL(uri)
  if (url.protocol !== 'ppppp:') {
    throw new Error(
      `Invalid protocol in URI "${uri}" for invite.parse, expected "ppppp:"`
    )
  }
  if (url.host !== 'invite') {
    throw new Error(
      `Invalid host in URI "${uri}" for invite.parse, expected "invite"`
    )
  }
  const pieces = url.pathname.startsWith('/')
    ? url.pathname.substring(1).split('/')
    : url.pathname.split('/')

  const commands = []
  while (pieces.length > 0) {
    switch (/** @type {Command['type']} */ (pieces[0])) {
      case 'join':
        commands.push(parseJoinCommand(pieces, uri))
        break
      case 'follow':
        commands.push(parseFollowCommand(pieces, uri))
        break
      case 'tunnel-connect':
        commands.push(parseTunnelConnectCommand(pieces, uri))
        break
      case 'promise.follow':
        commands.push(parsePromiseFollowCommand(pieces, uri))
        break
      case 'promise.account-add':
        commands.push(parsePromiseAccountAddCommand(pieces, uri))
        break
      default:
        throw new Error(`Unknown command: "${pieces[0]}"`)
    }
  }

  return commands
}

/**
 * @param {{ shse: SHSE | null }} peer
 * @returns {asserts peer is { shse: SHSE }}
 */
function assertSHSEExists(peer) {
  if (!peer.shse) throw new Error('"invite" plugin requires "shse" plugin')
}

/**
 * @param {{ promise: PPPPPPromise | null }} peer
 * @returns {asserts peer is { promise: PPPPPPromise }}
 */
function assertPromisePlugin(peer) {
  // prettier-ignore
  if (!peer.promise) throw new Error('"invite" plugin requires "promise" plugin')
}

/**
 * @param {{ conn: ConnPlugin | null }} peer
 * @returns {asserts peer is { conn: ConnPlugin }}
 */
function assertConnPlugin(peer) {
  if (!peer.conn) throw new Error('"invite" plugin requires "conn" plugin')
}

module.exports = {
  name: 'invite',
  manifest: {
    createForFriend: 'async',
    createForMyself: 'async',
    parse: 'sync',
  },

  parse,

  /**
   * @param {{
   *   shse: SHSE | null;
   *   promise: PPPPPPromise | null;
   *   conn: ConnPlugin | null;
   * }} peer
   * @param {unknown} config
   */
  init(peer, config) {
    assertSHSEExists(peer)
    assertPromisePlugin(peer)
    assertConnPlugin(peer)

    /**
     * @param {{
     *   hubs?: number,
     *   id: string,
     *   _hubMsAddr?: string,
     * }} opts
     *
     * @param {CB<{uri: string, url: string}>} cb
     */
    async function createForFriend(opts, cb) {
      try {
        assertConnPlugin(peer)
        assertPromisePlugin(peer)
      } catch (err) {
        return cb(/**@type {Error}*/ (err))
      }
      if (typeof opts !== 'object') {
        return cb(new Error('invite.createForFriend is missing opts argument'))
      }
      if (!opts.id) {
        // prettier-ignore
        return cb(new Error(`invite.createForFriend opts.id is required for type "follow"`))
      }
      const hubs = opts.hubs ?? 1
      if (typeof hubs !== 'number') {
        // prettier-ignore
        return cb(new Error(`invite.createForFriend opts.hubs should be a number but was ${hubs}`))
      }

      if (!opts._hubMsAddr) {
        // prettier-ignore
        return cb(new Error(`invite.createForFriend expected opts._hubMsAddr because loading from connDB not yet supported`))
      }

      // Connect to hub and create token
      const [err, rpc] = await p(peer.conn.connect)(opts._hubMsAddr)
      if (err) return cb(err)
      const [err2, hubToken] = await p(rpc.hub.createToken)()
      if (err2) return cb(err2)

      // Parse multiserver address
      // prettier-ignore
      const ERROR_MSG = `Invalid multiserver address ${opts._hubMsAddr} for invite.createForFriend`
      const msAddr = MultiserverAddress.decode(opts._hubMsAddr)
      const [netShsAddr, wsShsAddr] = msAddr
      if (!netShsAddr) return cb(new Error(ERROR_MSG))
      const [net, shse] = netShsAddr
      if (!net) return cb(new Error(ERROR_MSG))
      if (net.name !== 'net') return cb(new Error(ERROR_MSG))
      const [host, port] = net.data
      if (!shse) return cb(new Error(ERROR_MSG))
      if (shse.name !== 'shse') return cb(new Error(ERROR_MSG))
      const [pubkey] = shse.data

      // Create follow promise
      const [err3, token] = await p(peer.promise.create)({ type: 'follow' })
      if (err3) return cb(err3)

      /** @type {JoinCommandStr} */
      const joinCommand = `join/${host}/${port}/${pubkey}/${hubToken}`
      /** @type {FollowCommandStr} */
      const followCommand = `follow/${opts.id}`
      /** @type {PromiseFollowCommandStr} */
      const promiseCommand = `promise.follow/account.${opts.id}/${token}`

      const uri = `ppppp://invite/${joinCommand}/${followCommand}/${promiseCommand}`
      const url = `http://${host}/invite#${encodeURIComponent(uri)}`
      cb(null, { uri, url })
    }

    /**
     * @param {{
     *   hubs?: number,
     *   id: string,
     *   _hubMsAddr?: string,
     * }} opts
     *
     * @param {CB<{uri: string, url: string}>} cb
     */
    async function createForMyself(opts, cb) {
      try {
        assertSHSEExists(peer)
        assertConnPlugin(peer)
        assertPromisePlugin(peer)
      } catch (err) {
        return cb(/**@type {Error}*/ (err))
      }
      if (typeof opts !== 'object') {
        return cb(new Error('invite.createForMyself is missing opts argument'))
      }
      if (!opts.id) {
        // prettier-ignore
        return cb(new Error(`invite.createForMyself opts.id is required for type "follow"`))
      }
      const hubs = opts.hubs ?? 1
      if (typeof hubs !== 'number') {
        // prettier-ignore
        return cb(new Error(`invite.createForMyself opts.hubs should be a number but was ${hubs}`))
      }

      if (!opts._hubMsAddr) {
        // prettier-ignore
        return cb(new Error(`invite.createForMyself expected opts._hubMsAddr because loading from connDB not yet supported`))
      }

      // Connect to hub and create token
      const [err, rpc] = await p(peer.conn.connect)(opts._hubMsAddr)
      if (err) return cb(err)
      const [err2, hubToken] = await p(rpc.hub.createToken)()
      if (err2) return cb(err2)

      // Parse multiserver address
      // prettier-ignore
      const ERROR_MSG = `Invalid multiserver address ${opts._hubMsAddr} for invite.createForMyself`
      const msAddr = MultiserverAddress.decode(opts._hubMsAddr)
      const [netShsAddr, wsShsAddr] = msAddr
      if (!netShsAddr) return cb(new Error(ERROR_MSG))
      const [net, shse] = netShsAddr
      if (!net) return cb(new Error(ERROR_MSG))
      if (net.name !== 'net') return cb(new Error(ERROR_MSG))
      const [host, port] = net.data
      if (!shse) return cb(new Error(ERROR_MSG))
      if (shse.name !== 'shse') return cb(new Error(ERROR_MSG))
      const [pubkey] = shse.data

      // Create account-add promise
      const promise = { type: 'account-add', account: opts.id }
      const [err3, token] = await p(peer.promise.create)(promise)
      if (err3) return cb(err3)

      /** @type {JoinCommandStr} */
      const joinCommand = `join/${host}/${port}/${pubkey}/${hubToken}`
      /** @type {TunnelConnectCommandStr} */
      const tunnelCommand = `tunnel-connect/${pubkey}/${peer.shse.pubkey}`
      /** @type {PromiseAccountAddCommandStr} */
      const promiseCommand = `promise.account-add/account.${opts.id}/${token}`
      const uri = `ppppp://invite/${joinCommand}/${tunnelCommand}/${promiseCommand}`
      const url = `http://${host}/invite#${encodeURIComponent(uri)}`
      cb(null, { uri, url })
    }

    return { createForFriend, createForMyself, parse }
  },
}
