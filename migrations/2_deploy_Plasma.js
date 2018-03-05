const Plasma = artifacts.require("./Plasma.sol");
const MerkleProof = artifacts.require("./MerkleProof.sol");

module.exports = function(deployer) {
  deployer.deploy(MerkleProof);

  deployer.link(MerkleProof, Plasma);
  deployer.deploy(Plasma);
};
