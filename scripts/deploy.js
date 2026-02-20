const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  // Deploy TestUSDC
  const TestUSDC = await hre.ethers.getContractFactory("TestUSDC");
  const usdc = await TestUSDC.deploy("Test USDC", "tUSDC");
  await usdc.deployed();
  console.log("TestUSDC deployed to:", usdc.address);

  // Deploy SimpleAMM
  const SimpleAMM = await hre.ethers.getContractFactory("SimpleAMM");
  const amm = await SimpleAMM.deploy(usdc.address);
  await amm.deployed();
  console.log("SimpleAMM deployed to:", amm.address);

  // Deploy SimpleLender (80% collateralization ratio)
  const SimpleLender = await hre.ethers.getContractFactory("SimpleLender");
  const lender = await SimpleLender.deploy(usdc.address, amm.address, 8000);
  await lender.deployed();
  console.log("SimpleLender deployed to:", lender.address);

  // Deploy Attacker
  const Attacker = await hre.ethers.getContractFactory("Attacker");
  const attacker = await Attacker.deploy();
  await attacker.deployed();
  console.log("Attacker deployed to:", attacker.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
