import Bitcoin from './BitcoinExtend';
import ethUtil from 'ethereumjs-util';
import bip39 from 'bip39';
import bitcore from 'bitcore-lib';
import ECIES from 'bitcore-ecies';
import EthereumjsWallet from 'ethereumjs-wallet';

const DERIVATION_PATH = "m/44'/60'/0'/0";
const ADDRESS_INDEX = 0;

const DEBUG = false;

export const GenerateMnemonic = () => bip39.generateMnemonic(128);

export const GenerateWalletData = (mnemonic) => {
    DEBUG && console.info('start getWalletData', mnemonic);
    const seedFromMnemonic = GenerateSeedFromMnemonic(mnemonic);
    DEBUG && console.info('seedFromMnemonic', seedFromMnemonic);
    const bip32RootKey = Bitcoin.HDNode.fromSeedHex(seedFromMnemonic);
    DEBUG && console.info('bip32RootKey', bip32RootKey);
    const rootKey = bip32RootKey.toBase58();
    DEBUG && console.info('rootKey', rootKey);
    const derivationPath = DERIVATION_PATH;
    DEBUG && console.info('derivationPath', derivationPath);
    const Bip32ExtendedKey = CalcBip32ExtendedKey(derivationPath, bip32RootKey);
    DEBUG && console.info('Bip32ExtendedKey', Bip32ExtendedKey);
    const extendedPrivKey = Bip32ExtendedKey.toBase58();
    DEBUG && console.info('extendedPrivKey', extendedPrivKey);
    const extendedPubKey = Bip32ExtendedKey.toBase58Public();
    DEBUG && console.info('extendedPubKey', extendedPubKey);
    const addressData = GetAddressData(ADDRESS_INDEX, Bip32ExtendedKey);
    DEBUG && console.info('addressData', addressData);

    return {
        mnemonic,
        rootKey,
        extendedPrivKey,
        extendedPubKey,
        addressData
    };
};

const GenerateSeedFromMnemonic = (mnemonic) => {
    const mnemonicToTransform = mnemonic;

    if (!mnemonicToTransform) {
        console.warn('GenerateSeedFromMnemonic error: mnemonic is empty');
        return;
    }

    const hexSeed = bip39.mnemonicToSeedHex(mnemonicToTransform);
    return hexSeed;
};

const CalcBip32ExtendedKey = (path, bip32RootKey) => {
    if (!path || !bip32RootKey) {
        console.warn('CalcBip32ExtendedKey error: path or bip32RootKey is empty');
        return;
    }

    let extendedKey = bip32RootKey;
    const pathBits = path.split('/');
    for (let i = 0; i < pathBits.length; i++) {
        const bit = pathBits[i];
        const index = parseInt(bit);
        if (isNaN(index)) {
            continue;
        }
        const hardened = bit[bit.length - 1] === "'";
        const isPriv = true;
        const invalidDerivationPath = hardened && !isPriv;
        if (invalidDerivationPath) {
            extendedKey = null;
        } else if (hardened) {
            extendedKey = extendedKey.deriveHardened(index);
        } else {
            extendedKey = extendedKey.derive(index);
        }
    }
    return extendedKey;
};

const GetAddressData = (index, bip32ExtendedKey) => {
    if (isNaN(parseInt(index))) {
        console.warn('GetAddressData error: address index is not a number');
        return;
    }

    if (!bip32ExtendedKey) {
        console.warn('GetAddressData error: bip32ExtendedKey is empty');
        return;
    }

    const indexText = DERIVATION_PATH + '/' + index;
    const key = bip32ExtendedKey.derive(index);
    const privKeyBuffer = key.keyPair.d.toBuffer();
    const privkey = privKeyBuffer.toString('hex');
    const addressBuffer = ethUtil.privateToAddress(privKeyBuffer);
    const hexAddress = addressBuffer.toString('hex');
    const checksumAddress = ethUtil.toChecksumAddress(hexAddress);
    const address = ethUtil.addHexPrefix(checksumAddress);
    const pubkey = ethUtil.privateToPublic(privKeyBuffer).toString('hex');

    return { index, indexText, address, pubkey, privkey };
};

export const generateNewKeys = () => {
  const privateKey = new bitcore.PrivateKey()
  const publicKey = bitcore.PublicKey(privateKey)

  return {
    privateKey,
    publicKey
  }
}

export const encryptDataUsingPubKey = (message = '', publicKey) => {
  // this key is used as false sample, because bitcore would crash when alice has no privateKey
  const privKey = new bitcore.PrivateKey('52435b1ff21b894da15d87399011841d5edec2de4552fdc29c8299574436925d')
  const alice = ECIES().privateKey(privKey).publicKey(new bitcore.PublicKey(publicKey))
  const encrypted = alice.encrypt(message)
  return encrypted.toString('hex')
}

export const decryptDataFromPubKeyEncryption = (encryptedHex, privateKey) => {
    const myPrivateKey = new bitcore.PrivateKey(privateKey);
    const cypher = new ECIES().privateKey(myPrivateKey);
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decrypted = cypher.decrypt(encrypted);
    return decrypted.toString('ascii');
};

export const createKeystoreFileData = (privkey, password) => {
    const privKeyBuffer = Buffer.from(privkey, 'hex');
    const wallet = EthereumjsWallet.fromPrivateKey(privKeyBuffer);
    return wallet.toV3String(password);
};

export const getWalletDataFromKeystore = (keystore, password) => {
    const keystoreWallet = EthereumjsWallet.fromV3(keystore, password);
    const addressData = {
        address: keystoreWallet.getAddressString(),
        pubkey: keystoreWallet.getPublicKeyString(),
        privkey: ethUtil.stripHexPrefix(keystoreWallet.getPrivateKeyString())
    };
    return { addressData };
};
