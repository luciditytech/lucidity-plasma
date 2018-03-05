const expect = require("chai").expect;
const RLP = require('rlp');

describe("RLP", function() {
    describe("Encode", function() {
        it('Encode three', function() {
            expect(RLP.encode([ [], [[]], [ [], [[]] ] ]).toString('hex')).to.equal('c7c0c1c0c3c0c1c0');
        });

        it('Encode empty list', function() {
            expect(RLP.encode([]).toString('hex')).to.equal('c0');
        });

        it("Encode 'dog'", function() {
            expect(RLP.encode('dog').toString('hex')).to.equal('83646f67');
        });

        it("Encode 'cat'", function() {
            expect(RLP.encode('cat').toString('hex')).to.equal('83636174');
        });

        it("Encode 'cat & dog'", function() {
            expect(RLP.encode([ "cat", "dog" ]).toString('hex')).to.equal('c88363617483646f67');
        });

        it('Encode space', function() {
            expect(RLP.encode('').toString('hex')).to.equal('80');
        });

        it('Encode 0', function() {
            expect(RLP.encode(0).toString('hex')).to.equal('80');
        });

        it('Encode 15', function() {
            expect(RLP.encode(15).toString('hex')).to.equal('0f');
        });

        it('Encode 1024', function() {
            expect(RLP.encode(1024).toString('hex')).to.equal('820400');
        });
    });

    describe("Decode", function() {
    });
});