# Roullete
## Set up for the project
1. load up the backend project using git 
2. load up the front end project using git (called roullete front end in my repo)
3. cd into back end and run `yarn install`
4. cd into back end and run `yarn install`, then run `yarn run dev` to load up the front end 
### how to set up networks and wallets
1. To make sure everything smoothly, run `yarn hardhat node` to spin up a bunch of local wallets, then run `yarn hardhat deploy` to deploy the contract to a local test net 
2. Go to the front end, the contractAddresses and ABI should be updated properly and front end should now show the roullete, **NOTE random result request will not work on local becuase there is no local chain link VRF** 
----
If everything works properly, follow the steps below to have a working auomated roullete on the blockchain 

### configure env file and wallets 
1. Create a metamask wallet, any youtube tutorial will do 
2. export the private key and put it to the corresponding field in the env. The format should look similar to this 
```
My_Private_key="key"
ETH_API_KEY="eth api key"
UPDATE_FRONT_END=true
GOERLI_RPC_URL=h
```
3. register for eth api key, and select a test network you want, for example, I used Goerli. Go to Alchemy and make a new project, it will give you an RPC URL

### deploy to a real test net

You are ready to deploy to a real test net! But before that you need to get some test funds for your wallet, 
go to the main Faucet: https://faucets.chain.link

## deploy!
run `yarn hardhat deploy --network "your network of choice"`

### register your contract as part of a keeper, and a VRF coordinator 
1. to register your contract in the VRF coordinator, go to https://vrf.chain.link/
2. to register a keeper for your contract, go to https://keepers.chain.link/





feel free to look at the deployed roullete smart contract

https://goerli.etherscan.io/address/0xF6078fc4684cdCB25f673DA9fD1F25B765aa800d




