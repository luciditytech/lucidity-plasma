pragma solidity ^0.4.17;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/Plasma.sol";

contract TestPlasma {

    Plasma plasma = new Plasma();

    function testSetOperator() public {
        Assert.equal(plasma.setOperator(this, true), true, "Set an operator.");
    }

    function testOwnerIsOperator() public {
        Assert.equal(plasma.isOperator(), true, "Owner is an operator.");
    }
}