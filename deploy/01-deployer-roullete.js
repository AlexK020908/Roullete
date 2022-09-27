const { network, ethers } = require("hardhat");
const { networkConfig } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");
module.exports = async ({ getNamedAccounts, deployments }) => {
  //getting the deployer, and the deploy function
  let VRFCoordinatorV2;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("2");
  let subID;
  if (chainId == 31337) {
    const mockcontract = await ethers.getContract("VRFCoordinatorV2Mock"); //or ehters.getContract
    VRFCoordinatorV2 = mockcontract.address;

    //we are going to create a subscription
    const txresponse = await mockcontract.createSubscription(); //since with a real contract we are just calling create subs on the UI
    const receipt = await txresponse.wait(1);
    subID = receipt.events[0].args.subId; //look at the createsub in node modules --> it actually emit an event with the event --> in the mock
    await mockcontract.fundSubscription(subID, VRF_SUB_FUND_AMOUNT);
  } else {
    VRFCoordinatorV2 = networkConfig[chainId]["vrfCoordinator"];
    subID = networkConfig[chainId]["subscriptionID"];
  }
  const args = [
    networkConfig[chainId]["entranceFee"],
    VRFCoordinatorV2,
    networkConfig[chainId]["gasLane"],
    subID,
    networkConfig[chainId]["callbackGasLimit"],
  ];
  const raffle = await deploy("Roullete", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  });

  if (chainId != 31337 && process.env.ETH_API_KEY) {
    await verify(raffle.address, args);
  }

  log("----------------------");
};
//the args for calling this function
/*
        uint256 entranceFee,
        address VRFCoordinatorV2, //contract address --> probably need a mock for this ....
        bytes32 gasLane,     
        uint64 subscriptionId,
        uint32 callbackGasLimit

        we can specify these in the helper hardhat config 
*/

module.exports.tags = ["all", "raffle"];
