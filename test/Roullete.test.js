const { ethers, getNamedAccounts, network, deployments } = require("hardhat");
const { assert, expect } = require("chai");
const {
  developmentChains,
  networkConfig,
} = require("../helper-hardhat-config");

//first check
!developmentChains.includes(network.name) //we do not want to run this script if we are on a local network since its a local test
  ? describe.skip
  : describe("Smart Rollete", function () {
      //variblaes
      let roullete;
      //first we need to deploy with beforeEach
      let deployer;
      let entranceFee;
      let VRFCoordinatorV2Mock;
      let interval;
      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]); //dploy all contracts including
        roullete = await ethers.getContract("Roullete", deployer); //deploy the contract with deployer as the wallet that deployed the deployer
        //notice if we do not sepcify a second paramter --> it is defaulted to connected to deployer
        VRFCoordinatorV2Mock = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          deployer
        );
        entranceFee = await roullete.getEntraceFee();
        interval = await roullete.getInterval();
      });

      describe("constructor", function () {
        it("initializes the raffle correctly", async function () {
          const roulleteState = await roullete.getroulletestate(); //uint256 --> big number
          assert.equal(roulleteState.toString(), "0");

          const entranceFee = await roullete.getEntraceFee();
          assert.equal(
            networkConfig[31337]["entranceFee"],
            entranceFee.toString()
          );

          const gasLane = await roullete.getgasLane();
          assert.equal(networkConfig[31337]["gasLane"], gasLane.toString());
        });
      });

      describe("entering roullete", function () {
        //first test is throws an error with msg.value < i_entracefee
        it("not enough eth", async function () {
          await expect(roullete.enterRed()).to.be.reverted;
        });

        it("passes if enought eath is sent", async function () {
          await roullete.enterRed({ value: entranceFee });
          //check if sender is in players
          //get the players first
          const player = await roullete.getRedPlayer(0);
          assert.equal(player, deployer);
        });

        //how can we test events ?
        it("emits events on enter", async function () {
          await expect(roullete.enterRed({ value: entranceFee })).to.emit(
            roullete,
            "RoulleteEnter"
          );
        });
        it("no entrance allowed when roullete is calculating", async function () {
          await roullete.enterRed({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []); //just want to mine one extra block
          //time has passed --> so we can call perform upkeep since checkup keep will return true

          await roullete.performUpkeep([]);
          //now it is in a caluilating state
          await expect(
            roullete.enterRed({ value: entranceFee })
          ).to.be.revertedWith("Roullete_closed");
        });
      });

      describe("check up keep", function () {
        it("returns false if no one is in the game", async function () {
          //we want everything in check up keep to be true except for has players
          await network.provider.request({
            method: "evm_increaseTime",
            params: [interval.toNumber() + 1],
          });
          await network.provider.send("evm_mine", []); //just want to mine one extra block
          //calling check up keep would send a tx , we do not want that, we can use callstatic
          const { upkeepNeeded } = await roullete.callStatic.checkUpkeep([]);
          assert(!upkeepNeeded);
        });

        it("returns false if roullete is not open", async function () {
          //first have time pass
          await roullete.enterBlack({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          await roullete.performUpkeep("0x");

          const { upkeepNeeded } = await roullete.callStatic.checkUpkeep([]);
          assert.equal(upkeepNeeded, false);
        });

        it("returns false if not enough time has passed", async function () {
          await roullete.enterGreen({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() - 10,
          ]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await roullete.callStatic.checkUpkeep([]);
          assert(!upkeepNeeded);
        });

        it("returns true if everything else is true", async function () {
          await roullete.enterRed({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await roullete.callStatic.checkUpkeep([]);
          assert(upkeepNeeded);
        });
      });

      describe("perform up keep", function () {
        it("it can only run if checkupkeep is true", async function () {
          await roullete.enterRed({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          //since everything is satified
          const tx = await roullete.performUpkeep([]);
          //if tx does not work , tx will fail
          assert(tx);
        });

        it("revert is up keep is not needed", async function () {
          await roullete.enterGreen({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() - 1,
          ]);
          await network.provider.send("evm_mine", []);
          expect(roullete.performUpkeep([])).to.be.reverted;
        });

        it("updates raffle state, emits an event and calls the VRF coodinator with request", async function () {
          await roullete.enterRed({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          //since everything is satified
          const tx = await roullete.performUpkeep([]);
          const reciept = await tx.wait(1);
          const requestid = reciept.events[1].args.requestId; //since requestrandomwords also emits an event
          const roulletestate = await roullete.getroulletestate();
          assert(requestid.toNumber() > 0);
          assert(tx);
          assert.equal(roulletestate, 1);
          await expect(tx).to.emit(roullete, "requestedRoulleteResult");
        });
      });

      describe("fullfilll random words", function () {
        //we need a before each here becuase we want someone in the pot,
        //so we can call perform upkeep without reversion

        beforeEach(async function () {
          await roullete.enterRed({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
        });

        it("can only be called after performupkeep", async function () {
          //we call it on the mock becauswe the mock will pass the contract address in as the consumer
          expect(VRFCoordinatorV2Mock.fulfillRandomWords(0, roullete.address))
            .to.be.reverted;
        });

        it("picks a winner, resets everything , and send money", async function () {
          //we need more entrants
          const additionalEntrants = 3;
          const startingAccountIndex = 1; //deployer = 0;
          const accounts = await ethers.getSigners();

          for (
            let i = startingAccountIndex;
            i < startingAccountIndex + additionalEntrants;
            i++
          ) {
            //connect raffle contracts to these accounts
            const accountConnectedRaffle = roullete.connect(accounts[i]);
            if (i == 0) {
              accountConnectedRaffle.enterGreen({ value: entranceFee });
            } else if (i % 2 == 0) {
              accountConnectedRaffle.enterBlack({ value: entranceFee });
            } else {
              accountConnectedRaffle.enterRed({ value: entranceFee });
            }
          }

          //now we have four ppl connected

          const startingtimeStamp = await roullete.getLatestTimeStamp();
          //we want to perform upkeep --> MOCK chainlink
          //requesting random words will kick of calling fulffil random words(mock the VRF)
          //we have to wait for fulfillrandom words to be called --> we need to simulate waiting for it since local host isnt the same
          //as the VRF
          //using promises

          //we set up the event listeners first
          await new Promise(async (resolve, reject) => {
            //once winner picked, we want to do something
            roullete.once("winnerpicked", async () => {
              //listening for an event --> which is waiting for the winner to be picked
              console.log("winners have be selected");
              try {
                const winnerEndingBalance = await accounts[2].getBalance();
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
                console.log(accounts[1].address);
                console.log(accounts[2].address);
                console.log(accounts[3].address);

                assert.equal(roulleteState, 0);
                console.log("comparing time stamps");
                let sumOfAllPlayers =
                  redplayersLen + blackplayerslen + greenplayersLen;
                assert(endingTimeStamp > startingtimeStamp);
                console.log(`there are ${greenplayersLen} total players`);
                assert.equal(sumOfAllPlayers, 0);
                console.log("passed so far");
                console.log(`winner start balance : ${winnerStartingBalance}`);
                console.log(`winner end balance   : ${winnerEndingBalance}`);
                const one = winnerEndingBalance.toString();
                console.log(`entrance fee ${entranceFee}`);
                const two = winnerStartingBalance
                  .add(
                    entranceFee.mul(2) //multipler
                  )
                  .toString();
                console.log(one);
                console.log(two);
                assert.equal(one.toString(), two.toString());
                resolve();
              } catch (error) {
                //will reject if exceeds time limit
                reject(e);
              }
            });
            //NOTE --> OUTSIDE of promise, will call before promise returns
            //then we add the code inside the promise but outside the once
            //so that the code we run here may trigger fullfill random words
            //then emit the event winner picked.
            const tx = await roullete.performUpkeep("0x");
            const txReceipt = await tx.wait(1);
            const winnerStartingBalance = await accounts[2].getBalance();
            await VRFCoordinatorV2Mock.fulfillRandomWords(
              txReceipt.events[1].args.requestId,
              roullete.address
            );

            //we do not have these section on the bottom for testnet staging test becuase
            //we do not know fulfillrandom words is gonna be called, so its best to set up a listener
            //here we are pretending to be the chainlink keeper --> which is why we need a mock
          });
        });
      });
    });
