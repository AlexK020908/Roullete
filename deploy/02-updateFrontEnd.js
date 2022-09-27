const { ethers, network } = require("hardhat");
fs = require("fs");

//write a script that is connected to the front end
const FRONT_END_ADD_FILE =
  "../roullete-front-end/constants/contractAddresses.json";
const FRONT_end_ABI_FILE = "../roullete-front-end/constants/abi.json";
module.exports = async function () {
  if (process.env.UPDATE_FRONT_END) {
    console.log("updating front end ");
    console.log(`CHAINid : ${network.config.chainId}`);
    await updateContractAddresses();
    await updateABI();
  }
};

async function updateContractAddresses() {
  const roullete = await ethers.getContract("Roullete");
  console.log(`CHAINid : ${network.config.chainId}`);
  //if we do not have a second paramter, it is automatically tied to deployer
  const currAdd = JSON.parse(fs.readFileSync(FRONT_END_ADD_FILE, "utf8"));
  if (network.config.chainId.toString() in currAdd) {
    //make sure the network we are running on is in that location in our front end
    //check if our chainId is already included
    if (
      !currAdd[network.config.chainId.toString()].includes(roullete.address)
    ) {
      currAdd[network.config.chainId.toString()].push(roullete.address);
    }
  } else {
    //if the chainId we are running on is not included ,
    //simply initlaize a new one
    currAdd[network.config.chainId] = [roullete.address];
  }

  //finally write it back to the file
  fs.writeFileSync(FRONT_END_ADD_FILE, JSON.stringify(currAdd));
}

async function updateABI() {
  const roullete = await ethers.getContract("Roullete"); //if we didn't specify a signer --> will return the deployer by default --> the first element in the signers array
  fs.writeFileSync(
    FRONT_end_ABI_FILE,
    roullete.interface.format(ethers.utils.FormatTypes.json)
  );
}
module.exports.tags = ("all", "frontend");
