import React from 'react';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useWeb3React } from '@web3-react/core';
import { BigNumber, Wallet, utils } from 'ethers';
import { useForm } from 'react-hook-form';

import DELEGATOR_ABI from 'abis/DelegatorAbi.json';
import ERC1155_ABI from 'abis/ERC1155.json';
import {
  DELEGATOR_ADD,
  EXPECTED_ETHEREUM_CHAIN_ID,
  FLAGS
} from 'constants/contractAddress';
import useContract from 'hooks/useContract';
import { createScriptedChain } from 'testUtils/scriptedChain';
import { connectTestWallet, createSigningMetaMask, installSendRuntime } from 'testUtils/sendFixtures';
import { getContract } from 'utils/contract';
import { convertVerusAddressToEthAddress } from 'utils/convert';
import { toBase58Check } from 'utils/verusAddress';
import { resetWalletSessionForTests } from 'wallets/walletSession';

import NFTForm from './NFTForm';

const { mockVerusd } = vi.hoisted(() => ({
  mockVerusd: { getIdentity: vi.fn() }
}));

vi.mock('@web3-react/core', () => ({ useWeb3React: vi.fn() }));
vi.mock('hooks/useContract', () => ({ default: vi.fn() }));
vi.mock('react-hook-form', () => ({ useForm: vi.fn() }));
vi.mock('utils/contract', () => ({ getContract: vi.fn() }));
vi.mock('utils/verusdRpc', () => ({
  VerusdRpcInterface: vi.fn(function MockVerusdRpcInterface() {
    return mockVerusd;
  })
}));
vi.mock('./NFTAddressField', () => ({ default: () => null }));
vi.mock('./NFTAmountField', () => ({ default: () => null }));
vi.mock('./NFTField', () => ({ default: () => null }));

const SIGNER = new Wallet(`0x${'0'.repeat(63)}1`);
const ERC1155_INTERFACE = new utils.Interface(ERC1155_ABI);
const DELEGATOR_INTERFACE = new utils.Interface(DELEGATOR_ABI);

describe('NFT bridge transaction boundaries', () => {
  let sendRuntime;

  afterEach(() => {
    sendRuntime.cleanup();
  });

  test('resolves a VerusID before granting ERC-1155 approval, checks the approval, and sends the transfer', async () => {
    window.localStorage.clear();
    resetWalletSessionForTests();
    const chain = createScriptedChain({ chainId: EXPECTED_ETHEREUM_CHAIN_ID });
    sendRuntime = installSendRuntime({ chain });
    // A4: the site RPC reports the approval after it confirms.
    chain.setCallAnswer(ERC1155_INTERFACE.getSighash('isApprovedForAll'), utils.defaultAbiCoder.encode(['bool'], [true]));
    const wallet = createSigningMetaMask({ chain, mineStatus: () => 1, signer: SIGNER });
    connectTestWallet({ provider: wallet, signer: SIGNER });
    const walletRequest = vi.spyOn(wallet, 'request');

    const identityAddress = toBase58Check(Buffer.alloc(20, 4), 102);
    const selectedNft = {
      erc20address: '0x0000000000000000000000000000000000000011',
      flags: FLAGS.MAPPING_ERC1155_ERC_DEFINITION,
      iaddress: '0x0000000000000000000000000000000000000022',
      name: 'Example NFT',
      value: BigNumber.from(1)
    };
    const values = {
      address: 'Max@',
      amount: 1,
      nft: selectedNft
    };
    const nftContract = {
      callStatic: {
        balanceOf: vi.fn().mockResolvedValue(2),
        isApprovedForAll: vi.fn().mockResolvedValue(false)
      }
    };
    const delegatorContract = {
      callStatic: {
        bestForks: vi.fn().mockResolvedValue('0'.repeat(200)),
        bridgeConverterActive: vi.fn().mockResolvedValue(true)
      }
    };
    const library = {
      getCode: vi.fn().mockResolvedValue('0x60006000'),
      getNetwork: vi.fn().mockResolvedValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID })
    };

    useWeb3React.mockReturnValue({
      account: SIGNER.address,
      chainId: EXPECTED_ETHEREUM_CHAIN_ID,
      library
    });
    useContract.mockReturnValue(delegatorContract);
    getContract.mockReturnValue(nftContract);
    mockVerusd.getIdentity.mockResolvedValue({
      result: {
        fullyqualifiedname: 'Max.VRSC@',
        identity: { identityaddress: identityAddress },
        status: 'active'
      }
    });
    useForm.mockReturnValue({
      control: {},
      handleSubmit: (handler) => (event) => {
        event.preventDefault();
        return handler(values);
      },
      watch: (name) => values[name]
    });

    // Fake only the VerusID lookup debounce so enabling Send does not race wall-clock time.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    render(<NFTForm />);
    const sendButton = screen.getByRole('button', { name: 'Send' });
    expect(sendButton).toBeDisabled();

    await act(() => vi.runOnlyPendingTimersAsync());
    vi.useRealTimers();
    expect(sendButton).toBeEnabled();
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/Your NFT transfer is confirmed/)).toBeInTheDocument();
    });

    const [approval, transfer] = wallet.sentRequests;
    expect(wallet.sentRequests).toHaveLength(2);
    expect(utils.getAddress(approval.to)).toBe(utils.getAddress(selectedNft.erc20address));
    expect(ERC1155_INTERFACE.decodeFunctionData('setApprovalForAll', approval.data).map(String))
      .toEqual([utils.getAddress(DELEGATOR_ADD), 'true']);
    const [reserveTransfer] = DELEGATOR_INTERFACE.decodeFunctionData('sendTransfer', transfer.data);
    expect(reserveTransfer.destination.destinationaddress.toLowerCase())
      .toBe(convertVerusAddressToEthAddress(identityAddress).toLowerCase());
    expect(reserveTransfer.destination.destinationtype).toBe(4);
    expect(mockVerusd.getIdentity).toHaveBeenCalledWith('Max@');
    const firstSend = walletRequest.mock.calls.findIndex(([{ method }]) => method === 'eth_sendTransaction');
    expect(mockVerusd.getIdentity.mock.invocationCallOrder.at(-1))
      .toBeLessThan(walletRequest.mock.invocationCallOrder[firstSend]);
  });

  test('stops before the transfer when the site RPC does not report the approval (A4)', async () => {
    window.localStorage.clear();
    resetWalletSessionForTests();
    const chain = createScriptedChain({ chainId: EXPECTED_ETHEREUM_CHAIN_ID });
    sendRuntime = installSendRuntime({ chain });
    chain.setCallAnswer(ERC1155_INTERFACE.getSighash('isApprovedForAll'), utils.defaultAbiCoder.encode(['bool'], [false]));
    const wallet = createSigningMetaMask({ chain, mineStatus: () => 1, signer: SIGNER });
    connectTestWallet({ provider: wallet, signer: SIGNER });
    const values = {
      address: 'Max@',
      amount: 1,
      nft: {
        erc20address: '0x0000000000000000000000000000000000000011',
        flags: FLAGS.MAPPING_ERC1155_ERC_DEFINITION,
        iaddress: '0x0000000000000000000000000000000000000022',
        name: 'Example NFT',
        value: BigNumber.from(1)
      }
    };

    useWeb3React.mockReturnValue({
      account: SIGNER.address,
      chainId: EXPECTED_ETHEREUM_CHAIN_ID,
      library: {
        getCode: vi.fn().mockResolvedValue('0x60006000'),
        getNetwork: vi.fn().mockResolvedValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID })
      }
    });
    useContract.mockReturnValue({
      callStatic: {
        bestForks: vi.fn().mockResolvedValue('0'.repeat(200)),
        bridgeConverterActive: vi.fn().mockResolvedValue(true)
      }
    });
    getContract.mockReturnValue({
      callStatic: {
        balanceOf: vi.fn().mockResolvedValue(2),
        isApprovedForAll: vi.fn().mockResolvedValue(false)
      }
    });
    mockVerusd.getIdentity.mockResolvedValue({
      result: {
        fullyqualifiedname: 'Max.VRSC@',
        identity: { identityaddress: toBase58Check(Buffer.alloc(20, 4), 102) },
        status: 'active'
      }
    });
    useForm.mockReturnValue({
      control: {},
      handleSubmit: (handler) => (event) => {
        event.preventDefault();
        return handler(values);
      },
      watch: (name) => values[name]
    });

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    render(<NFTForm />);
    await act(() => vi.runOnlyPendingTimersAsync());
    vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByText(/The bridge is not approved for this NFT/)).toBeInTheDocument();
    });
    expect(wallet.sentRequests).toHaveLength(1);
  });
});
