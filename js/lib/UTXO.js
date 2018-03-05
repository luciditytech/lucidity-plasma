const web3Utils = require('web3-utils');
const RLP = require('rlp');
const createKeccakHash = require('keccak');

class UTXO {

    constructor() {
        this.map = {};
    }

    addTransactions(transactions) {
        transactions.forEach((tx) => this.addTransaction(tx));
    }

    addTransaction(tx) {
        if (tx.isDeposit()) {
            const address = tx.outputs[0].address;
            const amount = tx.outputs[0].amount;
            const transactions = this.map[address] || (this.map[address] = []);

            transactions.push({
                amount: amount,
                outputIndex: 0,
                txID: tx.hashHex()
            });

            return;
        }

        const txID = tx.hashHex();
        tx.inputs.forEach((input, outputIndex) => {
            const transactions = this.map.outputs[input.address] || (this.map[input.address] = []);

            transactions.push({
                amount: out.amount,
                outputIndex: outputIndex,
                txID: txID
            });
        });

        tx.outputs.forEach((output, outputIndex) => {
            const transactions = this.map.outputs[output.address] || (this.map[output.address] = []);

            transactions.push({
                amount: output.amount,
                outputIndex: outputIndex,
                txID: txID
            });
        });
    }

    balance(address) {
        if (!address) {
            let res = 0;
            for (let a in this.map) {
                res += this.balance(a);
            }
            return res;
        }

        let res = 0;
        (this.map[address] || [])
            .forEach((it) => res += it.amount);
        return res;
    }

    addressesCount() {
        return Object.keys(this.map).length;
    }

    outputsCount() {
        let res = 0;
        for (let address in this.map) {
            res += this.map[address].length;
        }
        return res;
    }
}

module.exports = UTXO;