import TransactionWrapper from './wrapper/transaction';
import { ContractManager } from '../managers';
import { noConnectionError } from '../helpers';
import isArray from 'lodash/isArray';

class ContractHandler {
    constructor (web3Provider, contractConfig, walletManager, walletStore) {
        const { address, abi, methods } =  contractConfig;
        this.contractManager = new ContractManager(web3Provider, address, abi);
        this.walletManager = walletManager || {};
        this.walletStore = walletStore || {};

        const contractMethods = methods || [];

        for (const i in contractMethods) {
            const { id,
                name,
                readable,
                walletAddressDefault,
                checkValueFromArg,
                checkBalanceMethod
            } =  contractMethods[i];

            const handleWriteMethod = (readable)
                ? this.handleRead(id, walletAddressDefault) : this.handleWriteMethod(id, checkValueFromArg);

            const runCostMethod = (readable)
                ? null : this.handleWriteMethodCost(id, checkValueFromArg);

            this['run' + name] = handleWriteMethod;
            if (readable && checkBalanceMethod) {
                this['run' + 'Balance'] = handleWriteMethod;
            }

            if (runCostMethod) {
                this['run' + name + 'Cost'] = runCostMethod;
            }
        }

        this.transactionWrapper = new TransactionWrapper(this.walletManager, this.walletStore, this.runBalance);
    }

    getTxObjectScheme = () => {
        return {
            from: this.walletStore.getWalletAddress(),
            to: this.contractManager.getContractAddress(),
            privateKey: this.walletStore.getPrivateKey(),
            value: '',
            data: ''
        };
    };

    handleRead = (name, walletAddressDefault) => (...args) => {
        return new Promise((resolve, reject) => {
            if (walletAddressDefault && (args.length === 0 || !args[0])) {
                args = [this.walletStore.getWalletAddress()];
            }
            const methodObj = this.contractManager.getAbiMethod(name);
            this.contractManager.validateAbiMethodArgs(name, args);
            if (!this.walletStore.isWalletDataAvailable()) {
                reject(new Error('Wallet data not available'));
                return;
            }
            const success = result => resolve(result.toString());
            const error = error => reject(noConnectionError(error));
            this.contractManager.runContractReadMethod(methodObj, args, success, error);
        });
    }

    handleWriteMethod = (name, checkValueFromArg) => (argsArray, waitForConfirmation, getSignedTransaction) => {
        return new Promise((resolve, reject) => {
            const args = isArray(argsArray) ? argsArray : [];
            const data = this.contractManager.getContractMethodData(name, args);
            const txObj = {
                ...this.getTxObjectScheme(),
                data,
                fixedGasLimit: 100000
            };
            this.contractManager.validateAbiMethodArgs(name, args);
            if (!this.walletStore.isWalletDataAvailable()) {
                reject(new Error('Wallet data not available'));
                return;
            }

            const success = result => resolve(result);
            const error = error => {
                reject(noConnectionError(error));
            };

            this.runCostCalculation(txObj)
                .then(walletCost => {
                    const value = (checkValueFromArg) ? this.contractManager.getValueFromAbiMethodArgs(name, args) : 0;
                    this.transactionWrapper.handleTransaction({ walletCost, value, txObj, waitForConfirmation, success, error });
                })
                .catch(error);
        });
    }

    handleWriteMethodCost = (name, checkValueFromArg) => (argsArray, fixedGasLimit) => {
        return new Promise((resolve, reject) => {
            argsArray = isArray(argsArray) ? argsArray : [];
            const args = (checkValueFromArg)
                ? this.contractManager.clearValueFromAbiMethodArgs(name, argsArray)
                : argsArray;
            const data = this.contractManager.getContractMethodData(name, args);
            const txObj = {
                ...this.getTxObjectScheme(),
                data,
                fixedGasLimit
            };

            this.contractManager.validateAbiMethodArgs(name, args);

            if (!this.walletStore.isWalletDataAvailable()) {
                reject(new Error('Wallet data not available'));
                return;
            }

            const success = result => resolve(result);
            const error = error => reject(noConnectionError(error));
            this.runCostCalculation(txObj)
                .then(success)
                .catch(error);
        });
    }

    runCostCalculation = (txObj) => {
        return new Promise((resolve, reject) => {
            if (!txObj) {
                reject(new Error('runCostCalculation error - txObj is empty'));
                return;
            }

            const success = result => resolve(result);
            const error = error => reject(noConnectionError(error));
            this.walletManager.calculateTransactionCost(txObj, success, error);
        });
    }
};

export default ContractHandler;
