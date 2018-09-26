import TransactionWrapper from './wrapper/transaction';
import { noConnectionError } from '../helpers';
import lodash from 'lodash';

class WalletHandler {
    constructor (walletManager, walletStore, transactionWrapper) {
        this.walletManager = walletManager || {};
        this.walletStore = walletStore || {};

        this.transactionWrapper = new TransactionWrapper(this.walletManager, this.walletStore);
    }

    init = (restoreMnemonic) => {
        return new Promise((resolve, reject) => {
            const errorHandler = error => reject(noConnectionError(error));

            const mnemonicHandler = (mnemonic) => {
                this.walletStore.storeMnemonic(mnemonic)
                    .then(() => {
                        this.generateWalletData(mnemonic)
                            .then(walletData => resolve(walletData))
                            .catch(errorHandler);
                    })
                    .catch(errorHandler);
            };

            if (!restoreMnemonic) {
                this.walletManager.generateMnemonic((mnemonic) => {
                    mnemonicHandler(mnemonic);
                }, errorHandler);
            } else {
                mnemonicHandler(restoreMnemonic);
            }
        });
    }

    initKeystore = (keystore, password) => {
        return new Promise((resolve, reject) => {
            if (!keystore) {
                reject(new Error('generateKeystoreFileData - missing required field - keystore data'));
            }
            if (!password) {
                reject(new Error('generateKeystoreFileData - missing required field - password'));
            }

            this.generateWalletData(keystore, password)
                .then(walletData => resolve(walletData))
                .catch(error => reject(noConnectionError(error)));
        });
    }

    generateKeystoreFileData = (password) => {
        const privKey = this.walletStore.getPrivateKey();
        return this.walletManager.createKeystoreFileData(privKey, password);
    }

    generateWalletData = (mnemonicOrKeystore, keystorePassword) => {
        return new Promise((resolve, reject) => {
            if (!mnemonicOrKeystore) {
                const errTxt = keystorePassword ? 'Keystore data is empty!' : 'Mnemonic is empty!';
                reject(new Error(errTxt));
                return;
            }

            const walletData = this.walletManager.getWalletData(mnemonicOrKeystore, keystorePassword);

            const address = lodash.get(walletData, 'addressData.address');
            const privkey = lodash.get(walletData, 'addressData.privkey');
            const pubkey = lodash.get(walletData, 'addressData.pubkey');

            if (!address || !privkey || !pubkey) {
                reject(new Error('getWalletData error - missing data from wallet - address, privkey, pubkey'));
                return;
            }

            const walletDataToStore = {
                address,
                privkey,
                pubkey
            };

            this.walletStore.storeWalletData(walletDataToStore)
                .then(() => resolve({ address, pubkey }))
                .catch((error) => reject(noConnectionError(error)));
        });
    }

    getWalletBalance = () => {
        return new Promise((resolve, reject) => {
            const success = balance => resolve(balance);
            const error = error => reject(noConnectionError(error));
            this.walletManager.getBalance(this.walletStore.getWalletAddress(), success, error);
        });
    }

    getAddressBalance = (address) => {
        return new Promise((resolve, reject) => {
            const success = balance => resolve(balance);
            const error = error => reject(noConnectionError(error));
            this.walletManager.getBalance(address, success, error);
        });
    }

    signMessage = (types, values) => {
        const privateKey = this.walletStore.getPrivateKey();
        if (!types || !values || !privateKey) {
            throw new Error('Missing required fields - not able to create sign message.');
        }
        if (!lodash.isArray(types) || !lodash.isArray(values)) {
            throw new Error('Required arguments not of array type - not able to create sign message.');
        }
        if (types.length !== values.length) {
            throw new Error('Required arguments array length not match - not able to create sign message.');
        }

        return this.walletManager.createSignMessage(privateKey, types, values);
    }

    isProperMessageSign = (authorAddress, messageHash, signature) => {
        if (!authorAddress || !messageHash || !signature) {
            // console.warn('Missing fields in data - not able to check message sign.');
            return false;
        }
        const signAuthor = this.walletManager.getSignMessageAuthor(messageHash, signature);
        return authorAddress === signAuthor;
    }

    sendFundsFromWallet = (value, receiverAddress, waitForConfirmation) => {
        return new Promise((resolve, reject) => {
            const txObj = {
                from: this.walletStore.getWalletAddress(),
                to: receiverAddress,
                privateKey: this.walletStore.getPrivateKey(),
                value,
                data: ''
            };

            if (!receiverAddress) {
                reject(new Error('sendFundsFromWallet error - missing - receiverAddress'));
                return;
            }
            if (typeof value !== 'string') {
                reject(new Error('sendFundsFromWallet error - value is not a string'));
                return;
            }
            if (isNaN(parseInt(value))) {
                reject(new Error('sendFundsFromWallet error - value is not numeric'));
                return;
            }
            if (!this.walletStore.isWalletDataAvailable()) {
                reject(new Error('Wallet data not available'));
                return;
            }

            const success = result => resolve(result);
            const error = error => reject(noConnectionError(error));

            this.sendFundsFromWalletCost(txObj).then(walletCost => {
                const walletFullCost = this.walletManager.toBigNumber(walletCost).plus(value);
                this.transactionWrapper.handleTransaction({
                    walletCost: walletFullCost,
                    value: 0,
                    txObj,
                    waitForConfirmation,
                    success,
                    error
                });
            }).catch(error);
        });
    }

    sendFundsFromWalletCost = (txObj) => {
        return new Promise((resolve, reject) => {
            if (!txObj) {
                reject(new Error('sendFundsFromWalletCost error - missing - txObj'));
                return;
            }

            const success = result => resolve(result);
            const error = error => reject(noConnectionError(error));
            this.walletManager.calculateTransactionCost(txObj, success, error);
        });
    }

    getTxFeeSendFunds = (value, receiverAddress) => {
        const txObj = {
            from: this.walletStore.getWalletAddress(),
            to: receiverAddress,
            privateKey: this.walletStore.getPrivateKey(),
            value,
            data: ''
        };

        return this.sendFundsFromWalletCost(txObj);
    }
};

export default WalletHandler;
