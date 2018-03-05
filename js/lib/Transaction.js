const web3Utils = require('web3-utils');
const ethjsUtil = require('ethereumjs-util')

const RLP = require('rlp');

class Signature {
    constructor(v, r, s) {
        Object.defineProperty(this, 'v', {
            value: v,
            writable: false
        });
        Object.defineProperty(this, 'r', {
            value: r,//toPaddedHexString(r, 32),
            writable: false
        });
        Object.defineProperty(this, 's', {
            value: s,//toPaddedHexString(s, 32),
            writable: false
        });
    }

    static none() {
        return new Signature("0x0", "0x0", "0x0");
    }

    static fromHex(hex) {
        let vrs = ethjsUtil.fromRpcSig(hex);
        return new Signature(vrs.v, "0x" + vrs.r.toString('hex'), "0x" + vrs.s.toString('hex'));
    }
}

class TransactionInput {
    constructor(txID, outputIndex) {
        Object.defineProperty(this, 'txID', {
            value: toPaddedHexString(txID, 32),
            writable: false
        });
        Object.defineProperty(this, 'outputIndex', {
            value: outputIndex,
            writable: false
        });
    }

    typeVals() {
        return [{
            type: 'bytes32',
            value: this.txID
        }, {
            type: 'uint',
            value: this.outputIndex
        }];
    }

    static none() {
        return new TransactionInput("0x0", 0x0);
    }

    equals(obj) {
        return JSON.stringify(this.typeVals()) === JSON.stringify(obj.typeVals());
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
        if (inputs.length !== 2) throw "Must be 2 inputs";
        if (outputs.length !== 2) throw "Must be 2 outputs";

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

        return new Transaction([TransactionInput.none(), TransactionInput.none()], [payeeOutput, TransactionOutput.none()], headerIndex);
    }

    toRLP() {
        const res = [[], [], this.payload];
        this.inputs.forEach((input) => {
            res[0].push([input.txID, input.outputIndex]);
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

    typeVals() {
        let res = [];
        this.inputs.forEach(input => res = res.concat(input.typeVals()));
        this.outputs.forEach(output => res = res.concat(output.typeVals()));
        res.push({
            type: 'uint',
            value: this.payload
        });
        return res;
    }

    isDeposit() {
        return this.inputs.length === 2
            && this.outputs.length === 2
            && this.inputs[0].equals(TransactionInput.none())
            && this.inputs[1].equals(TransactionInput.none())
            && this.outputs[0].amount > 0
            && this.outputs[1].equals(TransactionOutput.none());
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
    Signature: Signature
};