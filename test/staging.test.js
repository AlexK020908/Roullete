const { ethers, getNamedAccounts, network, deployments } = require("hardhat");
const { assert, expect } = require("chai");
const {
  developmentChains,
  networkConfig,
} = require("../helper-hardhat-config");

//first check
developmentChains.includes(network.name)
  ? describe.skip
  : describe("Smart roullete", function () {
      //variblaes
      let roullete;
      //first we need to deploy with beforeEach
      let deployer;
      let entranceFee;
      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        roullete = await ethers.getContract("Roullete", deployer); //deploy the contract with deployer as the deployer
        entranceFee = await roullete.getEntraceFee();
        console.log(roullete.address);
      });

      describe("fullfillrandomwords", function () {
        it("works with live chianlink keepers and VRF, get a random number", async function () {
          //we need to enter raffle --> nothing else since chianlink keepers and vrf will start the raffle for us
          const accounts = await ethers.getSigners(); //question --> does getsigners get the deployer as well ? why
          console.log("setting up accounts and starting time stamp");
          const startingTimeStamp = await roullete.getLatestTimeStamp();

          //set up listeners before we enter raffle
          await new Promise(async (resolve, reject) => {
            //once winner picked, we want to do something
            roullete.once("winnerpicked", async () => {
              //listening for an event --> which is waiting for the winner to be picked
              console.log("winners have be selected");
              try {
                console.log("getting winners");
                const amountOfWinners = await roullete.amountOfWinners();
                console.log(`there are ${amountOfWinners} winners`);
                console.log("getting roullete state");
                const roulleteState = await roullete.getroulletestate();
                console.log("getting time stamp ");
                const endingTimeStamp = await roullete.getLatestTimeStamp();
                console.log("getting all the len of each categories");
                const redplayersLen = await roullete.getNumberOfPlayersOfRed();
                const blackplayerslen =
                  await roullete.getNumberOfPlayersOfBlack();
                const greenplayersLen =
                  await roullete.getNumberOfPlayersOfGreen();

                for (let i = 0; i < amountOfWinners; i++) {
                  const winnerAtIndexI = await roullete.getRecentWinners(i);
                  console.log(winnerAtIndexI);
                }

                console.log("all players: \n");
                console.log(accounts[0].address);

                assert.equal(roulleteState, 0);
                console.log("comparing time stamps");
                let sumOfAllPlayers =
                  redplayersLen + blackplayerslen + greenplayersLen;
                assert(endingTimeStamp > startingTimeStamp);
                console.log(`there are ${sumOfAllPlayers} total players`);
                assert.equal(sumOfAllPlayers, 0);
                resolve();
              } catch (error) {
                //will reject if exceeds time limit
                reject(e);
              }
            });

            console.log("entering roullete...");
            console.log(`entrance fee: ${entranceFee.toString()}`);
            roullete
              .enterRed({ value: entranceFee })
              .then(async (tx) => {
                console.log("waiting for one block confirmation");
                await tx.wait(1);
              })
              .catch((err) => {
                console.error(err);
              });
          });
        });
      });
    });
