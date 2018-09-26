import Web3 from 'web3';
import { WalletManager, TransactionsManager } from './managers';
import { decryptDataFromPubKeyEncryption, encryptDataUsingPubKey, generateNewKeys } from './managers/utils';
import WalletStore from './store';
import WalletHandler from './handlers/wallet';
import ContractHandler from './handlers/contract';

import lodash from 'lodash';

class EthWallet {
    contract = {}
    walletStore = {}
    walletManager = {}
    transactionsManager = {}
    tools = {}

    constructor (config) {
        const { httpProvider, contracts, storeConfig } = config || {};
        if (!httpProvider) {
            throw new Error('No http provider for web3. Unable to create eth wallet instance.');
        }

        if (!contracts) {
            throw new Error('No contracts provided. Unable to create eth wallet instance.');
        }

        const web3Provider = new Web3(new Web3.providers.HttpProvider(httpProvider));
        this.walletManager = new WalletManager(web3Provider);
        this.walletStore = new WalletStore(storeConfig);

        this.wallet = new WalletHandler(this.walletManager, this.walletStore);
        contracts.forEach((contract) => {
            this.contract[contract.name] = new ContractHandler(web3Provider, contract, this.walletManager, this.walletStore);
        });

        this.transactionsManager = new TransactionsManager(web3Provider);

        this.tools = {
            weiToEther: this.walletManager.weiToEther,
            etherToWei: this.walletManager.etherToWei,
            toBigNumber: this.walletManager.toBigNumber,
            isAddress: this.walletManager.isAddress,
            decryptData: (hash) =>
                decryptDataFromPubKeyEncryption(hash, this.walletStore.getPrivateKey()),
            walletDecryptEncryptMethods: {
              encryptDataUsingPubKey,
              generateNewKeys,
              decryptDataFromPubKeyEncryption
            }
        };

        this.isConnected = this.walletManager.isConnected;
    }

    removeWalletData = () => { // async remove from temp and perm store
        return this.walletStore.removeWalletData();
    }

    getWalletAddress = () => { // sync from temp store
        return this.walletStore.getWalletAddress();
    }

    getWalletMnemonic = () => { // sync from temp store
        return this.walletStore.getWalletMnemonic();
    }

    getWalletData = () => { // async from perm store to temp store
        return Promise.all([
            this.walletStore.getMnemonic(), this.walletStore.getWalletData()
        ]).then((values) => {
            return {
                mnemonic: values[0],
                address: lodash.get(values[1], 'address')
            };
        });
    }
}

export default EthWallet;
