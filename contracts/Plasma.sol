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

        // signature part
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct TransactionOutput {
        address recipient;
        uint amount;
    }

    struct Transaction {
        TransactionInput[] inputs;
        TransactionOutput[] outputs;

        // extra data
        uint payload;
    }

    function() external {
    }

    function deposit(address addr) payable external returns (bool success) {
        assert(msg.value > 0);

        TransactionInput[] memory inputs = new TransactionInput[](0);
        TransactionOutput[] memory outputs = new TransactionOutput[](1);
        outputs[0] = TransactionOutput({
            recipient: addr,
            amount: msg.value});

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

    mapping(bytes32 => mapping(uint => bool)) public withdrawTXs;

    function withdraw(uint _headerNumber,
        bytes _transactionBytes, bytes _proof,
        uint outputIndex,
        uint8 _v, bytes32 _r, bytes32 _s) public returns (bool success) {
        assert(_headerNumber < headersCount);
        Header storage header = headers[_headerNumber];

        // check if the transaction exists
        Transaction memory transaction = decodeTransaction(_transactionBytes);
        bytes32 hash = hashTransaction(transaction);
        bytes32 txID = tid(transaction);

        assert(!withdrawTXs[txID][outputIndex]);

        require(MerkleProof.verifyProof(_proof, header.merkleRootHash, txID));

        assert(transaction.outputs.length == 1);
        address addr = transaction.outputs[0].recipient;

        require(ecrecover(txID, _v, _r, _s) == addr);

        uint amount = transaction.outputs[0].amount;
        assert(amount > 0);

        addr.transfer(amount);

        WithdrawEvent(addr, amount, txID);

        return true;
    }

    event WithdrawEvent(address indexed _to, uint indexed _amount, bytes32 indexed _txID);

    function hashTransaction(Transaction memory _transaction) internal returns (bytes32) {
        bytes memory res;
        for (uint i = 0; i < _transaction.inputs.length; ++i) {
            res = mergeBytes(res, toBytes(_transaction.inputs[i].txID));
            res = mergeBytes(res, toBytes(_transaction.inputs[i].outputIndex));
        }
        for (i = 0; i < _transaction.outputs.length; ++i) {
            res = mergeBytes(res, toBytes(_transaction.outputs[i].recipient));
            res = mergeBytes(res, toBytes(_transaction.outputs[i].amount));
        }
        res = mergeBytes(res, toBytes(_transaction.payload));

        return keccak256(res);
    }

    function tid(Transaction memory _transaction) internal returns (bytes32) {
        bytes memory res;
        for (uint i = 0; i < _transaction.inputs.length; ++i) {
            res = mergeBytes(res, toBytes(_transaction.inputs[i].txID));
            res = mergeBytes(res, toBytes(_transaction.inputs[i].outputIndex));

            res = mergeBytes(res, uint8_toBytes(_transaction.inputs[i].v));
            res = mergeBytes(res, toBytes(_transaction.inputs[i].r));
            res = mergeBytes(res, toBytes(_transaction.inputs[i].s));
        }
        for (i = 0; i < _transaction.outputs.length; ++i) {
            res = mergeBytes(res, toBytes(_transaction.outputs[i].recipient));
            res = mergeBytes(res, toBytes(_transaction.outputs[i].amount));
        }
        res = mergeBytes(res, toBytes(_transaction.payload));

        return keccak256(res);
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

        RLP.RLPItem[] memory rlpInputs = item[0].toList();
        RLP.RLPItem[] memory rlpOutputs = item[1].toList();

        TransactionInput[] memory inputs = new TransactionInput[](rlpInputs.length);
        for (uint i = 0; i < rlpInputs.length; ++i) {
            RLP.RLPItem[] memory values = rlpInputs[i].toList();
            inputs[i] = TransactionInput({
                txID: values[0].toBytes32(),
                outputIndex: values[1].toUint(),
                v: uint8(values[2].toUint()),
                r: values[3].toBytes32(),
                s: values[4].toBytes32()
            });
        }

        TransactionOutput[] memory outputs = new TransactionOutput[](rlpOutputs.length);
        for (i = 0; i < rlpOutputs.length; ++i) {
            values = rlpOutputs[i].toList();
            outputs[i] = TransactionOutput({
                recipient: values[0].toAddress(),
                amount: values[1].toUint()
            });
        }

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

    function toBytes(uint256 x) constant returns (bytes b) {
        b = new bytes(32);
        assembly { mstore(add(b, 32), x) }
    }

    function toBytes(bytes32 x) constant returns (bytes b) {
        b = new bytes(32);
        assembly { mstore(add(b, 32), x) }
    }

    function uint8_toBytes(uint8 x) constant returns (bytes b) {
        bytes memory res = toBytes(uint256(x));
        b = new bytes(1);
        b[0] = res[31];
    }

    function toBytes(address a) constant returns (bytes b){
        assembly {
            let m := mload(0x40)
            mstore(add(m, 20), xor(0x140000000000000000000000000000000000000000, a))
            mstore(0x40, add(m, 52))
            b := m
        }
    }

    function mergeBytes(bytes left, bytes right) constant returns (bytes b) {
        b = new bytes(left.length + right.length);
        for (uint256 i = 0; i < left.length; ++i) {
            b[i] = left[i];
        }
        for (i = 0; i < right.length; ++i) {
            b[i + left.length] = right[i];
        }
    }
}
