const web3Utils = require('web3-utils');
const ethjsUtil = require('ethereumjs-util');

const Signature = require('./Signature');

const RLP = require('rlp');

class TransactionInput {
    constructor(txID, outputIndex, signature) {
        Object.defineProperty(this, 'txID', {
            value: toPaddedHexString(txID, 32),
            writable: false
        });
        Object.defineProperty(this, 'outputIndex', {
            value: outputIndex,
            writable: false
        });
        Object.defineProperty(this, 'signature', {
            value: signature,
            writable: false
        });
    }

    typeVals(includeSignatures) {
        return [{
            type: 'bytes32',
            value: this.txID
        }, {
            type: 'uint',
            value: this.outputIndex
        }].concat(includeSignatures ? [{
            type: 'uint8',
            value: this.signature.v
        }, {
            type: 'bytes32',
            value: this.signature.r
        }, {
            type: 'bytes32',
            value: this.signature.s
        }] : []);
    }

    static none() {
        return new TransactionInput("0x0", 0x0);
    }

    equals(obj) {
        return JSON.stringify(this.typeVals(true)) === JSON.stringify(obj.typeVals(true));
    }
}

class TransactionOutput {
    constructor(address, amount) {
        Object.defineProperty(this, 'address', {
            value: toPaddedHexString(address, 20),
            writable: false
        });
        Object.defineProperty(this, 'amount', {
            value: amount,
            writable: false
        });
    }

    typeVals() {
        return [{
            type: 'address',
            value: this.address
        }, {
            type: 'uint',
            value: this.amount
        }];
    }

    equals(obj) {
        return JSON.stringify(this.typeVals()) === JSON.stringify(obj.typeVals());
    }

    static none() {
        return new TransactionOutput("0x0", 0x0);
    }
}

class Transaction {
    constructor(inputs, outputs, payload) {
        if ((inputs.length + outputs.length) === 0) throw "Must be an input or an output";

        Object.defineProperty(this, 'inputs', {
            value: inputs,
            writable: false
        });
        Object.defineProperty(this, 'outputs', {
            value: outputs,
            writable: false
        });
        Object.defineProperty(this, 'payload', {
            value: payload || 0x0,
            writable: false
        });
    }

    static depositTransaction(address, amount, headerIndex) {
        const payeeOutput = new TransactionOutput(address, amount);
        return new Transaction([], [payeeOutput], headerIndex);
    }

    toRLP() {
        const res = [[], [], this.payload];
        this.inputs.forEach((input) => {
            res[0].push([input.txID, input.outputIndex, input.signature.v, input.signature.r, input.signature.s]);
        });
        this.outputs.forEach((output) => {
            res[1].push([output.address, output.amount]);
        });
        return RLP.encode(res);
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

    tid() {
        return Buffer.from(web3Utils.soliditySha3.apply(null, this.typeVals(true)).substring(2), 'hex');
    }

    tidHex() {
        return '0x' + this.tid().toString('hex')
    }

    typeVals(includeSignatures) {
        let res = [];
        this.inputs.forEach(input => res = res.concat(input.typeVals(includeSignatures)));
        this.outputs.forEach(output => res = res.concat(output.typeVals()));
        res.push({
            type: 'uint',
            value: this.payload
        });
        return res;
    }

    isDeposit() {
        return this.inputs.length === 0
            && this.outputs.length === 1
            && this.outputs[0].amount > 0
    }

    verify(signature, address) {
        signature = signature || this.signature;

        const pubKey = ethjsUtil.ecrecover(new Buffer(this.hashHex().substring(2), 'hex'),
            signature.v,
            new Buffer(signature.r.substring(2), 'hex'),
            new Buffer(signature.s.substring(2), 'hex'));

        return address === ethjsUtil.bufferToHex(ethjsUtil.pubToAddress(pubKey));
    }
}

function toPaddedHexString(num, len) {
    num = num.substring(2);
    return '0x' + "0".repeat(len * 2 - num.length) + num;
}

module.exports = {
    Transaction: Transaction,
    TransactionOutput: TransactionOutput,
    TransactionInput: TransactionInput,
};