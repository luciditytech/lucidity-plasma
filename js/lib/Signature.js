const ethjsUtil = require('ethereumjs-util');

class Signature {
  constructor(v, r, s) {
    Object.defineProperty(this, 'v', {
      value: v,
    });
    Object.defineProperty(this, 'r', {
      value: r,//toPaddedHexString(r, 32),
    });
    Object.defineProperty(this, 's', {
      value: s,//toPaddedHexString(s, 32),
    });
  }

  static none() {
    return new Signature('0x0', '0x0', '0x0');
  }

  static fromHex(hex) {
    const { v, r, s } = ethjsUtil.fromRpcSig(hex);
    return new Signature(v, `0x${r.toString('hex')}`, `0x${s.toString('hex')}`);
  }
}

module.exports = Signature;
