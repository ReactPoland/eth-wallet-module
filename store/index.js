import lodash from 'lodash';
import CryptoJS from 'crypto-js';

const MNEMONIC_STORE_KEY = 'MNEMONIC';
const WALLET_DATA_STORE_KEY = 'WALLET_DATA';

const defaultStoreMethod = (name) => {
    return Promise.resolve(name + ' - not defined!');
};

const defaultConfig = {
    setItem: () => defaultStoreMethod('setItem'),
    getItem: () => defaultStoreMethod('getItem'),
    removeItem: () => defaultStoreMethod('removeItem')
};

const newKey = () => Math.random().toString(36).substring(7);

class WalletStore {
    constructor (config) {
        this.store = {};
        this.storeKeyWalletData = newKey()
        this.storeKeyMnemonic = newKey()

        if (!config) {
            config = {};
        }
        this.permStore = { ...defaultConfig, ...config };
    }

    storeMnemonic = (mnemonic) => {
        this.secureSaveMnemonic(mnemonic)
        return this.permStore.setItem(MNEMONIC_STORE_KEY, mnemonic);
    }

    getMnemonic = () => {
        return this.permStore.getItem(MNEMONIC_STORE_KEY)
            .then(mnemonic => {
                this.secureSaveMnemonic(mnemonic)
                return mnemonic;
            })
            .catch(error => {
                throw error;
            });
    }

    removeMnemonic = () => {
        return this.permStore.removeItem(MNEMONIC_STORE_KEY)
            .then(success => {
                this.store[MNEMONIC_STORE_KEY] = null;
                return success;
            })
            .catch(error => {
                throw error;
            });
    }

    getWalletMnemonic = () => {
        return this.secureGetMnemonic();
    }

    storeWalletData = (walletData) => {
        this.secureSaveWalletData(JSON.stringify(walletData))
        return this.permStore.setItem(WALLET_DATA_STORE_KEY, JSON.stringify(walletData));
    }

    getWalletData = () => {
        return this.permStore.getItem(WALLET_DATA_STORE_KEY)
            .then(walletData => {
                walletData = walletData || null;
                this.secureSaveWalletData(walletData)
                return JSON.parse(walletData);
            })
            .catch(error => {
                throw error;
            });
    }

    getWalletAddress = () => {
        const ADDRESS_FIELD = 'address';
        const walletData = this.secureGetWalletData();
        return lodash.get(walletData, ADDRESS_FIELD);
    }

    getPrivateKey = () => {
        const PRIV_KEY_FIELD = 'privkey';
        const walletData = this.secureGetWalletData();
        return lodash.get(walletData, PRIV_KEY_FIELD);
    }

    getPublicKey = () => {
        const PUB_KEY_FIELD = 'pubkey';
        const walletData = this.secureGetWalletData();
        return lodash.get(walletData, PUB_KEY_FIELD);
    }

    isWalletDataAvailable = () => {
        const walletData = this.secureGetWalletData();

        if (!walletData) {
            console.warn('Wallet data not available!');
            return false;
        }

        if (!lodash.get(walletData, 'address')) {
            console.warn('Wallet data address not available!');
            return false;
        }

        if (!lodash.get(walletData, 'privkey')) {
            console.warn('Wallet data private key not available!');
            return false;
        }

        return true;
    }

    removeWalletData = () => {
        const promises = [
            this.permStore.removeItem(MNEMONIC_STORE_KEY),
            this.permStore.removeItem(WALLET_DATA_STORE_KEY)
        ];

        return Promise.all(promises).then(results => {
            this.store[MNEMONIC_STORE_KEY] = null;
            this.store[WALLET_DATA_STORE_KEY] = null;
            return results;
        }).catch(error => {
            throw error;
        });
    };

  secureGetWalletData = () => {
      const encryptedWalletData = this.store[WALLET_DATA_STORE_KEY]
      if(!encryptedWalletData) {
        return
      }

      const decryptedWalletDataHash = CryptoJS.AES.decrypt(encryptedWalletData, this.storeKeyWalletData);
      const decryptedWalletData = decryptedWalletDataHash.toString(CryptoJS.enc.Utf8);
      this.secureSaveWalletData(decryptedWalletData);
      return JSON.parse(decryptedWalletData)
  };

  secureSaveWalletData = (decryptedWalletData) => {
    if (!decryptedWalletData) {
      return
    }
    this.storeKeyWalletData = newKey()
    const encryptedWalletData = CryptoJS.AES.encrypt(decryptedWalletData, this.storeKeyWalletData);
    this.store[WALLET_DATA_STORE_KEY] = encryptedWalletData;
  }

  secureGetMnemonic = () => {
      const encryptedMnemonic = this.store[MNEMONIC_STORE_KEY]
      if(!encryptedMnemonic) {
        return
      }
      const decryptedMnemonicHash = CryptoJS.AES.decrypt(encryptedMnemonic, this.storeKeyMnemonic);
      const decryptedMnemonic = decryptedMnemonicHash.toString(CryptoJS.enc.Utf8);
      this.secureSaveMnemonic(decryptedMnemonic);
      return decryptedMnemonic
  };

  secureSaveMnemonic = (decryptedMnemonic) => {
    if (!decryptedMnemonic) {
      return
    }
    this.storeKeyMnemonic = newKey()
    const encryptedMnemonic = CryptoJS.AES.encrypt(decryptedMnemonic, this.storeKeyMnemonic);
    this.store[MNEMONIC_STORE_KEY] = encryptedMnemonic;
  }
}

export default WalletStore;
