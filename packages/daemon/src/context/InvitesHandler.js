// @flow

import { type BaseContract } from '@mainframe/eth'
import { getFeedTopic } from '@erebos/api-bzz-base'
import createKeccakHash from 'keccak'
import { utils } from 'ethers'
import { filter } from 'rxjs/operators'
import { type Observable } from 'rxjs'
import type { bzzHash } from '../swarm/feed'

import type { OwnUserIdentity, PeerUserIdentity } from '../identity'
import type { InviteRequest } from '../identity/IdentitiesRepository'
import type Contact from '../identity/Contact'
import type ClientContext from './ClientContext'
import type {
  ContextEvent,
  EthNetworkChangedEvent,
  EthAccountsChangedEvent,
  InvitesChangedEvent,
  VaultOpenedEvent,
} from './types'

type ObserveInvites<T = Object> = {
  dispose: () => void,
  source: Observable<T>,
}

//$FlowFixMe Cannot resolve module ./inviteABI.
const INVITE_ABI = require('./inviteABI.json')

const EVENT_BATCH_SIZE = 1000

const contracts = {
  // mainnet: {
  //   token: '0xa46f1563984209fe47f8236f8b01a03f03f957e4',
  //   invites: '0x6687b03F6D7eeac45d98340c8243e6a0434f1284',
  // },
  ropsten: {
    token: '0xa46f1563984209fe47f8236f8b01a03f03f957e4',
    invites: '0x33e16EFEA57968BC91fd5D9Db20068d5E4af5515',
  },
  ganache: {
    token: '0xB3E555c3dB7B983E46bf5a530ce1dac4087D2d8D',
    invites: '0x44aDa120A88555bfA4c485C9F72CB4F0AdFEE45A',
  },
}

const hash = (data: Buffer) => {
  const bytes = createKeccakHash('keccak256')
    .update(data)
    .digest()
  return '0x' + bytes.toString('hex')
}

export default class InvitesHandler {
  _context: ClientContext
  _observers: Set<Observable<any>> = new Set()
  _ethSubscriptions: Set<string> = new Set()

  constructor(context: ClientContext) {
    this._context = context
    this.subscribeToStateChanges()
  }

  async subscribeToStateChanges() {
    this._context.events.addSubscription(
      'invitesStateChanges',
      this._context
        .pipe(
          filter((e: ContextEvent) => {
            return e.type === 'vault_opened' || e.type === 'eth_network_changed'
          }),
        )
        .subscribe(
          async (
            e:
              | EthNetworkChangedEvent
              | EthAccountsChangedEvent
              | VaultOpenedEvent,
          ) => {
            if (e.type === 'vault_opened') {
              await this._context.io.eth.fetchNetwork()
            }
            if (contracts[this._context.io.eth.networkName]) {
              this.setup()
            } else {
              this._context.log(
                `Failed fetching blockchain invites, unsupported ethereum network: ${
                  this._context.io.eth.networkName
                }`,
              )
            }
          },
        ),
    )
  }

  get tokenContract() {
    return this._context.io.eth.erc20Contract(
      contracts[this._context.io.eth.networkName].token,
    )
  }

  get invitesContract(): BaseContract {
    return this._context.io.eth.getContract(
      INVITE_ABI.abi,
      contracts[this._context.io.eth.networkName].invites,
    )
  }

  setup() {
    const { identities } = this._context.openVault
    Object.keys(identities.ownUsers).forEach(async id => {
      const user = identities.getOwnUser(id)
      if (user) {
        if (user.publicFeed.feedHash) {
          const feedhash = hash(Buffer.from(user.publicFeed.feedHash))
          await this.subscribeToEthEvents(user, feedhash)
          await this.readEvents(
            user,
            feedhash,
            'Invited',
            this.handleInviteEvent,
          )
          await this.readEvents(
            user,
            feedhash,
            'Declined',
            this.handleRejectedEvent,
          )
        }
      }
    })
  }

  // FETCH BLOCKCHAIN STATE

  batchBlocks(from: number, to: number): Array<{ from: string, to: string }> {
    let blockDiff = to - from
    let fromBlock = from
    const toBlock = blockDiff > EVENT_BATCH_SIZE ? from + EVENT_BATCH_SIZE : to

    const batches = []
    if (blockDiff > EVENT_BATCH_SIZE) {
      while (blockDiff > EVENT_BATCH_SIZE) {
        batches.push({
          from: String(fromBlock),
          to: String(fromBlock + EVENT_BATCH_SIZE),
        })
        fromBlock = fromBlock + EVENT_BATCH_SIZE + 1
        blockDiff = to - fromBlock
        if (blockDiff <= EVENT_BATCH_SIZE) {
          // Fill the final range
          batches.push({ from: String(fromBlock), to: String(to) })
        }
      }
    } else {
      batches.push({ from: String(fromBlock), to: String(toBlock) })
    }
    return batches
  }

  async readEvents(
    user: OwnUserIdentity,
    userFeedHash: string,
    type: 'Declined' | 'Invited',
    handler: (user: OwnUserIdentity, events: Array<Object>) => Promise<void>,
  ) {
    const { eventBlocksRead } = this._context.openVault.blockchainData
    const { eth } = this._context.io
    const lastCheckedBlock = eventBlocksRead[type][eth.networkID] || 0
    try {
      const latestBlock = await eth.getLatestBlock()
      const creationBlock = await this.invitesContract.call('creationBlock')

      const latestNum = Number(latestBlock)
      const startNum = Math.max(lastCheckedBlock, Number(creationBlock))

      const batches = this.batchBlocks(startNum, latestNum)
      batches.forEach(async batch => {
        const params = {
          fromBlock: batch.from,
          toBlock: batch.to,
          topics: [userFeedHash],
        }
        const events = await this.invitesContract.getPastEvents(type, params)
        for (let i = 0; i < events.length; i++) {
          await handler(user, events[i])
        }
      })
      eventBlocksRead[type][eth.networkID] = latestBlock
      await this._context.openVault.save()
    } catch (err) {
      this._context.log(`Error reading blockchain events: ${err}`)
      return []
    }
  }

  async checkInviteState(sender: string, recipient: string, feed: ?bzzHash) {
    const params = [sender, recipient, feed]
    const res = await this.invitesContract.call('getInviteState', params)
    return utils.parseBytes32String(res)
  }

  handleRejectedEvent = async (
    user: OwnUserIdentity,
    event: Object,
  ): Promise<void> => {
    const { identities } = this._context.openVault
    const peer = identities.getPeerByFeed(event.recipientFeed)
    if (peer) {
      const contact = identities.getContactByPeerID(user.localID, peer.localID)
      if (contact && contact.invite) {
        contact.invite.stake.state = 'seized'
        this._context.next({
          type: 'contact_changed',
          contact,
          userID: user.localID,
          change: 'inviteDeclined',
        })
      }
    }
  }

  handleInviteEvent = async (
    user: OwnUserIdentity,
    contractEvent: Object,
  ): Promise<void> => {
    const { identities } = this._context.openVault
    if (contractEvent.senderFeed) {
      try {
        let peer = identities.getPeerByFeed(contractEvent.senderFeed)
        if (peer) {
          const contact = identities.getContactByPeerID(
            user.localID,
            peer.localID,
          )
          if (contact) {
            // Already connected
            return
          }
        }
        peer = await this._context.mutations.addPeerByFeed(
          contractEvent.senderFeed,
        )
        const topic = getFeedTopic({ name: user.base64PublicKey() })
        const feedValue = await this._context.io.bzz.getFeedValue(
          { user: peer.firstContactAddress, topic },
          {
            mode: 'content-response',
          },
        )
        if (feedValue) {
          const feed = await feedValue.json()
          const inviteState = await this.checkInviteState(
            contractEvent.senderAddress,
            contractEvent.recipientAddress,
            user.publicFeed.feedHash,
          )
          const storedInvites = identities.getInvites(user.localID)
          if (inviteState === 'PENDING' && !storedInvites[peer.localID]) {
            const contactInvite = {
              ethNetwork: this._context.io.eth.networkName,
              privateFeed: feed.privateFeed,
              receivedAddress: contractEvent.recipientAddress,
              senderAddress: contractEvent.senderAddress,
              peerID: peer.localID,
            }
            identities.setInviteRequest(user.localID, contactInvite)
            const eventContact = this._context.queries.getContactFromInvite(
              contactInvite,
            )
            if (eventContact) {
              this._context.next({
                type: 'invites_changed',
                userID: user.localID,
                contact: eventContact,
                change: 'inviteReceived',
              })
            }
          }
        }
      } catch (err) {
        this._context.log(`Error fetching feed: ${err}`)
      }
    }
  }

  getUserObjects(
    userID: string,
    contactID: string,
  ): { user: OwnUserIdentity, peer: PeerUserIdentity, contact: Contact } {
    const { identities } = this._context.openVault
    const contact = identities.getContact(userID, contactID)
    if (!contact) {
      throw new Error('Contact not found')
    }
    const user = identities.getOwnUser(userID)
    if (!user) {
      throw new Error('User not found')
    }
    const peer = identities.getPeerUser(contact.peerID)
    if (!peer) {
      throw new Error('Peer not found')
    }
    if (!peer.profile.ethAddress) {
      throw new Error('No public eth address found for Contact')
    }
    return { user, peer, contact }
  }

  // INVITE ACTIONS

  async checkAllowance(address: string) {
    const stake = await this.invitesContract.call('requiredStake')
    const allowance = await this.tokenContract.call('allowance', [
      address,
      this.invitesContract.address,
    ])
    const allowanceBN = utils.bigNumberify(allowance)
    const stakeBN = utils.bigNumberify(stake)
    return allowanceBN.gte(stakeBN)
  }

  async sendInviteApprovalTX(
    userID: string,
    contactID: string,
    gasPrice?: string,
  ) {
    const { user } = this.getUserObjects(userID, contactID)
    if (!user.profile.ethAddress) {
      throw new Error('No public eth address found on profile')
    }

    const hasAllowance = await this.checkAllowance(user.profile.ethAddress)
    if (hasAllowance) {
      return
    }

    const stake = await this.invitesContract.call('requiredStake')
    const stakeBN = utils.bigNumberify(stake)
    const mftBalance = await this.tokenContract.getBalance(
      // $FlowFixMe address checked above
      user.profile.ethAddress,
    )

    const balanceBN = utils.parseUnits(mftBalance, 'ether')

    if (stakeBN.gt(balanceBN)) {
      throw new Error(
        `Insufficient MFT balance of ${balanceBN.toString()} for required stake ${stakeBN.toString()}`,
      )
    }

    const txOptions: Object = { from: user.profile.ethAddress }
    // TODO: check high gasPrice

    const approveValue = utils.formatUnits(stake, 'ether')

    if (gasPrice) {
      txOptions.gasPrice = gasPrice
    }
    return new Promise((resolve, reject) => {
      this.tokenContract
        .approve(
          this.invitesContract.address,
          approveValue.toString(),
          txOptions,
        )
        .then(res => {
          res.on('mined', hash => {
            resolve(hash)
          })
        })
        .catch(err => {
          reject(err)
        })
    })
  }

  async processInviteTransaction(
    user: OwnUserIdentity,
    peer: PeerUserIdentity,
  ) {
    return new Promise((resolve, reject) => {
      // TODO: Notify launcher and request permission from user?
      if (!user.profile.ethAddress) {
        throw new Error('No eth address found for user')
      }
      const txOptions = { from: user.profile.ethAddress }

      this.invitesContract
        .send(
          'sendInvite',
          [peer.profile.ethAddress, peer.publicFeed, user.publicFeed.feedHash],
          txOptions,
        )
        .then(inviteRes => {
          inviteRes.on('hash', hash => {
            resolve(hash)
          })
          inviteRes.on('error', err => {
            reject(err)
          })
        })
        .catch(err => {
          reject(err)
        })
    })
  }

  async sendInviteTX(userID: string, contactID: string): Promise<void> {
    const { user, peer, contact } = this.getUserObjects(userID, contactID)
    if (!user.profile.ethAddress) {
      throw new Error('No public eth address found on profile')
    }
    if (!peer.profile.ethAddress) {
      throw new Error('No public eth address found for Contact')
    }

    const stake = await this.invitesContract.call('requiredStake')
    const mftBalance = await this.tokenContract.getBalance(
      // $FlowFixMe address checked above
      user.profile.ethAddress,
    )
    const stakeBN = utils.bigNumberify(stake)
    const balanceBN = utils.parseUnits(mftBalance, 'ether')

    if (stakeBN.gt(balanceBN)) {
      throw new Error(
        `Insufficient MFT balance of ${balanceBN.toString()} for required stake ${stakeBN.toString()}`,
      )
    }

    const pushContactEvent = (contact, change) => {
      this._context.next({
        type: 'contact_changed',
        userID: userID,
        contact,
        change,
      })
    }

    try {
      const inviteTXHash = await this.processInviteTransaction(user, peer)
      contact._invite = {
        inviteTX: inviteTXHash,
        ethNetwork: this._context.io.eth.networkName,
        // $FlowFixMe address already checked
        fromAddress: user.profile.ethAddress,
        // $FlowFixMe address already checked
        toAddress: peer.profile.ethAddress,
        stake: {
          amount: stakeBN.toString(),
          state: 'staked',
        },
      }
      pushContactEvent(contact, 'inviteSent')
    } catch (err) {
      contact._invite = undefined
      pushContactEvent(contact, 'inviteFailed')
      throw err
    }
  }

  async signAccepted(inviteRequest: InviteRequest): Promise<string> {
    const { wallets } = this._context.openVault
    if (!wallets.getEthWalletByAccount(inviteRequest.receivedAddress)) {
      throw new Error(
        `Could not find a wallet containing address: ${
          inviteRequest.receivedAddress
        }`,
      )
    }

    const addr = inviteRequest.senderAddress.substr(2)
    const messageHex = hash(Buffer.from(addr, 'hex'))

    const acceptanceSignature = await this._context.io.eth.signData({
      address: inviteRequest.receivedAddress,
      data: messageHex,
    })
    return acceptanceSignature
  }

  signatureParams(signature: string) {
    const sig = signature.substr(2) //remove 0x
    const r = '0x' + sig.slice(0, 64)
    const s = '0x' + sig.slice(64, 128)
    const v = '0x' + sig.slice(128, 130)
    const vNum = utils.bigNumberify(v).toNumber()
    return { vNum, r, s }
  }

  async retrieveStake(userID: string, contactID: string) {
    const { peer, contact } = this.getUserObjects(userID, contactID)
    const invite = contact._invite
    if (invite != null && invite.stake && invite.acceptedSignature) {
      const sigParams = this.signatureParams(invite.acceptedSignature)

      const txOptions = { from: invite.fromAddress }
      this.validateInviteNetwork(invite.ethNetwork)
      const res = await this.invitesContract.send(
        'retrieveStake',
        [
          invite.toAddress,
          peer.publicFeed,
          sigParams.vNum,
          sigParams.r,
          sigParams.s,
        ],
        txOptions,
      )

      const emitContactChange = (contact, change) => {
        this._context.next({
          contact,
          type: 'contact_changed',
          userID: userID,
          change: change,
        })
      }

      return new Promise((resolve, reject) => {
        res
          .on('hash', () => {
            // TODO: Also set from reading contract events
            // in case reclaimed from outside of MFOS
            invite.stake.state = 'reclaiming'
            emitContactChange(contact, 'stakeReclaimProcessing')
          })
          .on('mined', hash => {
            invite.stake.state = 'reclaimed'
            invite.stake.reclaimedTX = hash
            emitContactChange(contact, 'stakeReclaimMined')
            resolve(hash)
          })
          .on('error', err => {
            invite.stake.state = 'staked'
            emitContactChange(contact, 'stakeError')
            reject(err)
          })
      })
    } else {
      throw new Error('Invite approval signature not found')
    }
  }

  async declineContactInvite(userID: string, peerID: string): Promise<string> {
    const { identities } = this._context.openVault
    const inviteRequest = identities.getInviteRequest(userID, peerID)
    const peer = identities.getPeerUser(peerID)
    const user = identities.getOwnUser(userID)
    if (!peer) {
      throw new Error('Peer not found')
    }
    if (!user) {
      throw new Error(`User not found: ${userID}`)
    }
    if (!inviteRequest) {
      throw new Error('Invite not found')
    }
    this.validateInviteNetwork(inviteRequest.ethNetwork)
    const txOptions = { from: inviteRequest.receivedAddress }
    try {
      const res = await this.invitesContract.send(
        'declineAndWithdraw',
        [
          inviteRequest.senderAddress,
          peer.publicFeed,
          user.publicFeed.feedHash,
        ],
        txOptions,
      )

      return new Promise((resolve, reject) => {
        res
          .on('mined', async hash => {
            inviteRequest.rejectedTXHash = hash
            await this._context.openVault.save()
            resolve(hash)
          })
          .on('error', err => {
            reject(err)
          })
      })
    } catch (err) {
      throw err
    }
  }

  validateInviteNetwork(ethNetwork: string) {
    if (ethNetwork !== this._context.io.eth.networkName) {
      throw new Error(
        `Please connect to the eth network (${ethNetwork}) this invite was originally sent from to withdraw this stake.`,
      )
    }
  }

  // SUBSCRIPTIONS

  async subscribeToEthEvents(user: OwnUserIdentity, userFeedHash: string) {
    const { eth } = this._context.io
    try {
      if (!eth.web3Provider.on) {
        this._context.log('Ethereum subscriptions not supported')
        return
      }
      const invitesSubID = await this.invitesContract.subscribeToEvents(
        'Invited',
        [userFeedHash],
      )
      const declinedSub = await this.invitesContract.subscribeToEvents(
        'Declined',
        [userFeedHash],
      )

      const handleEvent = (name, log, handler) => {
        try {
          const event = this.invitesContract.decodeEventLog(name, log.result)
          handler(user, event)
        } catch (err) {
          this._context.log(err.message)
        }
      }
      // $FlowFixMe subscription compatibility already checked
      eth.web3Provider.on(invitesSubID, async msg => {
        handleEvent('Invited', msg, this.handleInviteEvent)
      })

      // $FlowFixMe subscription compatibility already checked
      eth.web3Provider.on(declinedSub, async msg => {
        handleEvent('Declined', msg, this.handleRejectedEvent)
      })
    } catch (err) {
      this._context.log(err.message)
    }
  }

  observe(): ObserveInvites<InvitesChangedEvent> {
    const source = this._context.pipe(filter(e => e.type === 'invites_changed'))
    this._observers.add(source)

    return {
      dispose: () => {
        this._observers.delete(source)
      },
      source,
    }
  }

  // ESTIMATE TX GAS

  async formatGasValues(txParams: {
    gas: string,
    gasPrice: string,
  }): Promise<{
    maxCost: string,
    gasPriceGwei: string,
    stakeAmount: string,
  }> {
    const stake = await this.invitesContract.call('requiredStake')

    const gasPriceBN = utils.bigNumberify(txParams.gasPrice)
    const gasLimitBN = utils.bigNumberify(txParams.gas)

    const maxCost = gasPriceBN.mul(gasLimitBN)
    return {
      stakeAmount: utils.formatUnits(stake, 'ether').toString(),
      maxCost: utils.formatUnits(maxCost, 'ether'),
      gasPriceGwei: utils.formatUnits(txParams.gasPrice, 'gwei'),
    }
  }

  async getDeclineTXDetails(userID: string, peerID: string) {
    const { identities } = this._context.openVault
    const user = identities.getOwnUser(userID)
    if (!user) throw new Error('User not found')
    const peer = identities.getPeerUser(peerID)
    if (!peer) throw new Error('Peer not found')
    const inviteRequest = identities.getInviteRequest(userID, peerID)
    if (!inviteRequest) throw new Error('Invite request not found')
    this.validateInviteNetwork(inviteRequest.ethNetwork)

    const data = this.invitesContract.encodeCall('declineAndWithdraw', [
      inviteRequest.senderAddress,
      peer.publicFeed,
      user.publicFeed.feedHash,
    ])

    const txOptions = {
      from: inviteRequest.receivedAddress,
      to: this.invitesContract.address,
      data,
    }
    const params = await this._context.io.eth.completeTxParams(txOptions)
    const formattedParams = await this.formatGasValues(params)
    return { ...params, ...formattedParams }
  }

  async getRetrieveStakeTXDetails(
    user: OwnUserIdentity,
    peer: PeerUserIdentity,
    contact: Contact,
  ) {
    const invite = contact._invite
    if (invite != null && invite.stake && invite.acceptedSignature) {
      const sigParams = this.signatureParams(invite.acceptedSignature)

      const txParams = [
        invite.toAddress,
        peer.publicFeed,
        sigParams.vNum,
        sigParams.r,
        sigParams.s,
      ]
      this.validateInviteNetwork(invite.ethNetwork)
      const data = this.invitesContract.encodeCall('retrieveStake', txParams)
      const txOptions = {
        from: invite.fromAddress,
        to: this.invitesContract.address,
        data,
      }
      const params = await this._context.io.eth.completeTxParams(txOptions)
      const formattedParams = await this.formatGasValues(params)
      return { ...params, ...formattedParams }
    }
    throw new Error('Accepted signature not found')
  }

  async getApproveTXDetails(user: OwnUserIdentity) {
    const { eth } = this._context.io
    const stake = await this.invitesContract.call('requiredStake')
    const data = this.tokenContract.encodeCall('approve', [
      this.invitesContract.address,
      stake,
    ])
    const txOptions = {
      from: user.profile.ethAddress,
      to: this.tokenContract.address,
      data,
    }
    const params = await eth.completeTxParams(txOptions)
    const formattedParams = await this.formatGasValues(params)
    return { ...params, ...formattedParams }
  }

  async getSendInviteTXDetails(user: OwnUserIdentity, peer: PeerUserIdentity) {
    const { eth } = this._context.io
    const data = this.invitesContract.encodeCall('sendInvite', [
      peer.profile.ethAddress,
      peer.publicFeed,
      user.publicFeed.feedHash,
    ])
    const txOptions = {
      from: user.profile.ethAddress,
      to: this.invitesContract.address,
      data,
    }
    const params = await eth.completeTxParams(txOptions)
    const formattedParams = await this.formatGasValues(params)
    return { ...params, ...formattedParams }
  }

  async getInviteTXDetails(
    type: string,
    userID: string,
    contactOrPeerID: string,
  ) {
    if (type === 'declineInvite') {
      return this.getDeclineTXDetails(userID, contactOrPeerID)
    }
    const { user, peer, contact } = this.getUserObjects(userID, contactOrPeerID)
    switch (type) {
      case 'approve':
        return this.getApproveTXDetails(user)
      case 'sendInvite':
        return this.getSendInviteTXDetails(user, peer)
      case 'retrieveStake':
        return this.getRetrieveStakeTXDetails(user, peer, contact)
      default:
        throw new Error('Unknown transaction type')
    }
  }
}
