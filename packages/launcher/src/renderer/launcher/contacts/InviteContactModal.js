//@flow
import React, { Component } from 'react'
import styled from 'styled-components/native'
import { Text } from '@morpheus-ui/core'
import { graphql, createFragmentContainer, commitMutation } from 'react-relay'
import Loader from '../../UIComponents/Loader'

import rpc from '../rpc'
import FormModalView from '../../UIComponents/FormModalView'
import { EnvironmentContext } from '../RelayEnvironment'
import applyContext, { type ContextProps } from '../LauncherContext'

import type { InviteContactModal_contact as Contact } from './__generated__/InviteContactModal_contact.graphql.js'

export type TransactionType = 'invite' | 'retrieveStake' | 'declineInvite'

type Props = ContextProps & {
  closeModal: () => void,
  contact: Contact,
  type: TransactionType,
}

type TXParams = {
  gasPriceGwei: string,
  maxCost: string,
  stakeAmount: string,
}

type State = {
  txProcessing: boolean,
  error?: ?string,
  txParams?: ?TXParams,
  declinedTXHash?: ?string,
  balances?: {
    eth: string,
    mft: string,
  },
  invitePending?: {
    error?: string,
    state:
      | 'awaiting_approval'
      | 'sending_approval'
      | 'approved'
      | 'sending_invite'
      | 'invite_sent'
      | 'error',
  },
}

const MFT_TOKEN_ADDRESSES = {
  ropsten: '0xa46f1563984209fe47f8236f8b01a03f03f957e4',
  mainnet: '0xdf2c7238198ad8b389666574f2d8bc411a4b7428',
}

const FormContainer = styled.View`
  margin-top: 20px;
  max-width: 450px;
  flex: 1;
  width: 100%;
  align-self: center;
  align-items: center;
  margin-top: 15vh;
`

const Section = styled.View`
  margin-bottom: 20px;
`

export const retrieveInviteStakeMutation = graphql`
  mutation ContactsViewRetrieveInviteStakeMutation(
    $input: RetrieveInviteStakeInput!
    $userID: String!
  ) {
    retrieveInviteStake(input: $input) {
      viewer {
        contacts {
          ...ContactsView_contacts @arguments(userID: $userID)
        }
      }
    }
  }
`

export class InviteContactModal extends Component<Props, State> {
  static contextType = EnvironmentContext

  state = {}

  componentDidMount() {
    if (this.props.type === 'invite') {
      this.getInviteApproveTXDetails()
    } else {
      this.getTXDetails(this.props.type)
    }
    this.getBalances()
  }

  async getBalances() {
    const { ethAddress } = this.props.user.profile
    const address = MFT_TOKEN_ADDRESSES[this.props.ethClient.networkName]
    const balances = {
      mft: '0',
      eth: '0',
    }
    if (address && ethAddress) {
      const token = this.props.ethClient.erc20Contract(address)
      balances.mft = await token.getBalance(ethAddress)
      balances.eth = await this.props.ethClient.getETHBalance(ethAddress)
    }
    this.setState({ balances })
  }

  async getTXDetails(type: string) {
    const { user, contact } = this.props
    try {
      const res = await rpc.getInviteTXDetails({
        type: type,
        userID: user.localID,
        contactID: contact.localID,
      })
      this.setState({
        txParams: res,
      })
    } catch (err) {
      this.setState({
        error: err.message,
      })
    }
  }

  async getInviteApproveTXDetails() {
    const { user, contact } = this.props
    try {
      const res = await rpc.getInviteTXDetails({
        type: 'approve',
        userID: user.localID,
        contactID: contact.localID,
      })
      this.setState({
        txParams: res,
        invitePending: {
          state: 'awaiting_approval',
        },
      })
    } catch (err) {
      this.setState({
        error: err.message,
      })
    }
  }

  async getInviteSendTXDetails() {
    const { user, contact } = this.props
    try {
      const res = await rpc.getInviteTXDetails({
        type: 'sendInvite',
        userID: user.localID,
        contactID: contact.localID,
      })
      this.setState({
        invitePending: {
          state: 'approved',
          txParams: res,
        },
      })
    } catch (err) {
      this.setState({
        error: err.message,
        invitePending: {
          state: 'error',
        },
      })
    }
  }

  sendApproveTX = async () => {
    const { user, contact } = this.props
    try {
      this.setState({ txProcessing: true, error: null })
      await rpc.sendInviteApprovalTX({
        userID: user.localID,
        contactID: contact.localID,
      })
      this.setState({
        txProcessing: false,
        invitePending: {
          state: 'approved',
        },
      })
      this.getInviteSendTXDetails()
    } catch (err) {
      this.setState({
        error: err.message,
        invitePending: {
          state: 'approved',
          txProcessing: false,
        },
      })
    }
  }

  sendInvite = async () => {
    const { user, contact } = this.props
    try {
      this.setState({ txProcessing: true, error: null })
      await rpc.sendInviteTX({
        userID: user.localID,
        contactID: contact.localID,
      })
      this.props.closeModal()
    } catch (err) {
      this.setState({
        error: err.message,
        txProcessing: false,
        invitePending: {
          state: 'approved',
        },
      })
    }
  }

  sendDeclineTX = async () => {
    const { user, contact } = this.props
    try {
      this.setState({ txProcessing: true, error: null })
      const res = await rpc.sendDeclineInviteTX({
        userID: user.localID,
        peerID: contact.localID,
      })
      this.setState({
        txProcessing: false,
        declinedTXHash: res,
      })
      this.props.closeModal()
    } catch (err) {
      this.setState({
        txProcessing: false,
        error: err.message,
      })
    }
  }

  withdrawStake = () => {
    const { user, contact } = this.props
    this.setState({ error: null, txProcessing: true })
    const input = {
      userID: user.localID,
      contactID: contact.localID,
    }

    const requestComplete = errorMsg => {
      this.setState({
        error: errorMsg,
        txProcessing: false,
      })
    }

    commitMutation(this.context, {
      mutation: retrieveInviteStakeMutation,
      variables: { input, userID: user.localID },
      onCompleted: (contact, errors) => {
        if (errors && errors.length) {
          requestComplete(errors[0].message)
        } else {
          requestComplete()
        }
      },
      onError: err => {
        requestComplete(err.message)
      },
    })
  }

  // RENDER

  renderGasData() {
    const { txParams } = this.state
    if (txParams) {
      const { gasPriceGwei, maxCost, stakeAmount } = txParams
      const gasLabel = `Gas price: ${gasPriceGwei}`
      const costlabel = `Max Cost: ${maxCost} ETH`
      const mftLabel = `Stake: ${stakeAmount} MFT`
      return (
        <Text variant={['small']}>
          {`${gasLabel}, ${costlabel}, ${mftLabel}`}
        </Text>
      )
    }
  }

  renderContactSection(title: string) {
    return (
      <Section>
        <Text variant={['smallTitle', 'bold']}>{title}</Text>
        <Text>{this.props.contact.profile.name}</Text>
        <Text>{this.props.contact.profile.ethAddress}</Text>
      </Section>
    )
  }

  renderTransactionSection(title: string) {
    const { balances } = this.state
    const balanceLabel = balances ? (
      <Text>{`MFT: ${balances.mft}, ETH: ${balances.eth}`}</Text>
    ) : null
    return (
      <Section>
        <Text variant={['smallTitle', 'bold']}>{title}</Text>
        <Text>{this.props.user.profile.ethAddress}</Text>
        {balanceLabel}
        {this.renderGasData()}
      </Section>
    )
  }

  renderRetrieveStake() {
    const { invite } = this.props.contact
    const activity = this.state.txProcessing && <Loader />
    const reclaimedTX =
      invite && invite.stake && invite.stake.reclaimedTX ? (
        <Text>TX hash: {invite.stake.reclaimedTX}</Text>
      ) : null
    return (
      <>
        {this.renderContactSection('SEND BLOCKCHAIN INVITATION TO')}
        {this.renderTransactionSection('APPROVE AND STAKE 10 MFT FROM')}
        {reclaimedTX}
        {activity}
      </>
    )
  }

  renderDeclineInvite() {
    const activity = this.state.txProcessing && <Loader />
    const declinedTXHash = this.state.declinedTXHash ? (
      <Text>TX hash: {this.state.declinedTXHash}</Text>
    ) : null
    return (
      <>
        {this.renderContactSection('DECLINE INVITATION FROM')}
        {this.renderTransactionSection('CLAIM 10 MFT ON')}
        {declinedTXHash}
        {activity}
      </>
    )
  }

  renderInvite() {
    const activity = this.state.txProcessing && <Loader />

    return (
      <>
        {this.renderContactSection('SEND BLOCKCHAIN INVITATION TO')}
        {this.renderTransactionSection('APPROVE AND STAKE 10 MFT FROM')}
        {activity}
      </>
    )
  }

  render() {
    const { invitePending } = this.state
    const { invite } = this.props.contact
    let content
    let btnTitle
    let action
    let screenTitle
    switch (this.props.type) {
      case 'invite':
        content = this.renderInvite()
        screenTitle = 'SEND BLOCKCHAIN INVITATION'
        if (!this.state.txProcessing) {
          if (invitePending && invitePending.state === 'awaiting_approval') {
            action = this.sendApproveTX
            btnTitle = 'Approve Invite'
          } else if (invitePending && invitePending.state === 'approved') {
            action = this.sendInvite
            btnTitle = 'Send Invite'
          }
        }
        break
      case 'retrieveStake':
        content = this.renderRetrieveStake()
        screenTitle = 'WITHDRAW YOUR MFT'
        if (!this.state.txProcessing) {
          if (invite && invite.stake && invite.stake.reclaimedTX) {
            action = this.props.closeModal
            btnTitle = 'Done'
          } else {
            action = this.withdrawStake
            btnTitle = 'Withdraw'
          }
        }
        break
      case 'declineInvite':
        content = this.renderDeclineInvite()
        screenTitle = 'DECLINE AND CLAIM MFT'
        if (!this.state.txProcessing) {
          if (this.state.declinedTXHash) {
            action = this.props.closeModal
            btnTitle = 'Done'
          } else {
            action = this.sendDeclineTX
            btnTitle = 'Decline & Withdraw'
          }
        }
        break
      default:
    }

    const error = this.state.error && (
      <Text variant={['error']}>{this.state.error}</Text>
    )
    const render = (
      <>
        {content}
        {error}
      </>
    )

    return (
      <FormModalView
        title={screenTitle}
        confirmButton={btnTitle}
        dismissButton="CANCEL"
        onRequestClose={this.props.closeModal}
        onSubmitForm={action}>
        <FormContainer modal>{render}</FormContainer>
      </FormModalView>
    )
  }
}

const InviteContactRelayContainer = createFragmentContainer(
  InviteContactModal,
  {
    contact: graphql`
      fragment InviteContactModal_contact on Contact {
        peerID
        localID
        connectionState
        publicFeed
        invite {
          inviteTX
          stake {
            reclaimedTX
            amount
            state
          }
        }
        profile {
          name
          ethAddress
        }
      }
    `,
  },
)

export default applyContext(InviteContactRelayContainer)
