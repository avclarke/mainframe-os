/**
 * @flow
 * @relayHash bda2062981bc52b76c8d8e60d37d47e3
 */

/* eslint-disable */

'use strict';

/*::
import type { ConcreteRequest } from 'relay-runtime';
type Launcher_identities$ref = any;
type WalletsView_wallets$ref = any;
export type SupportedWallets = "ETHEREUM" | "%future added value";
export type CreateHDWalletInput = {
  blockchain: SupportedWallets,
  name: string,
  userID?: ?string,
  clientMutationId?: ?string,
};
export type WalletsViewCreateHDWalletMutationVariables = {|
  input: CreateHDWalletInput,
  userID: string,
|};
export type WalletsViewCreateHDWalletMutationResponse = {|
  +createHDWallet: ?{|
    +hdWallet: ?{|
      +accounts: ?$ReadOnlyArray<?{|
        +address: string
      |}>,
      +localID: string,
    |},
    +viewer: {|
      +identities: {|
        +$fragmentRefs: Launcher_identities$ref
      |},
      +wallets: {|
        +$fragmentRefs: WalletsView_wallets$ref
      |},
    |},
  |}
|};
export type WalletsViewCreateHDWalletMutation = {|
  variables: WalletsViewCreateHDWalletMutationVariables,
  response: WalletsViewCreateHDWalletMutationResponse,
|};
*/


/*
mutation WalletsViewCreateHDWalletMutation(
  $input: CreateHDWalletInput!
  $userID: String!
) {
  createHDWallet(input: $input) {
    hdWallet {
      accounts {
        address
      }
      localID
      id
    }
    viewer {
      identities {
        ...Launcher_identities
      }
      wallets {
        ...WalletsView_wallets_3iqrP
      }
      id
    }
  }
}

fragment Launcher_identities on Identities {
  ownUsers {
    defaultEthAddress
    localID
    wallets {
      hd {
        localID
        id
      }
      ledger {
        localID
        id
      }
    }
    id
  }
}

fragment WalletsView_wallets_3iqrP on Wallets {
  ethWallets(userID: $userID) {
    hd {
      name
      localID
      accounts {
        address
        balances {
          eth
          mft
        }
      }
      id
    }
    ledger {
      name
      localID
      accounts {
        address
        balances {
          eth
          mft
        }
      }
      id
    }
  }
}
*/

const node/*: ConcreteRequest*/ = (function(){
var v0 = [
  {
    "kind": "LocalArgument",
    "name": "input",
    "type": "CreateHDWalletInput!",
    "defaultValue": null
  },
  {
    "kind": "LocalArgument",
    "name": "userID",
    "type": "String!",
    "defaultValue": null
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input",
    "type": "CreateHDWalletInput!"
  }
],
v2 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "address",
  "args": null,
  "storageKey": null
},
v3 = {
  "kind": "LinkedField",
  "alias": null,
  "name": "accounts",
  "storageKey": null,
  "args": null,
  "concreteType": "WalletAccount",
  "plural": true,
  "selections": [
    v2
  ]
},
v4 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "localID",
  "args": null,
  "storageKey": null
},
v5 = {
  "kind": "ScalarField",
  "alias": null,
  "name": "id",
  "args": null,
  "storageKey": null
},
v6 = [
  v4,
  v5
],
v7 = [
  {
    "kind": "ScalarField",
    "alias": null,
    "name": "name",
    "args": null,
    "storageKey": null
  },
  v4,
  {
    "kind": "LinkedField",
    "alias": null,
    "name": "accounts",
    "storageKey": null,
    "args": null,
    "concreteType": "WalletAccount",
    "plural": true,
    "selections": [
      v2,
      {
        "kind": "LinkedField",
        "alias": null,
        "name": "balances",
        "storageKey": null,
        "args": null,
        "concreteType": "WalletBalances",
        "plural": false,
        "selections": [
          {
            "kind": "ScalarField",
            "alias": null,
            "name": "eth",
            "args": null,
            "storageKey": null
          },
          {
            "kind": "ScalarField",
            "alias": null,
            "name": "mft",
            "args": null,
            "storageKey": null
          }
        ]
      }
    ]
  },
  v5
];
return {
  "kind": "Request",
  "operationKind": "mutation",
  "name": "WalletsViewCreateHDWalletMutation",
  "id": null,
  "text": "mutation WalletsViewCreateHDWalletMutation(\n  $input: CreateHDWalletInput!\n  $userID: String!\n) {\n  createHDWallet(input: $input) {\n    hdWallet {\n      accounts {\n        address\n      }\n      localID\n      id\n    }\n    viewer {\n      identities {\n        ...Launcher_identities\n      }\n      wallets {\n        ...WalletsView_wallets_3iqrP\n      }\n      id\n    }\n  }\n}\n\nfragment Launcher_identities on Identities {\n  ownUsers {\n    defaultEthAddress\n    localID\n    wallets {\n      hd {\n        localID\n        id\n      }\n      ledger {\n        localID\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment WalletsView_wallets_3iqrP on Wallets {\n  ethWallets(userID: $userID) {\n    hd {\n      name\n      localID\n      accounts {\n        address\n        balances {\n          eth\n          mft\n        }\n      }\n      id\n    }\n    ledger {\n      name\n      localID\n      accounts {\n        address\n        balances {\n          eth\n          mft\n        }\n      }\n      id\n    }\n  }\n}\n",
  "metadata": {},
  "fragment": {
    "kind": "Fragment",
    "name": "WalletsViewCreateHDWalletMutation",
    "type": "Mutation",
    "metadata": null,
    "argumentDefinitions": v0,
    "selections": [
      {
        "kind": "LinkedField",
        "alias": null,
        "name": "createHDWallet",
        "storageKey": null,
        "args": v1,
        "concreteType": "CreateHDWalletPayload",
        "plural": false,
        "selections": [
          {
            "kind": "LinkedField",
            "alias": null,
            "name": "hdWallet",
            "storageKey": null,
            "args": null,
            "concreteType": "EthHDWallet",
            "plural": false,
            "selections": [
              v3,
              v4
            ]
          },
          {
            "kind": "LinkedField",
            "alias": null,
            "name": "viewer",
            "storageKey": null,
            "args": null,
            "concreteType": "Viewer",
            "plural": false,
            "selections": [
              {
                "kind": "LinkedField",
                "alias": null,
                "name": "identities",
                "storageKey": null,
                "args": null,
                "concreteType": "Identities",
                "plural": false,
                "selections": [
                  {
                    "kind": "FragmentSpread",
                    "name": "Launcher_identities",
                    "args": null
                  }
                ]
              },
              {
                "kind": "LinkedField",
                "alias": null,
                "name": "wallets",
                "storageKey": null,
                "args": null,
                "concreteType": "Wallets",
                "plural": false,
                "selections": [
                  {
                    "kind": "FragmentSpread",
                    "name": "WalletsView_wallets",
                    "args": [
                      {
                        "kind": "Variable",
                        "name": "userID",
                        "variableName": "userID",
                        "type": null
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  "operation": {
    "kind": "Operation",
    "name": "WalletsViewCreateHDWalletMutation",
    "argumentDefinitions": v0,
    "selections": [
      {
        "kind": "LinkedField",
        "alias": null,
        "name": "createHDWallet",
        "storageKey": null,
        "args": v1,
        "concreteType": "CreateHDWalletPayload",
        "plural": false,
        "selections": [
          {
            "kind": "LinkedField",
            "alias": null,
            "name": "hdWallet",
            "storageKey": null,
            "args": null,
            "concreteType": "EthHDWallet",
            "plural": false,
            "selections": [
              v3,
              v4,
              v5
            ]
          },
          {
            "kind": "LinkedField",
            "alias": null,
            "name": "viewer",
            "storageKey": null,
            "args": null,
            "concreteType": "Viewer",
            "plural": false,
            "selections": [
              {
                "kind": "LinkedField",
                "alias": null,
                "name": "identities",
                "storageKey": null,
                "args": null,
                "concreteType": "Identities",
                "plural": false,
                "selections": [
                  {
                    "kind": "LinkedField",
                    "alias": null,
                    "name": "ownUsers",
                    "storageKey": null,
                    "args": null,
                    "concreteType": "OwnUserIdentity",
                    "plural": true,
                    "selections": [
                      {
                        "kind": "ScalarField",
                        "alias": null,
                        "name": "defaultEthAddress",
                        "args": null,
                        "storageKey": null
                      },
                      v4,
                      {
                        "kind": "LinkedField",
                        "alias": null,
                        "name": "wallets",
                        "storageKey": null,
                        "args": null,
                        "concreteType": "EthWallets",
                        "plural": false,
                        "selections": [
                          {
                            "kind": "LinkedField",
                            "alias": null,
                            "name": "hd",
                            "storageKey": null,
                            "args": null,
                            "concreteType": "EthHDWallet",
                            "plural": true,
                            "selections": v6
                          },
                          {
                            "kind": "LinkedField",
                            "alias": null,
                            "name": "ledger",
                            "storageKey": null,
                            "args": null,
                            "concreteType": "EthLedgerWallet",
                            "plural": true,
                            "selections": v6
                          }
                        ]
                      },
                      v5
                    ]
                  }
                ]
              },
              {
                "kind": "LinkedField",
                "alias": null,
                "name": "wallets",
                "storageKey": null,
                "args": null,
                "concreteType": "Wallets",
                "plural": false,
                "selections": [
                  {
                    "kind": "LinkedField",
                    "alias": null,
                    "name": "ethWallets",
                    "storageKey": null,
                    "args": [
                      {
                        "kind": "Variable",
                        "name": "userID",
                        "variableName": "userID",
                        "type": "String!"
                      }
                    ],
                    "concreteType": "EthWallets",
                    "plural": false,
                    "selections": [
                      {
                        "kind": "LinkedField",
                        "alias": null,
                        "name": "hd",
                        "storageKey": null,
                        "args": null,
                        "concreteType": "EthHDWallet",
                        "plural": true,
                        "selections": v7
                      },
                      {
                        "kind": "LinkedField",
                        "alias": null,
                        "name": "ledger",
                        "storageKey": null,
                        "args": null,
                        "concreteType": "EthLedgerWallet",
                        "plural": true,
                        "selections": v7
                      }
                    ]
                  }
                ]
              },
              v5
            ]
          }
        ]
      }
    ]
  }
};
})();
// prettier-ignore
(node/*: any*/).hash = '2c6bfc397b59c6161746ad1722c2233f';
module.exports = node;
