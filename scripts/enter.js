const { ethers } = require("hardhat");

async function enterRoullete() {
  const roullete = await ethers.getContract("Roullete");
  const entranceFee = await roullete.getEntranceFee();
  await roullete.enterRed({ value: entranceFee + 1 });
  console.log("Entered!");
}

enterRoullete()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
