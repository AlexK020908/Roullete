// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;
import "@chainlink/contracts/src/v0.8/KeeperCompatible.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
//we use chainlink oracle for randomness, automated exectution(chainlink keeper)
//before you can import
//yarn add --dev @chainlink/contracts
error RangeOutOfBounds();
error Roullete__NotEnoughEth();
error Roullete_transferFailed();
error Roullete_closed();
error Roullete_upKeepNotNeeded(
    uint256 currentBalance,
    uint256 Bplayers,
    uint256 Rplayers,
    uint256 Gplayers,
    uint256 roulleteState
);

//we need to make it
//this implements chianlink v2 and chainlink keepers
contract Roullete is VRFConsumerBaseV2, KeeperCompatibleInterface {
    enum RoulleteState {
        OPEN, //0
        CALCULATING //1
    }
    enum Bets {
        RED,
        BLACK,
        GREEN
    }
    uint256 private immutable i_entraceFee; //immutable --> we only set it once in the constructor
    address payable[] private s_RedPlayers; //payable since we want to pay them if they win
    address payable[] private s_GreenPlayers; //payable since we want to pay them if they win
    address payable[] private s_BlackPlayers; //payable since we want to pay them if they win
    VRFCoordinatorV2Interface private immutable i_COORDINATOR;
    //events
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint16 private constant requestConfirmations = 3;
    uint32 private immutable i_callbackgaslimit;
    uint32 private constant numWords = 1;
    uint256 private s_lastTimeStamp;
    uint256 internal constant MAX_CHANCE_VALUE = 100; // max chance is 100 percent
    uint256 private constant c_interval = 30;
    event requestedRoulleteResult(uint256 indexed requestId);
    event RoulleteEnter(address indexed player);
    event winnerpicked(address payable[] indexed winner);

    address payable[] private s_recentWinners;
    RoulleteState private s_roulleteState;

    //VRFCoordinatorV2 is where we generate the random number (the address where we are going to generate the number !)
    constructor(
        uint256 entranceFee,
        address VRFCoordinatorV2, //contract address --> probably need a mock for this ....
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit
    ) VRFConsumerBaseV2(VRFCoordinatorV2) {
        //since we only set it once, we can make it immutable
        i_entraceFee = entranceFee;
        i_COORDINATOR = VRFCoordinatorV2Interface(VRFCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackgaslimit = callbackGasLimit;
        s_roulleteState = RoulleteState.OPEN;
        s_lastTimeStamp = block.timestamp;
    }

    function enterRed() public payable {
        if (msg.value < i_entraceFee) {
            revert Roullete__NotEnoughEth();
        }

        if (s_roulleteState != RoulleteState.OPEN) {
            revert Roullete_closed();
        }
        s_RedPlayers.push(payable(msg.sender)); //make ssure each address is payabe
        emit RoulleteEnter(msg.sender);
    }

    function enterBlack() public payable {
        if (msg.value < i_entraceFee) {
            revert Roullete__NotEnoughEth();
        }

        if (s_roulleteState != RoulleteState.OPEN) {
            revert Roullete_closed();
        }
        s_BlackPlayers.push(payable(msg.sender)); //make ssure each address is payabe
        emit RoulleteEnter(msg.sender);
    }

    function enterGreen() public payable {
        if (msg.value < i_entraceFee) {
            revert Roullete__NotEnoughEth();
        }

        if (s_roulleteState != RoulleteState.OPEN) {
            revert Roullete_closed();
        }
        s_GreenPlayers.push(payable(msg.sender)); //make ssure each address is payabe
        emit RoulleteEnter(msg.sender);
    }

    /**
    *@dev alex kang 
    this is the function chainlink keeper calls, they look for the upkeepneeded 
    the following should be true in order to return true
        1. TIME INTERVAL SHOULD BE PASSED
        2. lottery should have at least 1 player and some eth 
        3.subscription funded with LINK
        4. LOTTERY should be in an "open" state --> when we are waiting for the number to get back
        we are in a closed state 
    
     */
    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (
            bool upkeepNeeded,
            bytes memory /* performData */ //we use perform data when we want to do intensive calculations off chain to reduce gas fees and pass into
        )
    //performUpkeep when needed

    {
        bool isOpen = s_roulleteState == RoulleteState.OPEN;
        // block.timeStamp gives the current time, in order to get the time passed
        //we could do something like block.timeStamp - prevTimeStamp(we neeod a variable for this )
        bool timepassed = ((block.timestamp - s_lastTimeStamp)) > c_interval;
        bool hasplayers = (s_BlackPlayers.length > 0 ||
            s_RedPlayers.length > 0 ||
            s_GreenPlayers.length > 0);
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = isOpen && timepassed && hasplayers && hasBalance;
    }

    //we want chainlink keeper to call this so we do not have call it ourselvrsd
    //before we had it as requestRandom, but in keepers we had to have a
    //performUpkeep, u might as well switch the name to perform upkeep
    //chainlink keepers will do intensive work off chain to see if they can call the perform up keep function, if it can, it calls this function on chain

    function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        //request random number
        //once we get it --> do smt with it
        // 2 trasaction process --> fair
        //before we call perform up keep we need to check if checkupkeep is true
        (bool upkeepNeeded, ) = checkUpkeep(""); //since we do not use calldata, and since we only want the bool, we just pull that one out
        if (!upkeepNeeded) {
            //the reason why we check again is the suggestion to always revalidate checkupkeep conditions when being called to prevent malicious attakcs
            revert Roullete_upKeepNotNeeded(
                address(this).balance,
                s_BlackPlayers.length,
                s_RedPlayers.length,
                s_GreenPlayers.length,
                uint256(s_roulleteState)
            );
        }

        s_roulleteState = RoulleteState.CALCULATING;
        uint256 requestid = i_COORDINATOR.requestRandomWords( //calling it on the coordinator
            i_gasLane, //gaslane
            i_subscriptionId,
            requestConfirmations,
            i_callbackgaslimit,
            numWords
        );

        emit requestedRoulleteResult(requestid); //save request id to logs
    }

    //in chainlink contracts src v0.8 --> fullfillRandomWords is virtual meaning we can ovvereide it
    function fulfillRandomWords(
        uint256, /*requestId*/
        uint256[] memory randomWords
    ) internal override {
        //since we only requesting one randomness, randomwords will come back as size 1
        //we can use modular operator
        //if s_players is of size 10
        //and we have random number == 202
        // we can 202 % 10   == 2 --> 2th winner
        uint256 chance = randomWords[0] % MAX_CHANCE_VALUE;
        Bets winningBet = getWinningBet(chance);
        if (winningBet == Bets.RED) {
            s_recentWinners = s_RedPlayers;
        } else if (winningBet == Bets.BLACK) {
            s_recentWinners = s_BlackPlayers;
        } else {
            s_recentWinners = s_GreenPlayers;
        }
        s_lastTimeStamp = block.timestamp;
        s_RedPlayers = new address payable[](0);
        s_BlackPlayers = new address payable[](0);
        s_GreenPlayers = new address payable[](0);

        //a for loop
        for (uint256 i = 0; i < s_recentWinners.length; i++) {
            //make it constatnt winning for now
            (bool success, ) = s_recentWinners[i].call{value: 0.1 ether}("");
            if (!success) {
                revert Roullete_transferFailed();
            }
        }
        emit winnerpicked(s_recentWinners);
        s_roulleteState = RoulleteState.OPEN;
    }

    function getWinningBet(uint256 chance) public pure returns (Bets) {
        uint256 sumsf = 0;
        uint256[3] memory chanceArray = getChanceArray();

        for (uint256 i = 0; i < chanceArray.length; i++) {
            if (chance >= sumsf && chance < sumsf + chanceArray[i]) {
                return Bets(i);
            } else {
                sumsf += chanceArray[i];
            }
        }

        revert RangeOutOfBounds();
    }

    function getChanceArray() public pure returns (uint256[3] memory) {
        return [49, 49, MAX_CHANCE_VALUE];
    }

    /*
        notes about chainlink VRF v2 

        getting a random number --> you need a subcription 


    */
    function getEntraceFee() public view returns (uint256) {
        return i_entraceFee;
    }

    function getBlackPlayer(uint256 index) public view returns (address) {
        return s_BlackPlayers[index];
    }

    function getRedPlayer(uint256 index) public view returns (address) {
        return s_RedPlayers[index];
    }

    function getGreenPlayer(uint256 index) public view returns (address) {
        return s_GreenPlayers[index];
    }

    function getRecentWinners(uint256 index) public view returns (address) {
        return s_recentWinners[index];
    }

    function amountOfWinners() public view returns (uint256) {
        return s_recentWinners.length;
    }

    function getroulletestate() public view returns (RoulleteState) {
        return s_roulleteState;
    }

    //the reason why it is pure is because numwords is a constant
    function getNumWords() public pure returns (uint256) {
        return numWords;
    }

    function getNumberOfPlayersOfBlack() public view returns (uint256) {
        return s_BlackPlayers.length;
    }

    function getNumberOfPlayersOfRed() public view returns (uint256) {
        return s_RedPlayers.length;
    }

    function getNumberOfPlayersOfGreen() public view returns (uint256) {
        return s_GreenPlayers.length;
    }

    function getLatestTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return requestConfirmations;
    }

    function getgasLane() public view returns (bytes32) {
        return i_gasLane;
    }

    function getInterval() public pure returns (uint256) {
        return c_interval;
    }
}
