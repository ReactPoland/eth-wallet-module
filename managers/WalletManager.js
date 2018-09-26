import ethUtil from 'ethereumjs-util';
import EthTrx from 'ethereumjs-tx';
import { soliditySHA3 } from 'ethereumjs-abi';
import Account from 'eth-lib/lib/account';
import {
    GenerateMnemonic,
    GenerateWalletData,
    createKeystoreFileData,
    getWalletDataFromKeystore
} from './utils';
import lodash from 'lodash';

const DEBUG = false;

const TRANSACTION_CONFIRM_INTERVAL_TIME_CHECK = 500; // ms
const CONFIRMATION_MAX_ITER_NUMBER = 300;

class WalletManager {
    constructor (web3Provider) {
        if (!web3Provider) {
            throw new Error('Missing web3Provider. Not able to create ContractManager instance.');
        }

        this.web3Provider = web3Provider;
        this.nonceArray = [];
    }

    createKeystoreFileData = (privKey, password) => {
        if (!privKey) {
            throw new Error('generateKeystoreFileData - Private key not available in module');
        }
        if (!password) {
            throw new Error('generateKeystoreFileData - missing required field - password');
        }

        return createKeystoreFileData(privKey, password);
    }

    /**
    * Generate signed serialized Tx
    * @param {object} txData - data to transform into Tx
    * @param {number} txData.from - address of the sender
    * @param {number} txData.to - address of the receiver
    * @param {number} txData.privateKey - privateKey
    * @param {number} txData.value - eth value
    * @param {number} txData.data - additional data from contract method
    * @param {function} callback - success callback
    * @param {function} errorCallback - failure callback
    */
    createTransaction = (txData, callback = () => {}, errorCallback = () => {}) => {
        const { from, to, privateKey, value, data, fixedGasLimit } = txData;

        DEBUG && console.info('___createTransaction___');

        if (!from || !to || !privateKey) {
            console.warn('Missing one of the fields - from, to, privateKey - transaction not created');
            return;
        }
        if (!data) {
            DEBUG && console.info('createTransaction data is empty');
        }
        if (!value) {
            DEBUG && console.info('createTransaction value is 0');
        }

        const handleErrorCallback = (error) => {
            errorCallback(error);
            DEBUG && console.warn('createTransaction error', error.name, error.message);
        };

        this.getNonce(from, true, (nonce) => {
            this.getGasPrice((gasPrice) => {
                const withoutNonce = {
                    from,
                    to,
                    value,
                    gasPrice,
                    data
                };
                const estObj = {
                    nonce,
                    ...withoutNonce
                };
                DEBUG && console.info('estObj', estObj);
                DEBUG && console.info('withoutNonce', withoutNonce);
                this.getGasLimit(withoutNonce, fixedGasLimit, (gasLimit) => {
                    const finalTxObject = {
                        ...estObj,
                        privateKey,
                        gasLimit
                    };
                    DEBUG && console.info('finalTxObject', finalTxObject);
                    callback(this.finalizeCreateTransaction(finalTxObject));
                }, handleErrorCallback);
            }, handleErrorCallback);
        }, handleErrorCallback);
    }

    calculateTransactionCost = (txData, callback = () => {}, errorCallback = () => {}) => {
        const { from, to, privateKey, value, data, fixedGasLimit } = txData;

        DEBUG && console.info('___calculateTransactionCost___');

        if (!from || !to || !privateKey) {
            console.warn('Missing one of the fields - from, to, privateKey - transaction not created');
            return;
        }
        if (!data) {
            DEBUG && console.info('createTransaction data is empty');
        }
        if (!value) {
            DEBUG && console.info('createTransaction value is 0');
        }

        const handleErrorCallback = (error) => {
            errorCallback(error);
            DEBUG && console.warn('createTransaction error', error.name, error.message);
        };

        this.getNonce(from, false, (nonce) => {
            this.getGasPrice((gasPrice) => {
                const withoutNonce = {
                    from,
                    to,
                    value,
                    gasPrice,
                    data
                };
                const estObj = {
                    nonce,
                    ...withoutNonce
                };
                DEBUG && console.info('estObj', estObj);
                DEBUG && console.info('withoutNonce', withoutNonce);
                this.getGasLimit(withoutNonce, fixedGasLimit, (gasLimit) => {
                    callback(this.getTransactionCost(gasLimit, gasPrice));
                }, handleErrorCallback);
            }, handleErrorCallback);
        }, handleErrorCallback);
    }

    /**
    * Send signed serialized Tx
    * @param {object} serializedTx - serialized Tx
    * @param {function} callback - success callback
    * @param {function} errorCallback - failure callback
    */
    sendRawTransaction = (serializedTx, callback = () => {}, errorCallback = () => {}) => {
        if (!serializedTx) {
            errorCallback(new Error('sendRawTransaction: serializedTx object is null - transaction not send'));
            return;
        }
        const reformatedTx = ethUtil.addHexPrefix(serializedTx.toString('hex'));
        DEBUG && console.info('reformatedTx', reformatedTx);
        this.web3Provider.eth.sendRawTransaction(reformatedTx, (error, hash) => {
            if (!error) {
                callback(hash);
                DEBUG && console.info('sendRawTransaction success', hash);
            } else {
                errorCallback(error);
                DEBUG && console.warn('sendRawTransaction err', error.name, error.message);
            }
        });
    }

    prepareRawTransaction = (serializedTx, callback = () => {}, errorCallback = () => {}) => {
        if (!serializedTx) {
            errorCallback(new Error('prepareRawTransaction: serializedTx object is null - transaction not prepared'));
            return;
        }

        try {
            const reformatedTx = ethUtil.addHexPrefix(serializedTx.toString('hex'));
            callback(reformatedTx);
        } catch (error) {
            errorCallback(error);
        }
    }

    getTransactionConfirmation = (hash, callback = () => {}, errorCallback = () => {}, iterNb = 0) => {
        if (!hash) {
            errorCallback(new Error('getTransactionConfirmation: hash is null'));
            return;
        }

        this.web3Provider.eth.getTransaction(hash, (error, data) => {
            if (!error) {
                if (lodash.get(data, 'blockNumber') && lodash.get(data, 'blockHash')) {
                    DEBUG && console.info('getTransactionConfirmation success', data);
                    callback(data);
                } else if (iterNb > CONFIRMATION_MAX_ITER_NUMBER) {
                    console.info('iterNb > CONFIRMATION_MAX_ITER_NUMBER', iterNb, CONFIRMATION_MAX_ITER_NUMBER);
                    errorCallback(new Error('getTransactionConfirmation err: confirmation for transaction takes longer than expected'));
                } else {
                    iterNb++;
                    DEBUG && console.info('getTransactionConfirmation pending', iterNb, data);
                    setTimeout(() => this.getTransactionConfirmation(hash, callback, errorCallback, iterNb), TRANSACTION_CONFIRM_INTERVAL_TIME_CHECK);
                }
            } else {
                errorCallback(error);
                DEBUG && console.warn('getTransactionConfirmation err', error.name, error.message);
            }
        });
    }

    /**
    * receive data with address from mnemonic
    * @param {string} mnemonic - mnemonic string
    */
    getWalletData = (mnemonicOrKeystore, keystorePassword) => {
        if (!mnemonicOrKeystore) {
            const errTxt = keystorePassword ? 'keystore' : 'mnemonic';
            console.warn('getWalletData: ' + errTxt + ' string empty - no data received');
            return;
        }
        let walletData = {};
        if (keystorePassword) {
            walletData = getWalletDataFromKeystore(mnemonicOrKeystore, keystorePassword);
        } else {
            walletData = GenerateWalletData(mnemonicOrKeystore);
        }

        DEBUG && console.info('getWalletData:', walletData);
        return walletData;
    }

    /**
    * generate random mnemonic string
    * @param {function} callback - success callback
    * @param {function} errorCallback - failure callback
    */
    generateMnemonic = async (callback = () => {}, errorCallback = () => {}) => {
        try {
            const mnemonic = await GenerateMnemonic();
            callback(mnemonic);
        } catch (error) {
            errorCallback(error);
        }
    }

    /**
    * get balance from given address account
    * @param {number} address - account address
    * @param {function} callback - success callback
    * @param {function} errorCallback - failure callback
    */
    getBalance = (address, callback = () => {}, errorCallback = () => {}) => {
        const handleCallback = (error, data) => {
            if (!error) {
                const balanceNumber = data.toString();
                callback(balanceNumber);
            } else {
                errorCallback(error);
                DEBUG && console.warn('getBalance error:', error.name, error.message);
            }
        };
        this.web3Provider.eth.getBalance(address, handleCallback);
    }

    isConnected = (handler = (() => {})) => {
        this.web3Provider.net.getListening((error) => {
            handler(!error);
        });
    }

    createSignMessage = (privateKey, types, values) => {
        let messageHash = soliditySHA3(types, values).toString('hex');
        privateKey = ethUtil.addHexPrefix(privateKey);
        messageHash = ethUtil.addHexPrefix(messageHash);
        const signature = Account.sign(messageHash, privateKey);
        const vrs = Account.decodeSignature(signature);

        return {
            messageHash,
            v: vrs[0],
            r: vrs[1],
            s: vrs[2],
            signature
        };
    }

    getSignMessageAuthor = (messageHash, signature) => {
        return Account.recover(messageHash, signature);
    }

    signToken = (token, privateKey) => {
        privateKey = ethUtil.addHexPrefix(privateKey);
        token = ethUtil.addHexPrefix(token);
        return Account.sign(token, privateKey);
    }

    weiToEther = (value) => {
        return this.web3Provider.fromWei(value, 'ether');
    }

    etherToWei = (value) => {
        return this.web3Provider.toWei(value, 'ether');
    }

    toBigNumber = (value) => {
        return this.web3Provider.toBigNumber(value);
    }

    isAddress = (addressToCheck) => {
        const isChecksumAddress = (address) => {
            // Check each case
            address = address.replace('0x', '');
            const addressHash = this.web3Provider.sha3(address.toLowerCase());
            for (let i = 0; i < 40; i++) {
                // the nth letter should be uppercase if the nth digit of casemap is 1
                if ((parseInt(addressHash[i], 16) > 7 && address[i].toUpperCase() !== address[i]) || (parseInt(addressHash[i], 16) <= 7 && address[i].toLowerCase() !== address[i])) {
                    return false;
                }
            }
            return true;
        };

        if (this.web3Provider.isAddress(addressToCheck)) {
            // If it's all small caps or all big caps, return true
            return true;
        } else if (!/^(0x)?[0-9a-f]{40}$/i.test(addressToCheck)) {
        // check if it has the basic requirements of an address
            return false;
        } else if (/^(0x)?[0-9a-f]{40}$/.test(addressToCheck) || /^(0x)?[0-9A-F]{40}$/.test(addressToCheck)) {
        // If it's all small caps or all all caps, return "true
            return true;
        } else {
            // Otherwise check each case
            return isChecksumAddress(addressToCheck);
        }
    }

    getNonce = (address, saveNonce, callback = () => {}, errorCallback = () => {}) => {
        if (!address) {
            console.warn('GetNonce: address is empty - nonce value not received');
            return;
        }

        this.web3Provider.eth.getTransactionCount(address, 'pending', (error, nonce) => {
            if (!error) {
                const NonceArray = this.nonceArray || [];
                nonce = this.web3Provider.toBigNumber(nonce);
                while (NonceArray.indexOf(nonce.toString()) !== -1) {
                    nonce = this.web3Provider.toBigNumber(nonce.plus(1));
                }
                saveNonce && NonceArray.push(nonce.toString());
                if (!this.nonceArray) {
                    this.nonceArray = NonceArray;
                }
                const nonceHex = this.web3Provider.toHex(nonce);
                DEBUG && console.info('global[]', this.nonceArray);
                DEBUG && console.info('nonceHex', nonceHex);
                DEBUG && console.info('saveNonce', saveNonce);
                callback(nonceHex);
            } else {
                DEBUG && console.warn('getNonce error:', error.name, error.message);
                errorCallback(error);
            }
        });
    }

    getGasPrice = (callback = () => {}, errorCallback = () => {}) => {
        this.web3Provider.eth.getGasPrice((error, gasPrice) => {
            if (!error) {
                const maxGasPrice = '15000000000';
                if (gasPrice.gt(maxGasPrice)) {
                    gasPrice = maxGasPrice;
                }
                const gasPriceHex = this.web3Provider.toHex(gasPrice);
                callback(gasPriceHex);
            } else {
                DEBUG && console.warn('getGasPrice error:', error.name, error.message);
                errorCallback(error);
            }
        });
    }

    getGasLimit = (estObj, fixedGasLimit, callback = () => {}, errorCallback = () => {}, iterator) => {
        DEBUG && console.info('GetGasLimit iter: ', iterator || 0);
        if (!estObj) {
            console.warn('GetGasLimit: estimation object is null - gasLimit not estimated');
            return;
        }

        if (!estObj.data) {
            delete estObj.data; // because of error when data is empty string on estimateGas
        }

        if (fixedGasLimit) {
            const gasLimitHex = this.web3Provider.toHex(fixedGasLimit);
            callback(gasLimitHex);
            return;
        }

        !fixedGasLimit && this.web3Provider.eth.estimateGas(estObj, (error, gasLimit) => {
            if (!error) {
                const gasLimitHex = this.web3Provider.toHex(gasLimit);
                callback(gasLimitHex);
            } else {
                DEBUG && console.warn('getGasLimit error:', error.name, error.message);
                if (!iterator || iterator < 10) {
                    const nextIter = (!iterator) ? 1 : iterator + 1;
                    this.getGasLimit(estObj, fixedGasLimit, callback, errorCallback, nextIter);
                } else {
                    // errorCallback(error);
                    const errorFixedGasLimit = fixedGasLimit || 100000;
                    const gasLimitHex = this.web3Provider.toHex(errorFixedGasLimit);
                    callback(gasLimitHex);
                }
            }
        });
    }

    getTransactionCost = (gasLimit, gasPrice) => {
        gasLimit = this.web3Provider.toBigNumber(this.web3Provider.toDecimal(gasLimit));
        gasPrice = this.web3Provider.toBigNumber(this.web3Provider.toDecimal(gasPrice));

        return gasLimit.times(gasPrice);
    }

    finalizeCreateTransaction = (finalTxObject) => {
        const { privateKey, to, value, nonce, gasPrice, data, gasLimit } = finalTxObject;
        if (!privateKey || !to || !gasLimit || !nonce || !gasPrice) {
            console.warn('Missing one of the fields - privateKey, to, value, nonce, gasPrice, gasLimit - transaction not created');
            return;
        }

        const rawTx = {
            nonce,
            gasPrice,
            gasLimit,
            to,
            value: (!value) ? '0x00' : this.web3Provider.toHex(value),
            data: (!data) ? '' : data
        };
        const privKeyBuffer = Buffer.from(privateKey, 'hex');
        DEBUG && console.info('raw Tx', rawTx);
        const tx = new EthTrx(rawTx);
        tx.sign(privKeyBuffer);
        const serializedTx = tx.serialize();
        DEBUG && console.info('signed Tx', tx.serialize().toString('hex'));
        return serializedTx;
    }
};

export default WalletManager;
