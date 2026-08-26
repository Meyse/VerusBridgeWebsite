import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useWeb3React } from '@web3-react/core';
import { BigNumber } from 'ethers';
import { useForm } from 'react-hook-form';

import { useToast } from 'components/Toast/ToastProvider';
import {
  DELEGATOR_ADD,
  EXPECTED_ETHEREUM_CHAIN_ID,
  FLAGS
} from 'constants/contractAddress';
import useContract from 'hooks/useContract';
import { getContract } from 'utils/contract';

import NFTForm from './NFTForm';

vi.mock('@web3-react/core', () => ({ useWeb3React: vi.fn() }));
vi.mock('components/Toast/ToastProvider', () => ({ useToast: vi.fn() }));
vi.mock('hooks/useContract', () => ({ default: vi.fn() }));
vi.mock('react-hook-form', () => ({ useForm: vi.fn() }));
vi.mock('utils/contract', () => ({ getContract: vi.fn() }));
vi.mock('./NFTAddressField', () => ({ default: () => null }));
vi.mock('./NFTAmountField', () => ({ default: () => null }));
vi.mock('./NFTField', () => ({ default: () => null }));

describe('NFT bridge transaction boundaries', () => {
  test('grants ERC-1155 approval only to the configured delegator', async () => {
    const selectedNft = {
      erc20address: '0x0000000000000000000000000000000000000011',
      flags: FLAGS.MAPPING_ERC1155_ERC_DEFINITION,
      iaddress: '0x0000000000000000000000000000000000000022',
      name: 'Example NFT',
      value: BigNumber.from(1)
    };
    const values = {
      address: 'R9NVxTj2ewfiTUzAfn7FSsq9kxNt6fjaaZ',
      amount: 1,
      nft: selectedNft
    };
    const approvalWait = vi.fn().mockResolvedValue({ status: 1 });
    const setApprovalForAll = vi.fn().mockResolvedValue({ wait: approvalWait });
    const nftContract = {
      callStatic: {
        balanceOf: vi.fn().mockResolvedValue(2),
        isApprovedForAll: vi.fn().mockResolvedValue(false)
      },
      setApprovalForAll
    };
    const transferWait = vi.fn().mockResolvedValue({ status: 1 });
    const delegatorContract = {
      callStatic: {
        bestForks: vi.fn().mockResolvedValue('0'.repeat(200)),
        bridgeConverterActive: vi.fn().mockResolvedValue(true)
      },
      sendTransfer: vi.fn().mockResolvedValue({ wait: transferWait })
    };
    const library = {
      getCode: vi.fn().mockResolvedValue('0x60006000'),
      getNetwork: vi.fn().mockResolvedValue({ chainId: EXPECTED_ETHEREUM_CHAIN_ID })
    };

    useWeb3React.mockReturnValue({
      account: '0x1234567890abcdef1234567890abcdef12345678',
      chainId: EXPECTED_ETHEREUM_CHAIN_ID,
      library
    });
    useToast.mockReturnValue({ addToast: vi.fn() });
    useContract.mockReturnValue(delegatorContract);
    getContract.mockReturnValue(nftContract);
    useForm.mockReturnValue({
      control: {},
      handleSubmit: (handler) => (event) => {
        event.preventDefault();
        return handler(values);
      },
      watch: (name) => values[name]
    });

    render(<NFTForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(setApprovalForAll).toHaveBeenCalledTimes(1);
    });

    expect(setApprovalForAll).toHaveBeenCalledWith(
      DELEGATOR_ADD,
      true,
      expect.objectContaining({ from: '0x1234567890abcdef1234567890abcdef12345678' })
    );
    expect(delegatorContract.sendTransfer).toHaveBeenCalledTimes(1);
    expect(delegatorContract.callStatic.contracts).toBeUndefined();
  });
});
