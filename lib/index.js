// @ts-ignore
const ip = require('ip')
const p = require('promisify-tuple')

/**
 * @typedef {{ pubkey: string }} SHSE
 * @typedef {ReturnType<import('ppppp-promise').init>} PPPPPPromise
 * @typedef {ReturnType<import('ppppp-net').init>} PPPPPNet
 * @typedef {ReturnType<import('ppppp-hub-client/plugin').init>} PPPPPHubClient
 * @typedef {import('ppppp-hub-client/plugin').HubMultiaddr} HubMultiaddr
 * @typedef {{
 *   type: 'join',
 *   multiaddr: string,
 * }} JoinCommand
 * @typedef {`join/${string}/${string}/${string}/${string}/${string}/${string}`} JoinCommandStr
 * @typedef {{
 *   type: 'follow',
 *   id: string,
 * }} FollowCommand
 * @typedef {`follow/${string}`} FollowCommandStr
 * @typedef {{
 *   type: 'tunnel-connect',
 *   multiaddr: string,
 * }} TunnelConnectCommand
 * @typedef {`tunnel-connect/${string}/${string}`} TunnelConnectCommandStr
 * @typedef {{
 *   type: 'promise.follow',
 *   issuer: ['account' | 'pubkey', string],
 *   token: string,
 * }} PromiseFollowCommand
 * @typedef {`promise.follow/${'account' | 'pubkey'}.${string}/${string}`} PromiseFollowCommandStr
 * @typedef {{
 *   type: 'promise.account-add',
 *   issuer: ['account' | 'pubkey', string],
 *   token: string,
 * }} PromiseAccountAddCommand
 * @typedef {`promise.account-add/${'account' | 'pubkey'}.${string}/${string}`} PromiseAccountAddCommandStr
 * @typedef {| JoinCommand
 *   | FollowCommand
 *   | TunnelConnectCommand
 *   | PromiseFollowCommand
 *   | PromiseAccountAddCommand
 * } Command
 * @typedef {{
 *   shse: SHSE;
 *   promise: PPPPPPromise;
 *   hubClient: PPPPPHubClient;
 *   net: PPPPPNet;
 * }} Peer
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
  const [label, hostFormat, host, transport, port, transform, cred] = pieces
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
  const multiaddr = `/${hostFormat}/${host}/${transport}/${port}/${transform}/${cred}`
  return { type: 'join', multiaddr }
}

/**
 * @param {Array<string>} pieces
 * @param {string} uri
 * @returns {FollowCommand}
 */
function parseFollowCommand(pieces, uri) {
  const [label, id] = pieces
  if (!id) {
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
  const [label, hubPubkey, targetPubkey] = pieces
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
  const multiaddr = `/tunnel/${hubPubkey}.${targetPubkey}/shse/${targetPubkey}`
  return { type: 'tunnel-connect', multiaddr }
}

/**
 * @param {Array<string>} pieces
 * @param {string} uri
 * @returns {PromiseFollowCommand}
 */
function parsePromiseFollowCommand(pieces, uri) {
  const [label, issuerAndType, token] = pieces
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
  if (issuerType !== 'pubkey') {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, invalid promise.follow issuer type "${issuerType}"`)
  }
  return {
    type: 'promise.follow',
    issuer: [issuerType, issuerID],
    token,
  }
}

/**
 * @param {Array<string>} pieces
 * @param {string} uri
 * @returns {PromiseAccountAddCommand}
 */
function parsePromiseAccountAddCommand(pieces, uri) {
  const [label, issuerAndType, token] = pieces
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
  if (issuerType !== 'pubkey') {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, invalid promise.account-add issuer type "${issuerType}"`)
  }
  return {
    type: 'promise.account-add',
    issuer: [issuerType, issuerID],
    token,
  }
}

/**
 * @param {`ppppp://invite/${string}`} uri
 * @returns {Array<Command>}
 */
function parse(uri) {
  const url = new URL(uri)
  if (url.protocol !== 'ppppp:') {
    // prettier-ignore
    throw new Error(`Invalid protocol in URI "${uri}" for invite.parse, expected "ppppp:"`)
  }
  if (url.host !== 'invite') {
    // prettier-ignore
    throw new Error(`Invalid host in URI "${uri}" for invite.parse, expected "invite"`)
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
 * Among the join commands, find the first valid hub, and return its
 * - web protocol (http or https)
 * - web hostname
 * - pubkey for shse
 * @param {Array<JoinCommandStr>} joinCommands
 * @return {['http' | 'https', string, string]}
 */
function getFirstHub(joinCommands) {
  for (const joinCmd of joinCommands) {
    const [, hostFormat, host, , , shse, cred] = joinCmd.split('/')
    if (shse !== 'shse') continue
    const [pubkey, token] = cred.split('.')
    if (hostFormat === 'dns') {
      return ['https', host, pubkey]
    } else {
      return ['http', host, pubkey]
    }
  }
  throw new Error('No join commands found')
}

/**
 *
 * @param {Peer} peer
 * @param {number} amountHubs
 * @param {HubMultiaddr=} hardcodedHub
 * @returns {Promise<[Error] | [null, Array<JoinCommandStr>]>}
 */
async function makeJoinCommands(peer, amountHubs, hardcodedHub) {
  /**@type {Array<JoinCommandStr>}*/
  const joinCommands = []

  // Get multiaddr of hubs
  const [err1, hubMultiaddrs] = hardcodedHub
    ? [null, [hardcodedHub]]
    : await p(peer.hubClient.getHubs)(amountHubs)
  // prettier-ignore
  if (err1) return [new Error('Failed to get hubs while creating invite', { cause: err1 })]
  // prettier-ignore
  if (hubMultiaddrs.length === 0) return [new Error('No hubs available while creating invite')]

  // For each hub, connect and create token
  const hubErrors = []
  for (const multiaddr of hubMultiaddrs) {
    const [err2, rpc] = await p(peer.net.connect)(multiaddr)
    if (err2) {
      // prettier-ignore
      hubErrors.push(new Error('Failed to connect to hub while creating invite', { cause: err2 }))
      continue
    }

    // @ts-ignore
    if (!rpc.hub) continue
    // @ts-ignore
    const [err3, hubToken] = await p(rpc.hub.createToken)()
    if (err3) {
      // prettier-ignore
      hubErrors.push(new Error('Failed to create hub token while creating invite', { cause: err3 }))
      continue
    }

    if (/shse\/([^.]+)$/.test(multiaddr) === false) {
      // prettier-ignore
      hubErrors.push(new Error(`Invalid hub multiaddr "${multiaddr}" missing shse portion while creating invite`))
      continue
    }
    const joinCommand = `join${multiaddr}.${hubToken}`
    // @ts-ignore
    joinCommands.push(joinCommand)
  }

  // If there are no successful join commands, return error
  if (joinCommands.length === 0) {
    if (hubErrors.length === 0) {
      // prettier-ignore
      return [new Error('Failed to coordinate with hubs while creating invite, for unknown reasons')]
    }
    const cause = new AggregateError(hubErrors)
    // prettier-ignore
    return [new Error('Failed to coordinate with hubs while creating invite', { cause })]
  }

  return [null, joinCommands]
}

/**
 * @param {Peer} peer
 * @param {unknown} config
 */
function initInvite(peer, config) {
  /**
   * @param {{
   *   hubs?: number,
   *   id: string,
   *   _hubMultiaddr?: HubMultiaddr
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
    const amountHubs = opts.hubs ?? 1
    if (typeof amountHubs !== 'number') {
      // prettier-ignore
      return cb(new Error(`invite.createForFriend opts.hubs should be a number but was ${amountHubs}`))
    }

    // Create "join hub" commands
    const [err1, joinCommands] = await makeJoinCommands(
      peer,
      amountHubs,
      opts._hubMultiaddr
    )
    if (err1) return cb(err1)
    const [protocol, hostname] = getFirstHub(joinCommands)

    // Create follow promise
    const [err2, token] = await p(peer.promise.create)({
      account: opts.id,
      type: 'follow',
    })
    if (err2) return cb(err2)
    /** @type {PromiseFollowCommandStr} */
    const promiseCommand = `promise.follow/pubkey.${peer.shse.pubkey}/${token}`

    // Create follow command
    /** @type {FollowCommandStr} */
    const followCommand = `follow/${opts.id}`

    // prettier-ignore
    const uri = `ppppp://invite/${joinCommands.join('/')}/${followCommand}/${promiseCommand}`
    const url = `${protocol}://${hostname}/invite#${encodeURIComponent(uri)}`
    cb(null, { uri, url })
  }

  /**
   * @param {{
   *   hubs?: number,
   *   id: string,
   *   _hubMultiaddr?: HubMultiaddr
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
    const amountHubs = opts.hubs ?? 1
    if (typeof amountHubs !== 'number') {
      // prettier-ignore
      return cb(new Error(`invite.createForMyself opts.hubs should be a number but was ${amountHubs}`))
    }

    // Create "join hub" commands
    const [err1, joinCommands] = await makeJoinCommands(
      peer,
      amountHubs,
      opts._hubMultiaddr
    )
    if (err1) return cb(err1)
    const [protocol, hostname, pubkey] = getFirstHub(joinCommands)

    // Create account-add promise
    const promise = { type: 'account-add', account: opts.id }
    const [err3, token] = await p(peer.promise.create)(promise)
    if (err3) return cb(err3)
    /** @type {PromiseAccountAddCommandStr} */
    const promiseCommand = `promise.account-add/pubkey.${peer.shse.pubkey}/${token}`

    // Create tunnel-connect command
    /** @type {TunnelConnectCommandStr} */
    const tunnelCommand = `tunnel-connect/${pubkey}/${peer.shse.pubkey}`

    // prettier-ignore
    const uri = `ppppp://invite/${joinCommands.join('/')}/${tunnelCommand}/${promiseCommand}`
    const url = `${protocol}://${hostname}/invite#${encodeURIComponent(uri)}`
    cb(null, { uri, url })
  }

  return { createForFriend, createForMyself, parse }
}

exports.name = 'invite'
exports.needs = ['shse', 'promise', 'net', 'hubClient']
exports.manifest = {
  createForFriend: 'async',
  createForMyself: 'async',
  parse: 'sync',
}
exports.init = initInvite
exports.parse = parse
