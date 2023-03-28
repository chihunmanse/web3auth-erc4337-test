/** @format */

import { useEffect, useState } from "react";
import {
  WALLET_ADAPTERS,
  CHAIN_NAMESPACES,
  SafeEventEmitterProvider,
} from "@web3auth/base";
import { Web3AuthCore } from "@web3auth/core";
import { OpenloginAdapter } from "@web3auth/openlogin-adapter";
import "./App.css";
import RPC from "./evm.ethers";
import ERC4337 from "./erc4337";

const clientId =
  "BOR8MBjSVBx_5vLtd_YNqxCfB4IAwXMJUJ6Popp_2SFAb95d74HSBt5KBPdn3aj_kwR58zL-AHOLSZByWBYSkv0";

function App() {
  const [web3auth, setWeb3auth] = useState<Web3AuthCore | null>(null);
  const [provider, setProvider] = useState<SafeEventEmitterProvider | null>(
    null
  );
  const [result, setResult] = useState(<></>);

  useEffect(() => {
    const init = async () => {
      try {
        const web3auth = new Web3AuthCore({
          clientId,
          web3AuthNetwork: "testnet",
          chainConfig: {
            chainNamespace: CHAIN_NAMESPACES.EIP155,
            chainId: "0x13881",
            rpcTarget: "https://rpc.ankr.com/polygon_mumbai",
            ticker: "MATIC",
            tickerName: "Matic",
          },
        });

        const openloginAdapter = new OpenloginAdapter({
          adapterSettings: {
            clientId,
            uxMode: "popup",
            loginConfig: {
              google: {
                name: "Custom Google Auth Login",
                verifier: "google-hi",
                typeOfLogin: "google",
                clientId:
                  "62912393486-60c4pan6mnkb44rc457sk9smh79fd131.apps.googleusercontent.com", //use your app client id you got from google
              },
            },
          },
        });

        web3auth.configureAdapter(openloginAdapter);
        setWeb3auth(web3auth);

        await web3auth.init();
        if (web3auth.provider) {
          setProvider(web3auth.provider);
        }
      } catch (error) {
        console.error(error);
      }
    };

    init();
  }, []);

  const login = async () => {
    if (!web3auth) {
      setResult(
        <div className="body-container">web3auth not initialized yet</div>
      );
      return;
    }
    const web3authProvider = await web3auth.connectTo(
      WALLET_ADAPTERS.OPENLOGIN,
      {
        loginProvider: "google",
      }
    );
    setProvider(web3authProvider);
  };

  const logout = async () => {
    if (!web3auth) {
      setResult(
        <div className="body-container">web3auth not initialized yet</div>
      );
      return;
    }
    await web3auth.logout();
    setProvider(null);
  };

  const getAccounts = async () => {
    if (!provider) {
      setResult(
        <div className="body-container">provider not initialized yet</div>
      );
      return;
    }
    const rpc = new RPC(provider);
    const userAccount = await rpc.getAccounts();

    setResult(<div className="body-container">{userAccount}</div>);
  };

  const mumbaiFaucet = async () => {
    setResult(
      <div className="body-container">
        Contract Account에 Matic을 충전하세요.
      </div>
    );
  };

  const getContractAccount = async () => {
    if (!provider) {
      setResult(
        <div className="body-container">provider not initialized yet</div>
      );
      return;
    }

    const erc4337 = new ERC4337(provider);
    const result = await erc4337.getContractAccount();
    setResult(<div className="body-container">{result}</div>);
  };

  const getAccountBalance = async () => {
    if (!provider) {
      setResult(
        <div className="body-container">provider not initialized yet</div>
      );
      return;
    }

    const erc4337 = new ERC4337(provider);
    const result = await erc4337.getAccountBalance();
    setResult(<div className="body-container">{result + " Matic"}</div>);
  };

  const getBundlerAddress = async () => {
    if (!provider) {
      setResult(
        <div className="body-container">provider not initialized yet</div>
      );
      return;
    }

    const erc4337 = new ERC4337(provider);
    const result = await erc4337.getBundlerAddress();
    setResult(<div className="body-container">{result}</div>);
  };

  const transfer = async () => {
    if (!provider) {
      setResult(
        <div className="body-container">provider not initialized yet</div>
      );
    }

    setResult(
      <div className="body-container">
        <div className="input-container">
          <div className="input-title">To</div>
          <div className="input-text">
            0xA552b00A6f79e7e40eFf56DC6B8C79bE1a333E60
          </div>
        </div>
        <div className="input-container">
          <div className="input-title">Matic</div>
          <div className="input-text">0.1</div>
        </div>
        <div className="input-button-container">
          <button onClick={transferWithPaymaster} className="card">
            Transfer
          </button>
        </div>
      </div>
    );
  };

  const transferWithPaymaster = async () => {
    if (!provider) {
      setResult(<div>provider not initialized yet</div>);
      return;
    }

    const erc4337 = new ERC4337(provider);
    const result = await erc4337.transferWithPaymaster();
    setResult(
      <div className="body-container">
        <div className="input-container">
          <div className="input-title">Tx Hash</div>
          <div className="input-text">{result.txHash}</div>
        </div>
        <div className="input-container">
          <div className="input-title">UserOp Hash</div>
          <div className="input-text">{result.userOpHash}</div>
        </div>
        <div className="input-container">
          <div className="input-title">Sender</div>
          <div className="input-text">{result.sender}</div>
        </div>
        <div className="input-container">
          <div className="input-title">Paymaster</div>
          <div className="input-text">{result.paymaster}</div>
        </div>
        <div className="input-container">
          <div className="input-title">Nonce</div>
          <div className="input-text">{result.nonce}</div>
        </div>
        <div className="input-container">
          <div className="input-title">Success</div>
          <div className="input-text">{result.success.toString()}</div>
        </div>
        <div className="input-container">
          <div className="input-title">Actual Gas Cost</div>
          <div className="input-text">{result.actualGasCost}</div>
        </div>
        <div className="input-container">
          <div className="input-title">Actual Gas Used</div>
          <div className="input-text">{result.actualGasUsed}</div>
        </div>
      </div>
    );
  };

  const loginView = (
    <>
      <div className="flex-container">
        <div>
          <button onClick={getAccounts} className="card">
            Get Owner
          </button>
        </div>
        <div>
          <button onClick={getContractAccount} className="card">
            Get Contract Account
          </button>
        </div>
        <div>
          <button className="card" onClick={mumbaiFaucet}>
            <a
              href="https://mumbaifaucet.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Mumbai Faucet
            </a>
          </button>
        </div>
        <div>
          <button onClick={getAccountBalance} className="card">
            Get Account Balance
          </button>
        </div>
        <div>
          <button onClick={getBundlerAddress} className="card">
            Get Bundler Address
          </button>
        </div>
        <div>
          <button onClick={transfer} className="card">
            Transfer With Paymaster
          </button>
        </div>
        <div>
          <button onClick={logout} className="card">
            Log Out
          </button>
        </div>
      </div>

      {result}
    </>
  );

  const logoutView = (
    <button onClick={login} className="card">
      Login
    </button>
  );

  return (
    <div className="container">
      <h1 className="title">Web3Auth & ERC4337 Example</h1>

      <div className="grid">{provider ? loginView : logoutView}</div>

      <footer className="footer">
        <a
          href="https://github.com/chihunmanse/web3auth-erc4337-test"
          target="_blank"
          rel="noopener noreferrer"
        >
          Source code
        </a>
      </footer>
    </div>
  );
}

export default App;
