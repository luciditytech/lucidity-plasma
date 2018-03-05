const web3Utils = require('web3-utils');
const RLP = require('rlp');
const createKeccakHash = require('keccak');

class Header {
    constructor(version, prev, merkleRootHash, createdAt) {
        Object.defineProperty(this, 'version', {
            value: version,
            writable: false
        });
        Object.defineProperty(this, 'prev', {
            value: toPaddedHexString(prev, 32),
            writable: false
        });
        Object.defineProperty(this, 'merkleRootHash', {
            value: toPaddedHexString(merkleRootHash, 32),
            writable: false
        });
        Object.defineProperty(this, 'createdAt', {
            value: createdAt || Math.floor(Date.now() / 1000),
            writable: false
        });
    }

    toRLP() {
        return RLP.encode([
            this.version,
            this.prev,
            this.merkleRootHash,
            this.createdAt,
        ]);
    }

    toRLPHex() {
        return '0x' + this.toRLP().toString('hex');
    }

    hash() {
        return Buffer.from(web3Utils.soliditySha3.apply(null, this.typeVals()).substring(2), 'hex');
    }

    hashHex() {
        return '0x' + this.hash().toString('hex')
    }

    typeVals() {
        return [{
            type: 'uint',
            value: this.version
        }, {
            type: 'bytes32',
            value: this.prev
        }, {
            type: 'bytes32',
            value: this.merkleRootHash
        }, {
            type: 'uint',
            value: this.createdAt
        }];
    }
}

function keccak(a, bits) {
    if (!bits) bits = 256;
    return createKeccakHash('keccak' + bits).update(a).digest();
}

function toPaddedHexString(num, len) {
    num = num.substring(2);
    return '0x' + "0".repeat(len * 2 - num.length) + num;
}

module.exports = Header;