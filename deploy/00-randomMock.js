const { network, ethers } = require("hardhat");

const BASE_FEE = ethers.utils.parseEther("0.25"); // 0.25 is this the premium in LINK?
const GAS_PRICE_LINK = 1e9; // link per gas, is this the gas lane? // 0.000000001 LINK per gas

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  // If we are on a local development network, we need to deploy mocks!
  if (chainId == 31337) {
    log("Local network detected! Deploying mocks...");
    await deploy("VRFCoordinatorV2Mock", {
      //note that the name of our mock in tht test in the contract folder has to be the same as the name for
      //import "@chainlink/contracts/src/v0.8/mocks/VRFCoordinatorV2Mock.sol";  which is VRFCoordinatorV2Mock
      contract: "VRFCoordinatorV2Mock",
      from: deployer,
      log: true,
      args: [BASE_FEE, GAS_PRICE_LINK], //the parameters are the parameters in the mock contract for the constructor
    });

    log("Mocks Deployed!");
    log("----------------------------------------------------------");
    log(
      "You are deploying to a local network, you'll need a local network running to interact"
    );
    log(
      "Please run `yarn hardhat console --network localhost` to interact with the deployed smart contracts!"
    );
    log("----------------------------------------------------------");
  }
};
module.exports.tags = ["all", "mocks"];

//ethers.utils.parseEther("0.25")
