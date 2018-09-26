class TransactionsManager {
    constructor (web3Provider) {
        if (!web3Provider) {
            throw new Error('Missing web3Provider. Not able to create ContractManager instance.');
        }

        this.web3Provider = web3Provider;
    }

    getCurrentBlockNumber = () => {
        const promise = new Promise((resolve, reject) => {
            this.web3Provider.eth.getBlockNumber((error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });

        return promise;
    }

    getBlock = (blockNumber) => {
        const promise = new Promise((resolve, reject) => {
            const getJson = true;
            this.web3Provider.eth.getBlock(blockNumber, getJson, (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });

        return promise;
    }

    getTransactionInfo = (hash) => {
        const promise = new Promise((resolve, reject) => {
            this.web3Provider.eth.getTransaction(hash, (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });

        return promise;
    }

   filterSpecificBlock = async (address, blockNr) => {
       let blockInfo = await this.getBlock(blockNr);

       const authorTxs = [];

       if (!blockInfo) {
           blockInfo = {};
       }
       let trxs = blockInfo.transactions;
       if (!trxs) {
           trxs = [];
       }
       for (let j = 0; j < trxs.length; j++) {
           let trx = trxs[j];
           if (!trx) trx = {};

           const isFrom = !!trx.from && trx.from.toLowerCase() === address.toLowerCase();
           const isTo = !!trx.to && trx.to.toLowerCase() === address.toLowerCase();
           if (isFrom || isTo) {
               authorTxs.push({
                   timeStamp: blockInfo.timestamp,
                   ...trxs[j]
               });
           }
       }

       return {
           authorTxs,
           blockNr
       };
   }
};

export default TransactionsManager;
