
class TransactionWrapper {
    constructor (walletManager, walletStore, runContractBalance) {
        this.walletManager = walletManager || {};
        this.walletStore = walletStore || {};
        this.runContractBalance = runContractBalance;
    }

    handleTransaction = ({ walletCost, value, txObj, waitForConfirmation, success, error, getSignedTransaction }) => {
        try {
            this.isEnoughForTransaction(walletCost, value).then(isEnoughArray => {
                const isEnoughOnWallet = isEnoughArray[0];
                const isEnoughOnContract = isEnoughArray[1];
                const isEnough = isEnoughOnWallet && isEnoughOnContract;
                if (isEnough) {
                    if (!getSignedTransaction) {
                        this.createAndSendTrx({ txObj, waitForConfirmation, success, error });
                    } else {
                        this.createTrx({ txObj, success, error });
                    }
                }

                !isEnoughOnWallet && error(new Error('Insufficient funds for transaction on wallet'));
                !isEnoughOnContract && error(new Error('Insufficient funds for transaction on contract'));
            }).catch(error);
        } catch (err) {
            error(err);
        }
    }

    createTrx = ({ txObj, success, error }, iter = 0) => {
        const MAX_ITER = 100;
        const handleNonceError = (errorToHandle = {}) => {
            const errMsg = errorToHandle.message || '';
            const captureError =  errMsg.toLowerCase().indexOf('nonce is too low') !== -1;
            const nonMax = iter < MAX_ITER;
            if (captureError && nonMax) {
                this.createTrx({ txObj, success, error }, iter + 1);
            } else {
                error(errorToHandle);
            }
        };

        this.walletManager.createTransaction(txObj, (transaction) => {
            this.walletManager.prepareRawTransaction(transaction, success, handleNonceError);
        }, handleNonceError);
    };

    createAndSendTrx = ({ txObj, waitForConfirmation, success, error }, iter = 0) => {
        const MAX_ITER = 100;
        const handleNonceError = (errorToHandle = {}) => {
            const errMsg = errorToHandle.message || '';
            const captureError =  errMsg.toLowerCase().indexOf('nonce is too low') !== -1;
            const nonMax = iter < MAX_ITER;
            if (captureError && nonMax) {
                this.createAndSendTrx({ txObj, waitForConfirmation, success, error }, iter + 1);
            } else {
                error(errorToHandle);
            }
        };

        this.walletManager.createTransaction(txObj, (transaction) => {
            if (waitForConfirmation) {
                this.walletManager.sendRawTransaction(transaction, (hash) => {
                    this.walletManager.getTransactionConfirmation(hash, success, handleNonceError);
                }, handleNonceError);
            } else {
                this.walletManager.sendRawTransaction(transaction, success, handleNonceError);
            }
        }, handleNonceError);
    };

    isEnoughForTransaction = async (walletCost, contractCost) => {
        const getWalletBalancePromise = new Promise((resolve, reject) => {
            const success = balance => resolve(balance);
            const error = error => reject(error);
            this.walletManager.getBalance(this.walletStore.getWalletAddress(), success, error);
        });

        const getContractBalancePromise = (this.runContractBalance) ? this.runContractBalance() : '0';

        return Promise.all([getWalletBalancePromise, getContractBalancePromise]).then(results => {
            const walletBalance = this.walletManager.toBigNumber(results[0]);
            walletCost = this.walletManager.toBigNumber(walletCost || 0);
            const isEnoughOnWallet = walletBalance.minus(walletCost).toNumber() >= 0;

            const contractBalance = this.walletManager.toBigNumber(results[1]);
            contractCost = this.walletManager.toBigNumber(contractCost || 0);
            const isEnoughOnContract = contractBalance.minus(contractCost).toNumber() >= 0;

            return [isEnoughOnWallet, isEnoughOnContract];
        }).catch(error => {
            throw error;
        });
    };
}

export default TransactionWrapper;
