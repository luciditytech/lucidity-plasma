pragma solidity 0.4.19;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import 'zeppelin-solidity/contracts/math/Math.sol';
import 'zeppelin-solidity/contracts/MerkleProof.sol';

import "./lib/RLP.sol";

contract Plasma is Ownable {
    using RLP for bytes;
    using RLP for RLP.RLPItem;
    using RLP for RLP.Iterator;

    // operators
    mapping(address => bool) public operators;

    modifier onlyOperator() {
        if (operators[msg.sender]) _;
    }

    function setOperator(address _op, bool _status) public returns (bool success) {
        require(msg.sender == owner);
        operators[_op] = _status;
        return true;
    }

    function isOperator() public view returns (bool success) {
        return operators[msg.sender];
    }

    mapping(uint => Header) public headers;
    uint public headersCount;

    struct Header {
        uint version;

        // hashes
        bytes32 prev;
        bytes32 merkleRootHash;

        uint createdAt;
    }

    event HeaderSubmittedEvent(address indexed _operator, uint indexed _headerNumber, bytes32 indexed _headerHash);

    function submitBlockHeader(uint _headerNumber, bytes _headerBytes) external onlyOperator returns (bool success) {
        assert(_headerNumber == headersCount);

        Header memory header = decodeHeader(_headerBytes);

        if (headersCount != 0) {
            Header storage previousHeader = headers[headersCount - 1];
            bytes32 previousHash = hashHeader(previousHeader);
            require(previousHash == header.prev);
        } else {
            require(header.prev == 0x0);
        }

        return submitBlockHeader(header);
    }

    function submitBlockHeader(Header memory header) private returns (bool success) {

        headers[headersCount] = header;

        bytes32 newHeaderHash = hashHeader(header);

        HeaderSubmittedEvent(msg.sender, headersCount, newHeaderHash);

        headersCount += 1;

        return true;
    }

    struct TransactionInput {
        bytes32 txID;
        uint outputIndex;
    }

    struct TransactionOutput {
        address recipient;
        uint amount;
    }

    struct Transaction {
        TransactionInput[2] inputs;
        TransactionOutput[2] outputs;

        // extra data
        uint payload;
    }

    function() external {
    }

    function deposit(address addr) payable external returns (bool success) {
        assert(msg.value > 0);

        TransactionInput memory emptyInput = TransactionInput({
            txID: 0x0,
            outputIndex: 0x0
        });

        TransactionOutput memory emptyOutput = TransactionOutput({
            recipient: 0x0,
            amount: 0x0});
        TransactionOutput memory payeeOutput = TransactionOutput({
            recipient: addr,
            amount: msg.value});

        TransactionInput[2] memory inputs;
        inputs[0] = emptyInput;
        inputs[1] = emptyInput;

        TransactionOutput[2] memory outputs;
        outputs[0] = payeeOutput;
        outputs[1] = emptyOutput;

        Transaction memory tx = Transaction({
            inputs: inputs,
            outputs: outputs,
            payload: headersCount
        });

        bytes32 txID = hashTransaction(tx);

        Header memory header = Header({
            version: 0x0,
            prev: 0x0,
            merkleRootHash: txID,
            createdAt: block.timestamp
        });

        if (headersCount != 0) {
            Header storage previousHeader = headers[headersCount - 1];
            header.prev = hashHeader(previousHeader);
        }

        DepositEvent(addr, msg.value, headersCount);

        return submitBlockHeader(header);
    }

    event DepositEvent(address indexed _from, uint indexed _amount, uint indexed _headerNumber);

    function withdraw(uint _headerNumber, bytes _transactionBytes, bytes32 _txHash, bytes _proof,
        uint8 _v, bytes32 _r, bytes32 _s) public returns (bool success) {
        assert(_headerNumber < headersCount);
        Header storage header = headers[_headerNumber];

        // check if the transaction exists
        Transaction memory transaction = decodeTransaction(_transactionBytes);
        bytes32 txID = hashTransaction(transaction);

        require(MerkleProof.verifyProof(_proof, header.merkleRootHash, txID));

        // should be signed by the receiver
        address addr = ecrecover(txID, _v, _r, _s);
        require(transaction.outputs[0].recipient == address(0x0)
            || transaction.outputs[0].recipient == addr);
        require(transaction.outputs[1].recipient == address(0x0)
            || transaction.outputs[1].recipient == addr);

        uint amount = transaction.outputs[0].amount + transaction.outputs[1].amount;
        require(amount > 0);

        addr.transfer(amount);

        WithdrawEvent(addr, amount, txID);

        return true;
    }

    event WithdrawEvent(address indexed _to, uint indexed _amount, bytes32 indexed _txID);

    function hashTransaction(Transaction memory _transaction) internal returns (bytes32) {
        /*bytes memory bversion = toBytes(_header.version);
        bytes memory bprev = toBytes(_header.prev);
        bytes memory bmerkleRootHash = toBytes(_header.merkleRootHash);
        bytes memory bcreatedAt = toBytes(_header.createdAt);*/
        return keccak256(_transaction.inputs[0].txID, _transaction.inputs[0].outputIndex,
            _transaction.inputs[1].txID, _transaction.inputs[1].outputIndex,
            _transaction.outputs[0].recipient, _transaction.outputs[0].amount,
            _transaction.outputs[1].recipient, _transaction.outputs[1].amount,
            _transaction.payload);
    }

    function hashHeader(Header memory _header) internal returns (bytes32) {
        /*bytes memory bversion = toBytes(_header.version);
        bytes memory bprev = toBytes(_header.prev);
        bytes memory bmerkleRootHash = toBytes(_header.merkleRootHash);
        bytes memory bcreatedAt = toBytes(_header.createdAt);
        return keccak256(mergeBytes(mergeBytes(mergeBytes(bversion, bprev), bmerkleRootHash), bcreatedAt));
        */
        return keccak256(_header.version, _header.prev, _header.merkleRootHash, _header.createdAt);
    }

    function decodeHeader(bytes memory _headerBytes) internal returns (Header) {
        RLP.RLPItem[] memory item = _headerBytes.toRLPItem().toList();
        uint version = item[0].toUint();
        assert(version == 0);

        Header memory header = Header({
            version: version,
            prev: item[1].toBytes32(),
            merkleRootHash: item[2].toBytes32(),
            createdAt: item[3].toUint()
        });

        return header;
    }

    function decodeTransaction(bytes memory _transactionBytes) internal returns (Transaction) {
        RLP.RLPItem[] memory item = _transactionBytes.toRLPItem().toList();

        RLP.RLPItem[] memory arr = item[0].toList();
        RLP.RLPItem[] memory val0 = arr[0].toList();
        RLP.RLPItem[] memory val1 = arr[1].toList();

        TransactionInput memory in1 = TransactionInput({
            txID: val0[0].toBytes32(),
            outputIndex: val0[1].toUint()
        });
        TransactionInput memory in2 = TransactionInput({
            txID: val1[0].toBytes32(),
            outputIndex: val1[1].toUint()
        });

        arr = item[1].toList();
        val0 = arr[0].toList();
        val1 = arr[1].toList();

        TransactionOutput memory out1 = TransactionOutput({
            recipient: val0[0].toAddress(),
            amount: val0[1].toUint()});
        TransactionOutput memory out2 = TransactionOutput({
            recipient: val1[0].toAddress(),
            amount: val1[1].toUint()});

        TransactionInput[2] memory inputs;
        inputs[0] = in1;
        inputs[1] = in2;

        TransactionOutput[2] memory outputs;
        outputs[0] = out1;
        outputs[1] = out2;

        Transaction memory tx = Transaction({
            inputs: inputs,
            outputs: outputs,
            payload: item[2].toUint()
        });

        return tx;
    }

    function validate(bytes32 _data, address _addr, uint8 _v, bytes32 _r, bytes32 _s) public constant returns (bool) {
        return ecrecover(_data, _v, _r, _s) == _addr;
    }

    function validateTranaction(bytes _transactionBytes, bytes32 _txHash) public constant returns (bool) {
        Transaction memory transaction = decodeTransaction(_transactionBytes);

        return hashTransaction(transaction) == _txHash;
    }

    function toBytes(uint256 x) returns (bytes b) {
        b = new bytes(32);
        assembly { mstore(add(b, 32), x) }
    }

    function toBytes(bytes32 x) returns (bytes b) {
        b = new bytes(32);
        assembly { mstore(add(b, 32), x) }
    }

    function mergeBytes(bytes left, bytes right) returns (bytes b) {
        b = new bytes(left.length + right.length);
        for (uint256 i = 0; i < left.length; ++i) {
            b[i] = left[i];
        }
        for (i = 0; i < right.length; ++i) {
            b[i + left.length] = right[i];
        }
    }
}
