let Bitcoin = null;
if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    Bitcoin = require('react-native-bitcoinjs-lib');
} else {
    Bitcoin = require('bitcoinjs-lib');
}

Bitcoin.HDNode.prototype.toBase58Public = function () {
    // Version
    const network = this.keyPair.network;
    const version = network.bip32.public;
    const buffer = Buffer.alloc(78);

    // 4 bytes: version bytes
    buffer.writeUInt32BE(version, 0);

    // 1 byte: depth: 0x00 for master nodes, 0x01 for level-1 descendants, ....
    buffer.writeUInt8(this.depth, 4);

    // 4 bytes: the fingerprint of the parent's key (0x00000000 if master key)
    buffer.writeUInt32BE(this.parentFingerprint, 5);

    // 4 bytes: child number. This is the number i in xi = xpar/i, with xi the key being serialized.
    // This is encoded in big endian. (0x00000000 if master key)
    buffer.writeUInt32BE(this.index, 9);

    // 32 bytes: the chain code
    this.chainCode.copy(buffer, 13);

    // X9.62 encoding for public keys
    this.keyPair.getPublicKeyBuffer().copy(buffer, 45);

    const base58check = require('bs58check');

    return base58check.encode(buffer);
};

export default Bitcoin;
