// @ts-ignore
const MultiserverAddress = require('multiserver-address')
// @ts-ignore
const ip = require('ip')
const p = require('promisify-tuple')

/**
 * @typedef {{ pubkey: string }} SHSE
 * @typedef {ReturnType<import('ppppp-promise').init>} PPPPPPromise
 * @typedef {{connect: (addr: string, cb: CB<any>) => void}} PPPPPNet
 * @typedef {{
 *   type: 'join',
 *   address: string,
 * }} JoinCommand
 * @typedef {`join/${string}/${string}/${string}/${string}/${string}/${string}`} JoinCommandStr
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
  if (pieces.length < 7) {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, missing some "join" arguments`)
  }
  const [, hostFormat, host, transport, port, transform, cred] = pieces // pubkey, token] = pieces
  if (hostFormat !== 'ip4' && hostFormat !== 'ip6' && hostFormat !== 'dns') {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, unsupported "join" host format "${hostFormat}"`)
  }
  if (
    (hostFormat === 'ip4' && !ip.isV4Format(host)) ||
    (hostFormat === 'ip6' && !ip.isV6Format(host))
  ) {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, incoherent "join" host "${hostFormat}/${host}"`)
  }
  if (hostFormat === 'dns' && !host.includes('.')) {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, invalid "join" host "${hostFormat}/${host}"`)
  }
  if (transport !== 'tcp') {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, unsupported "join" transport "${transport}"`)
  }
  const portNum = parseInt(port)
  if (isNaN(portNum) || portNum < 0 || portNum > 65535) {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, invalid "join" port ${port}`)
  }
  if (transform !== 'shse') {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, unsupported "join" transform "${transform}"`)
  }
  // TODO: base58 validation for the shse pubkey (and maybe length)
  // TODO: base58 validation for the shse token, if present at all
  pieces.shift()
  pieces.shift()
  pieces.shift()
  pieces.shift()
  pieces.shift()
  pieces.shift()
  pieces.shift()
  const shse = `shse:${cred.replace('.', ':')}`
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
 * @param {{
 *   shse: SHSE;
 *   promise: PPPPPPromise;
 *   net: PPPPPNet;
 * }} peer
 * @param {unknown} config
 */
function initInvite(peer, config) {
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
    const [err, rpc] = await p(peer.net.connect)(opts._hubMsAddr)
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
    const hostFormat = ip.isV4Format(host)
      ? 'ip4'
      : ip.isV6Format('ipv6')
      ? 'ip6'
      : 'dns'
    if (!shse) return cb(new Error(ERROR_MSG))
    if (shse.name !== 'shse') return cb(new Error(ERROR_MSG))
    const [pubkey] = shse.data

    // Create follow promise
    const [err3, token] = await p(peer.promise.create)({ type: 'follow' })
    if (err3) return cb(err3)

    /** @type {JoinCommandStr} */
    const joinCommand = `join/${hostFormat}/${host}/tcp/${port}/shse/${pubkey}.${hubToken}`
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
    const [err, rpc] = await p(peer.net.connect)(opts._hubMsAddr)
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
    const hostFormat = ip.isV4Format(host)
      ? 'ip4'
      : ip.isV6Format('ipv6')
      ? 'ip6'
      : 'dns'
    if (!shse) return cb(new Error(ERROR_MSG))
    if (shse.name !== 'shse') return cb(new Error(ERROR_MSG))
    const [pubkey] = shse.data

    // Create account-add promise
    const promise = { type: 'account-add', account: opts.id }
    const [err3, token] = await p(peer.promise.create)(promise)
    if (err3) return cb(err3)

    /** @type {JoinCommandStr} */
    const joinCommand = `join/${hostFormat}/${host}/tcp/${port}/shse/${pubkey}.${hubToken}`
    /** @type {TunnelConnectCommandStr} */
    const tunnelCommand = `tunnel-connect/${pubkey}/${peer.shse.pubkey}`
    /** @type {PromiseAccountAddCommandStr} */
    const promiseCommand = `promise.account-add/account.${opts.id}/${token}`
    const uri = `ppppp://invite/${joinCommand}/${tunnelCommand}/${promiseCommand}`
    const url = `http://${host}/invite#${encodeURIComponent(uri)}`
    cb(null, { uri, url })
  }

  return { createForFriend, createForMyself, parse }
}

exports.name = 'invite'
exports.needs = ['shse', 'promise', 'net']
exports.manifest = {
  createForFriend: 'async',
  createForMyself: 'async',
  parse: 'sync',
}
exports.init = initInvite
exports.parse = parse
