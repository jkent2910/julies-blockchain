import React, { Component } from 'react';
import { Link } from 'react-router-dom';

class App extends Component {
    state = { walletInfo: {} };

    componentDidMount() {
        fetch(`${document.location.origin}/api/wallet-info`)
            .then(response => response.json())
            .then(json => this.setState({
                walletInfo: json
            }))
    }

    render() {
        const { address, balance } = this.state.walletInfo;
        return (
            <div>
                <div>
                    <h1>Welcome to the blockchain!</h1>
                </div>
                <br />
                <div>
                    <Link to='/blocks'>Blocks</Link>
                </div>
                    <Link to='/conduct-transaction'>Conduct a Transaction</Link>
                <div>
                </div>
                <Link to='/transaction-pool'>Transaction Pool</Link>
                <div>
                </div>
                <br />
                <div className='WalltInfo'>
                    <div>Address: {address} </div>
                    <div>Balance: {balance}</div>
                </div>
            </div>
        )
    }
}

export default App;