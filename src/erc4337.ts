/** @format */

import type { SafeEventEmitterProvider } from "@web3auth/base";
import { SimpleAccountAPI, PaymasterAPI } from "@account-abstraction/sdk";
import { BigNumberish, Contract, ethers, Signer } from "ethers";
import EntryPoint from "./contracts/EntryPoint.json";
import Paymaster from "./contracts/Paymaster.json";
import { hexConcat } from "./utils";

export const SimpleAccountFactoryAddress =
  "0x71D63edCdA95C61D6235552b5Bc74E32d8e2527B";
export const BUNDLER_PRIVATE_KEY = process.env.REACT_APP_BUNDLER_PRIVATE_KEY;
export const SIG_SIZE = 65;
export const DUMMY_PAYMASTER_AND_DATA =
  "0x0101010101010101010101010101010101010101000000000000000000000000000000000000000000000000000001010101010100000000000000000000000000000000000000000000000000000000000000000101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101";

interface Gas {
  maxFeePerGas: BigNumberish;
  maxPriorityFeePerGas: BigNumberish;
}

export type UserOperationEvent = {
  txHash: string;
  userOpHash: string;
  sender: string;
  paymaster: string;
  nonce: number;
  success: boolean;
  actualGasCost: string;
  actualGasUsed: string;
};

export default class ERC4337 {
  private provider: SafeEventEmitterProvider;
  private accountAPI: SimpleAccountAPI;
  private bundler: Signer;
  private entryPoint: Contract;
  private paymaster: Contract;

  constructor(provider: SafeEventEmitterProvider) {
    this.provider = provider;
    this.accountAPI = this.getSimpleAccount(
      EntryPoint.address,
      SimpleAccountFactoryAddress
    );
    this.bundler = new ethers.Wallet(
      BUNDLER_PRIVATE_KEY as string,
      new ethers.providers.Web3Provider(this.provider)
    );

    const entryPointIface = new ethers.utils.Interface(EntryPoint.abi);
    this.entryPoint = new ethers.Contract(
      EntryPoint.address,
      entryPointIface,
      this.bundler
    );

    const paymasterIface = new ethers.utils.Interface(Paymaster.abi);
    this.paymaster = new ethers.Contract(
      Paymaster.address,
      paymasterIface,
      this.bundler
    );
  }

  private static getUserOpEvent(events: any): UserOperationEvent {
    const event = events.find((e: any) => e.event === "UserOperationEvent");
    return {
      txHash: "",
      userOpHash: event.args.userOpHash,
      sender: event.args.sender,
      paymaster: event.args.paymaster,
      nonce: event.args.nonce.toNumber(),
      success: event.args.success,
      actualGasCost: event.args.actualGasCost.toString(),
      actualGasUsed: event.args.actualGasUsed.toString(),
    };
  }

  private async getCurrentBlockTimestamp() {
    const provider = new ethers.providers.Web3Provider(this.provider);
    const blockNumber = await provider.getBlockNumber();
    return (await provider.getBlock(blockNumber)).timestamp;
  }

  private async getGasFee(): Promise<Gas> {
    const provider = new ethers.providers.Web3Provider(this.provider);

    const [fee, block] = await Promise.all([
      provider.send("eth_maxPriorityFeePerGas", []),
      provider.getBlock("latest"),
    ]);
    const tip = ethers.BigNumber.from(fee);
    const buffer = tip.div(100).mul(13);
    const maxPriorityFeePerGas = tip.add(buffer);
    const maxFeePerGas = block.baseFeePerGas
      ? block.baseFeePerGas.mul(2).add(maxPriorityFeePerGas)
      : maxPriorityFeePerGas;

    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  private getSimpleAccount(
    entryPointAddress: string,
    factoryAddress: string,
    paymasterAPI?: PaymasterAPI
  ) {
    const provider = new ethers.providers.Web3Provider(this.provider);
    const owner = provider.getSigner();
    const sw = new SimpleAccountAPI({
      provider,
      entryPointAddress,
      owner,
      factoryAddress,
      paymasterAPI,
    });

    // Hack: default getUserOpReceipt does not include fromBlock which causes an error for some RPC providers.
    sw.getUserOpReceipt = async (
      userOpHash: string,
      timeout = 30000,
      interval = 5000
    ): Promise<string | null> => {
      const endtime = Date.now() + timeout;
      const block = await sw.provider.getBlock("latest");
      while (Date.now() < endtime) {
        // @ts-ignore
        const events = await sw.entryPointView.queryFilter(
          // @ts-ignore
          sw.entryPointView.filters.UserOperationEvent(userOpHash),
          Math.max(0, block.number - 100)
        );
        if (events.length > 0) {
          return events[0].transactionHash;
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      return null;
    };

    return sw;
  }

  async getContractAccount(): Promise<string> {
    return await this.accountAPI.getCounterFactualAddress();
  }

  async getAccountBalance(): Promise<string> {
    const provider = new ethers.providers.Web3Provider(this.provider);
    const balance = await provider.getBalance(await this.getContractAccount());
    return ethers.utils.formatEther(balance);
  }

  async getBundlerAddress(): Promise<string> {
    return this.bundler.getAddress();
  }

  async transferWithPaymaster(): Promise<UserOperationEvent> {
    const value = ethers.utils.parseEther("0.1");
    const op = await this.accountAPI.createUnsignedUserOp({
      target: await this.bundler.getAddress(),
      value,
      data: "0x",
      ...(await this.getGasFee()),
    });
    op.paymasterAndData = DUMMY_PAYMASTER_AND_DATA;
    op.signature = ethers.utils.hexlify(Buffer.alloc(SIG_SIZE, 1));
    op.preVerificationGas = this.accountAPI.getPreVerificationGas(op);

    // pm data setting
    const untilTimestamp = (await this.getCurrentBlockTimestamp()) + 100;
    const afterTimestamp = 0;
    const pmDataHash = await this.paymaster.getHash(
      op,
      untilTimestamp,
      afterTimestamp
    );
    const pmBinary = ethers.utils.arrayify(pmDataHash);
    const pmSignature = await this.bundler.signMessage(pmBinary);
    const timestamp = ethers.utils.defaultAbiCoder.encode(
      ["uint48", "uint48"],
      [untilTimestamp, afterTimestamp]
    );
    const pmData = hexConcat([this.paymaster.address, timestamp, pmSignature]);
    op.paymasterAndData = pmData;

    // op signature
    const opHash = await this.entryPoint.getUserOpHash(op);
    const opBinary = ethers.utils.arrayify(opHash);
    op.signature = await this.accountAPI.owner.signMessage(opBinary);

    // transaction
    const handleOpsTx = await this.entryPoint.handleOps(
      [op],
      await this.bundler.getAddress()
    );
    const receipt = await handleOpsTx.wait();
    const event = ERC4337.getUserOpEvent(receipt.events);
    event.txHash = receipt.transactionHash;
    return event;
  }
}
