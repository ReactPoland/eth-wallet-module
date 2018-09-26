# eth-wallet-module
Ether Wallet module for React-Native with Experty specification (wrapper)

## Installation
Run all commands in main project directory.
1) `npm install --save git+ssh://git@github.com:Experty/eth-wallet-module.git`
2) `react-native link react-native-randombytes`
3) `npm install --save-dev mvayngrib/rn-nodeify`
4) `./node_modules/.bin/rn-nodeify --hack --install` - it will generate `shim.js` file
5) copy `import shim from './shim'` and paste on top of `index.ios.js` and `index.android.js` files.


## Usage
### To import module API:
`import EthWallet from 'eth-wallet-module'`

`EthWallet` is an object with module methods.

### To import module API test view:
`import EthWalletTestView from 'eth-wallet-module/testView'`

`<EthWalletTestView />` is an React Component with prepared test features for contract.
You can pass `mnemonic` as a prop - with mnemonic string as a value - to generate wallet from specific mnemonic.


