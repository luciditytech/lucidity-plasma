const ethjsUtil = require('ethereumjs-util');
const secp256k1 = require('secp256k1');
const crypto = require('crypto');

const Header = require('../js/lib/Header');
const MerkleTree = require('../js/lib/merkleTree');
const { Transaction, TransactionInput, TransactionOutput } = require('../js/lib/Transaction');
const Signature = require('../js/lib/Signature');
const UTXO = require('../js/lib/UTXO');

const Plasma = artifacts.require('./Plasma.sol');

contract('Plasma', async ([owner]) => {
  const utxo = new UTXO();

  it('check balance', async function () {
    assert.isTrue((await web3.eth.getBalance(owner) > 1.0));
  });

  let plasma;
  it('create contract', async function () {
    plasma = await Plasma.new(owner);
  });

  it('has an owner', async function () {
    assert.equal(await plasma.owner(), owner);
  });

  it('set operator', async function () {
    await plasma.setOperator(owner, true);
  });

  it('is operator', async function () {
    assert.isTrue(await plasma.isOperator());
  });

  it('validate transaction', async function () {
    const tx = Transaction.depositTransaction(privToAddr(privGen()), 1000, 500);

    assert.isTrue(await plasma.validateTranaction(tx.toRLPHex(), tx.hashHex()));
  });

  let headers = [];

  it('create block 1', async function () {
    const header = new Header(0, '0x0', '0x1');

    const event = (await plasma.submitBlockHeader(headers.length, header.toRLPHex())).logs.find(x =>
      x.event === 'HeaderSubmittedEvent');

    assert.equal(event.args._operator, owner);
    assert.equal(event.args._headerNumber, 0);
    assert.equal(event.args._headerHash, header.hashHex());

    headers.push(header);
  });

  it('verify block 1', async function () {
    (([version, prev, merkleRootHash, createdAt]) => {
      assert.equal(parseInt(version.toString()), headers[0].version);
      assert.equal(prev, headers[0].prev);
      assert.equal(merkleRootHash, headers[0].merkleRootHash);
      assert.equal(parseInt(createdAt.toString()), headers[0].createdAt);
    })(await plasma.headers(0));
  });

  it('create block 2', async function () {
    const header = new Header(0, headers[0].hashHex(), '0x2');

    const event = (await plasma.submitBlockHeader(headers.length, header.toRLPHex())).logs.find(x =>
      x.event === 'HeaderSubmittedEvent');

    assert.equal(event.args._operator, owner);
    assert.equal(event.args._headerNumber, 1);
    assert.equal(event.args._headerHash, header.hashHex());

    headers.push(header);
  });

  it('verify block 2', async function () {
    (([version, prev, merkleRootHash, createdAt]) => {
      assert.equal(parseInt(version.toString()), headers[1].version);
      assert.equal(prev, headers[1].prev);
      assert.equal(merkleRootHash, headers[1].merkleRootHash);
      assert.equal(parseInt(createdAt.toString()), headers[1].createdAt);
    })(await plasma.headers(1));
  });

  let depositTransaction1;
  let depositPriv;
  it('deposit 1', async function () {
    depositPriv = privGen();

    const depositRes = (await plasma.deposit(privToAddr(depositPriv), {
      value: 1000,
    }));

    const depositEvent = depositRes.logs.find(x => x.event === 'DepositEvent');
    assert.equal(depositEvent.args._from, privToAddr(depositPriv));
    assert.equal(depositEvent.args._amount, 1000);
    assert.equal(depositEvent.args._headerNumber, headers.length);

    const createdAt = (([version, prev, merkleRootHash, createdAt]) =>
      parseInt(createdAt.toString()))(await plasma.headers(headers.length));
    const prevHash = headers[headers.length - 1].hashHex();

    const tx = depositTransaction1 = Transaction.depositTransaction(privToAddr(depositPriv),
      1000, headers.length);
    assert.isTrue(tx.isDeposit());

    const header = new Header(0, prevHash, tx.hashHex(), createdAt);

    const headerSubmittedEvent = depositRes.logs.find(x => x.event === 'HeaderSubmittedEvent');
    assert.equal(headerSubmittedEvent.args._operator, owner);
    assert.equal(headerSubmittedEvent.args._headerNumber, headers.length);

    (([version, prev, merkleRootHash, createdAt]) => {
      assert.equal(parseInt(version.toString()), header.version);
      assert.equal(prev, prevHash);
      assert.equal(merkleRootHash, tx.hashHex());
      assert.equal(parseInt(createdAt.toString()), createdAt);
    })(await plasma.headers(headers.length));

    assert.equal(headerSubmittedEvent.args._headerHash, header.hashHex());

    utxo.addTransaction(depositTransaction1);
    assert.equal(utxo.outputsCount(), 1);
    assert.equal(utxo.outputsCount(privToAddr(depositPriv)), 1);
    assert.equal(utxo.addressesCount(), 1);
    assert.equal(utxo.balance(privToAddr(depositPriv)), 1000);
    assert.equal(utxo.balance(), 1000);

    headers.push(header);
  });

  let depositTransaction2;
  it('deposit 2', async function () {
    const depositRes = (await plasma.deposit(privToAddr(depositPriv), {
      value: 500,
    }));

    const depositEvent = depositRes.logs.find(x => x.event === 'DepositEvent');
    assert.equal(depositEvent.args._from, privToAddr(depositPriv));
    assert.equal(depositEvent.args._amount, 500);
    assert.equal(depositEvent.args._headerNumber, headers.length);

    const createdAt = (([version, prev, merkleRootHash, createdAt]) =>
      parseInt(createdAt.toString()))(await plasma.headers(headers.length));
    const prevHash = headers[headers.length - 1].hashHex();

    const tx = depositTransaction2 = Transaction.depositTransaction(
      privToAddr(depositPriv), 500, headers.length);
    assert.isTrue(tx.isDeposit());

    const header = new Header(0, prevHash, tx.hashHex(), createdAt);

    const headerSubmittedEvent = depositRes.logs.find(x => x.event === 'HeaderSubmittedEvent');
    assert.equal(headerSubmittedEvent.args._operator, owner);
    assert.equal(headerSubmittedEvent.args._headerNumber, headers.length);

    (([version, prev, merkleRootHash, createdAt]) => {
      assert.equal(parseInt(version.toString()), header.version);
      assert.equal(prev, prevHash);
      assert.equal(merkleRootHash, tx.hashHex());
      assert.equal(parseInt(createdAt.toString()), createdAt);
    })(await plasma.headers(headers.length));

    assert.equal(headerSubmittedEvent.args._headerHash, header.hashHex());

    utxo.addTransaction(depositTransaction2);
    assert.equal(utxo.outputsCount(), 2);
    assert.equal(utxo.outputsCount(privToAddr(depositPriv)), 2);
    assert.equal(utxo.addressesCount(), 1);
    assert.equal(utxo.balance(privToAddr(depositPriv)), 1500);
    assert.equal(utxo.balance(), 1500);

    headers.push(header);
  });

  let spendPriv;
  let spendTransaction1;
  let spendTransaction2;
  it('move', async function () {
    spendPriv = privGen();
    const payeeOutput1 = new TransactionOutput(privToAddr(spendPriv), 1000);
    const tx1 = spendTransaction1 = txWithSignatures(
      [new TransactionInput(depositTransaction1.tidHex(), 0)], [payeeOutput1], [depositPriv]);

    const signature1 = tx1.inputs[0].signature;

    assert.isTrue(tx1.verify(signature1, privToAddr(depositPriv)));
    assert.isTrue(await plasma.validate(tx1.hashHex(), privToAddr(depositPriv),
        signature1.v, signature1.r, signature1.s));

    const payeeOutput2 = new TransactionOutput(privToAddr(spendPriv), 500);
    const tx2 = spendTransaction2 = txWithSignatures(
      [new TransactionInput(depositTransaction2.tidHex(), 0)], [payeeOutput2], [depositPriv]);

    const signature2 = sign(tx2.hashHex(), depositPriv);

    assert.isTrue(tx2.verify(signature2, privToAddr(depositPriv)));
    assert.isTrue(await plasma.validate(tx2.hashHex(), privToAddr(depositPriv),
        signature2.v, signature2.r, signature2.s));

    const prevHash = headers[headers.length - 1].hashHex();

    const merkleTree = new MerkleTree([spendTransaction1.tid(), spendTransaction2.tid()]);

    const header = new Header(0, prevHash, merkleTree.getHexRoot());

    const event = (await plasma.submitBlockHeader(headers.length, header.toRLPHex())).logs.find(x =>
      x.event === 'HeaderSubmittedEvent');

    assert.equal(event.args._operator, owner);
    assert.equal(event.args._headerNumber, headers.length);
    assert.equal(event.args._headerHash, header.hashHex());

    headers.push(header);
  });

  it('withdraw', async function () {
    // create exit transactions
    const exitOutput1 = new TransactionOutput('0x0', 1000);
    const exitTransaction1 = txWithSignatures(
      [new TransactionInput(spendTransaction1.tidHex(), 0)], [exitOutput1], [spendPriv]);

    const exitOutput2 = new TransactionOutput('0x0', 500);
    const exitTransaction2 = txWithSignatures(
      [new TransactionInput(spendTransaction2.tidHex(), 0)], [exitOutput2], [spendPriv]);

    const exitMerkleTree = new MerkleTree([exitTransaction1.tid(), exitTransaction2.tid()]);

    const prevHash = headers[headers.length - 1].hashHex();

    const exitHeader = new Header(0, prevHash, exitMerkleTree.getHexRoot());

    await plasma.submitBlockHeader(headers.length, exitHeader.toRLPHex());

    headers.push(exitHeader);

    // withdraw part
    const merkleTree = new MerkleTree([spendTransaction1.tid(), spendTransaction2.tid()]);

    const event1 = (await plasma.withdraw(headers.length - 2, spendTransaction1.toRLPHex(), merkleTree.getHexProof(spendTransaction1.tid()), 0,
      headers.length - 1, exitTransaction1.toRLPHex(), exitMerkleTree.getHexProof(exitTransaction1.tid()))).logs.find(x => x.event === 'WithdrawEvent');

    assert.equal(event1.args._to, privToAddr(spendPriv));
    assert.equal(event1.args._amount, 1000);
    assert.equal(event1.args._exitTxID, exitTransaction1.tidHex());

    const event2 = (await plasma.withdraw(headers.length - 2, spendTransaction2.toRLPHex(), merkleTree.getHexProof(spendTransaction2.tid()), 0,
      headers.length - 1, exitTransaction2.toRLPHex(), exitMerkleTree.getHexProof(exitTransaction2.tid()))).logs.find(x => x.event === 'WithdrawEvent');

    assert.equal(event2.args._to, privToAddr(spendPriv));
    assert.equal(event2.args._amount, 500);
    assert.equal(event2.args._exitTxID, exitTransaction2.tidHex());

    // double-spend
    try {
      await plasma.withdraw(headers.length - 2, spendTransaction1.toRLPHex(), merkleTree.getHexProof(spendTransaction1.tid()), 0,
        headers.length - 1, exitTransaction1.toRLPHex(), exitMerkleTree.getHexProof(exitTransaction1.tid()));
    } catch (err) {
      assert.isTrue(err.message.includes('VM Exception'));
    }
  });
});

function privGen() {
  const buf = Buffer.alloc(32);
  let privKey;
  do {
    privKey = crypto.randomFillSync(buf);
  } while (!secp256k1.privateKeyVerify(privKey));

  return privKey;
}

function privToAddr(privKey) {
  return ethjsUtil.bufferToHex(ethjsUtil.pubToAddress(ethjsUtil.privateToPublic(privKey)));
}

function sign(hex, privKey) {
  const { v, r, s } = ethjsUtil.ecsign(new Buffer(hex.substring(2), 'hex'), privKey);
  return new Signature(v, `0x${r.toString('hex')}`, `0x${s.toString('hex')}`);
}

function txWithSignatures(inputs, outputs, privateKeys) {
  const noSigTransaction = new Transaction(inputs, outputs);

  const signedInputs = [];
  inputs.forEach((input, i) => {
    const signature = sign(noSigTransaction.hashHex(), privateKeys[i]);

    signedInputs.push(new TransactionInput(input.txID, input.outputIndex, signature));
  });

  return new Transaction(signedInputs, outputs);
}
