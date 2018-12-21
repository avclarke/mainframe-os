// @flow

import {
  LOCAL_ID_SCHEMA,
  type BlockchainWeb3SendParams,
  type WalletGetEthWalletsResult,
} from '@mainframe/client'
import { dialog } from 'electron'
import type { Subscription as RxSubscription } from 'rxjs'
import { pubKeyToAddress } from '@erebos/api-bzz-base'

import { type AppContext, ContextSubscription } from '../contexts'
import { withPermission } from '../permissions'
import { PrependInitializationVector } from '../storage'
import { createReadStream } from 'fs'
import * as mime from 'mime'
import crypto from 'crypto'

class TopicSubscription extends ContextSubscription<RxSubscription> {
  data: ?RxSubscription

  constructor() {
    super('pss_subscription')
  }

  async dispose() {
    if (this.data != null) {
      this.data.unsubscribe()
    }
  }
}

export const sandboxed = {
  api_version: (ctx: AppContext) => ctx.client.apiVersion(),

  // Blockchain

  blockchain_web3Send: async (
    ctx: AppContext,
    params: BlockchainWeb3SendParams,
  ): Promise<Object> => {
    return ctx.client.blockchain.web3Send(params)
  },

  // Wallet

  wallet_signTx: withPermission(
    'BLOCKCHAIN_SEND',
    (ctx: AppContext, params: any) => ctx.client.wallet.signTransaction(params),
    // TODO notify app if using ledger to feedback awaiting sign
  ),

  wallet_getEthAccounts: async (ctx: AppContext): Promise<Array<string>> => {
    const ethWallets = await ctx.client.wallet.getEthWallets()
    const accounts = Object.keys(ethWallets).reduce((acc, key) => {
      ethWallets[key].forEach(w => acc.push(...w.accounts))
      return acc
    }, [])
    if (
      // TODO: We'll also eventually want default
      // accounts attached to identities
      ctx.appSession.defaultEthAccount &&
      accounts.includes(ctx.appSession.defaultEthAccount)
    ) {
      // Move default account to top
      const defaultAccount = ctx.appSession.defaultEthAccount
      accounts.splice(accounts.indexOf(defaultAccount), 1)
      accounts.unshift(defaultAccount)
    }
    return accounts
  },

  // Temporary PSS APIs - should be removed when communication APIs are settled
  pss_baseAddr: (ctx: AppContext): Promise<string> => {
    return ctx.client.pss.baseAddr()
  },
  pss_createTopicSubscription: {
    params: {
      topic: 'string',
    },
    handler: async (
      ctx: AppContext,
      params: { topic: string },
    ): Promise<string> => {
      const subscription = await ctx.client.pss.createTopicSubscription(params)
      const sub = new TopicSubscription()
      sub.data = subscription.subscribe(msg => {
        ctx.notifySandboxed(sub.id, msg)
      })
      ctx.setSubscription(sub)
      return sub.id
    },
  },
  pss_getPublicKey: (ctx: AppContext): Promise<string> => {
    return ctx.client.pss.getPublicKey()
  },
  pss_sendAsym: {
    params: {
      key: 'string',
      topic: 'string',
      message: 'string',
    },
    handler: (
      ctx: AppContext,
      params: { key: string, topic: string, message: string },
    ): Promise<null> => {
      return ctx.client.pss.sendAsym(params)
    },
  },
  pss_setPeerPublicKey: {
    params: {
      key: 'string',
      topic: 'string',
    },
    handler: (
      ctx: AppContext,
      params: { key: string, topic: string },
    ): Promise<null> => {
      return ctx.client.pss.setPeerPublicKey(params)
    },
  },
  pss_stringToTopic: {
    params: {
      string: 'string',
    },
    handler: (ctx: AppContext, params: { string: string }): Promise<string> => {
      return ctx.client.pss.stringToTopic(params)
    },
  },

  storage_requestUpload: {
    params: {
      name: 'string',
    },
    handler: (ctx: AppContext, params: { name: string }): Promise<?string> => {
      return new Promise((resolve, reject) => {
        dialog.showOpenDialog(
          ctx.window,
          { title: 'Select file to upload', buttonLabel: 'Upload' },
          async filePaths => {
            if (filePaths.length !== 0) {
              try {
                const filePath = filePaths[0]
                const { encryptionKey, feedHash, feedKeyPair } = ctx.storage
                const pubKey = feedKeyPair.getPublic(feedKeyPair)
                const address = pubKeyToAddress(pubKey)

                // TODO: move out encryption code to a separate file
                const iv = crypto.randomBytes(16) // TODO: use a constant for the length of the IV
                const cipher = crypto.createCipheriv('aes256', encryptionKey, iv)
                const body = createReadStream(filePath).pipe(cipher).pipe(new PrependInitializationVector(iv))
                const dataHash = await ctx.bzz._upload(body, {}, { 'content-type': mime.getType(filePath) })
                const feedManifest = feedHash || await ctx.bzz.createFeedManifest(address)
                const feedMetaData = await ctx.bzz.getFeedMetadata(feedManifest)
                const postFeedReq = await ctx.bzz.postFeedValue(feedKeyPair, `0x${dataHash}`)
                const url = await ctx.bzz.getDownloadURL(feedManifest, { mode: 'default' })

                // TODO: persist to the vault, atm feedHash is lost with the current session
                ctx.storage.feedHash = feedManifest
                resolve(params.name)
              } catch (error) {
                console.log(error, 'storage_requestUpload error')
                // TODO: use RPCError to provide a custom error code
                reject(new Error('Upload failed'))
              }
            } else {
              // No file selected
              resolve()
            }
          },
        )
      })
    },
  },
}

export const trusted = {
  sub_createPermissionDenied: (ctx: AppContext): { id: string } => ({
    id: ctx.createPermissionDeniedSubscription(),
  }),
  sub_unsubscribe: {
    params: {
      id: LOCAL_ID_SCHEMA,
    },
    handler: (ctx: AppContext, params: { id: string }): void => {
      ctx.removeSubscription(params.id)
    },
  },

  // WALLET

  wallet_getEthWallets: async (
    ctx: AppContext,
  ): Promise<WalletGetEthWalletsResult> => {
    return ctx.client.wallet.getEthWallets()
  },

  blockchain_web3Send: async (
    ctx: AppContext,
    params: BlockchainWeb3SendParams,
  ): Promise<Object> => {
    return ctx.client.blockchain.web3Send(params)
  },
}
