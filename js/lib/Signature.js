const ethjsUtil = require('ethereumjs-util')

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

module.exports = Signature;