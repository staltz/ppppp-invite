// @ts-ignore
const MultiserverAddress = require('multiserver-address')
const p = require('promisify-tuple')

/**
 * @template T
 * @typedef {(...args: [NodeJS.ErrnoException] | [null, T]) => void} CB<T>
 */

/**
 * @typedef {{
 *   type: 'follow' | 'join',
 *   hubs: number,
 *   id?: string,
 *   _hubMsAddr?: string,
 * }} CreateOpts
 *
 * @typedef {{type: 'join', address: string}} JoinCommand
 * @typedef {{type: 'follow', id: string}} FollowCommand
 * @typedef {{
 *   type: 'promise.follow',
 *   issuer: string,
 *   issuerType: 'pubkey' | 'identity',
 *   token: string
 * }} PromiseFollowCommand
 * @typedef {JoinCommand | FollowCommand | PromiseFollowCommand} Command
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
  // TODO: base58 validation for the pubkey
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
  const [issuerType, issuer] = issuerAndType.split('.')
  if (issuerType !== 'pubkey' && issuerType !== 'identity') {
    // prettier-ignore
    throw new Error(`Invalid URI "${uri}" for invite.parse, invalid promise.follow issuer type "${issuerType}"`)
  }
  return { type: 'promise.follow', issuer, issuerType, token }
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
    switch (pieces[0]) {
      case 'join':
        commands.push(parseJoinCommand(pieces, uri))
        break
      case 'follow':
        commands.push(parseFollowCommand(pieces, uri))
        break
      case 'promise.follow':
        commands.push(parsePromiseFollowCommand(pieces, uri))
        break
      default:
        console.log('Unknown command', pieces[0])
        pieces.shift()
        break
    }
  }

  return commands
}

module.exports = {
  name: 'invite',
  manifest: {
    create: 'async',
    parse: 'sync',
  },

  parse,

  /**
   * @param {any} sstack
   * @param {any} config
   */
  init(sstack, config) {
    if (!sstack.promise?.create) {
      throw new Error('ppppp-invite plugin requires ppppp-promise plugin')
    }
    if (!sstack.conn?.connect) {
      throw new Error('ppppp-invite plugin requires ssb-conn plugin')
    }

    /**
     * @param {CreateOpts} opts
     * @param {CB<{uri: string, url: string}>} cb
     */
    async function create(opts, cb) {
      if (typeof opts !== 'object') {
        return cb(new Error('invite.create is missing opts argument'))
      }
      const type = opts.type ?? 'follow'
      if (type !== 'follow' && type !== 'join') {
        // prettier-ignore
        return cb(new Error(`invite.create opts.type should be "follow" or "join" but was "${type}"`))
      }
      if (type === 'follow' && !opts.id) {
        // prettier-ignore
        return cb(new Error(`invite.create opts.id is required for type "follow"`))
      }
      const hubs = opts.hubs ?? 1
      if (typeof hubs !== 'number') {
        // prettier-ignore
        return cb(new Error(`invite.create opts.hubs should be a number but was ${hubs}`))
      }

      if (!opts._hubMsAddr) {
        // prettier-ignore
        return cb(new Error(`invite.create expected opts._hubMsAddr because loading from connDB not yet supported`))
      }

      // Connect to hub and create token
      const [err, rpc] = await p(sstack.conn.connect)(opts._hubMsAddr);
      if (err) return cb(err)
      const [err2, hubToken] = await p(rpc.hub.createToken)()
      if (err2) return cb(err2)

      // Parse multiserver address
      // prettier-ignore
      const ERROR_MSG = `Invalid multiserver address ${opts._hubMsAddr} for invite.create`
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
      const [err3, token] = await p(sstack.promise.create)({type: 'follow'})
      if (err3) return cb(err3)

      const joinCommand = `join/${host}/${port}/${pubkey}/${hubToken}`
      const followCommand = `follow/${opts.id}`
      const promiseCommand = `promise.follow/identity.${opts.id}/${token}`
      const uri = `ppppp://invite/${joinCommand}/${followCommand}/${promiseCommand}`
      const url = `http://${host}/invite#${encodeURIComponent(uri)}`
      cb(null, {uri, url})
    }

    return { create, parse }
  },
}
