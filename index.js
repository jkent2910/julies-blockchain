const express = require('express');
const request = require('request');
const path = require('path');
const bodyParser = require('body-parser');
const Blockchain = require('./blockchain/index');
const PubSub = require('./app/pubsub');
const Wallet = require('./wallet');
const TransactionPool = require('./wallet/transaction-pool');
const TransactionMiner = require('./app/transaction-miner');

const isDevelopment = process.env.ENV === 'development';

const DEFAULT_PORT = 3000;
const ROOT_NODE_ADDRESS = `http://localhost:${DEFAULT_PORT}`;
const REDIS_URL = isDevelopment ? 'redis://127.0.0.1:6379' : 'redis://h:pa112695fc653e9f40518b2859df33233a3fdcc1c730e233823f1a427c6dc89e3@ec2-107-23-137-160.compute-1.amazonaws.com:27609'

const app = express();
const blockchain = new Blockchain();
const transactionPool = new TransactionPool();
const wallet = new Wallet();
const pubsub = new PubSub({ blockchain, transactionPool, redisUrl: REDIS_URL });
const transactionMiner = new TransactionMiner({ blockchain, transactionPool, wallet, pubsub });

setTimeout(() => pubsub.broadcastChain(), 1000);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'client/dist')));

app.get('/api/blocks', (req, res) => {
    res.json(blockchain.chain);
});

app.post('/api/mine', (req, res) => {
   const { data  } = req.body;

   blockchain.addBlock({ data });

   pubsub.broadcastChain();

   res.redirect('/api/blocks');
});

app.post('/api/transact', (req, res) => {
    const { amount, recipient } = req.body;

    let transaction = transactionPool
        .existingTransaction({ inputAddress: wallet.publicKey });

    try {
        if (transaction) {
            transaction.update({ senderWallet: wallet, recipient, amount });
        } else {
            transaction = wallet.createTransaction({
                recipient,
                amount,
                chain: blockchain.chain
            });
        }
    } catch(error) {
        return res.status(400).json({ type: 'error', message: error.message });
    }

    transactionPool.setTransaction(transaction);

    pubsub.broadcastTransaction(transaction);

    res.json({ type: 'success', transaction });
});

app.get('api/transaction-pool-map', (req, res) => {
   res.json(transactionPool.transactionMap);
});

app.get('/api/mine-transactions', (req, res) => {
    transactionMiner.mineTransactions();

    res.redirect('/api/blocks');
});

app.get('/api/wallet-info', (req, res) => {
    const address = wallet.publicKey;
    res.json({ address: address, balance: Wallet.calculateBalance({
                        chain: blockchain.chain,
                        address: address }) })
});

app.get('/api/known-addresses', (req, res) => {
   const addressMap = {};

   for (let block of blockchain.chain) {
       for (let transaction of block.data) {
           const recipient = Object.keys(transaction.outputMap);

           recipient.forEach(recipient => addressMap[recipient] = recipient);
       }
   }

   res.json(Object.keys(addressMap));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

const syncWithRootState = () => {
    request({ url: `${ROOT_NODE_ADDRESS}/api/blocks` }, (error, response, body) => {
        if (!error && response.statusCode === 200) {
            const rootChain = JSON.parse(body);

            console.log('replace chain on a sync with', rootChain);
            blockchain.replaceChain(rootChain);
        }
    });

    request({ url: `${ROOT_NODE_ADDRESS}/api/transaction-pool-map` }, (error, response, body) => {
        if (!error && response.statusCode === 200) {
            const rootTransactionPoolMap = JSON.parse(body);

            console.log('replace transaction pool map on a sync with', rootTransactionPoolMap);
            transactionPool.setMap(rootTransactionPoolMap);
        }
    });
};

if (true) {


    const walletFoo = new Wallet();
    const walletBar = new Wallet();

    const generateWalletTransaction = ({wallet, recipient, amount}) => {
        const transaction = wallet.createTransaction({
            recipient, amount, chain: blockchain.chain
        });

        transactionPool.setTransaction(transaction);
    };

    const walletAction = () => generateWalletTransaction({
        wallet, recipient: walletFoo.publicKey, amount: 5
    });

    const walletFooAction = () => generateWalletTransaction({
        wallet: walletFoo, recipient: walletBar.publicKey, amount: 10
    });

    const walletBarAction = () => generateWalletTransaction({
        wallet: walletBar, recipient: wallet.publicKey, amount: 15
    });

    for (let i = 0; i < 20; i++) {
        if (i % 3 === 0) {
            walletAction();
            walletFooAction();
        } else if (i % 3 === 1) {
            walletAction();
            walletBarAction();
        } else {
            walletFooAction();
            walletBarAction();
        }

        transactionMiner.mineTransactions();
    }
}


let PEER_PORT;

if (process.env.GENERATE_PEER_PORT === 'true') {
    PEER_PORT = DEFAULT_PORT + Math.ceil(Math.random() * 1000);
}

const PORT = process.env.PORT || PEER_PORT || DEFAULT_PORT;

app.listen(PORT, () => {
    console.log(`started listening on localhost:${PORT}`);

    if (PORT !== DEFAULT_PORT) {
        syncWithRootState();
    }
});
