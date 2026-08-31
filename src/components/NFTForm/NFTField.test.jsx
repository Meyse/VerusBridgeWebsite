import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import { useWeb3React } from '@web3-react/core';

import { FLAGS } from 'constants/contractAddress';
import useContract from 'hooks/useContract';

import NFTField from './NFTField';

vi.mock('@web3-react/core', () => ({ useWeb3React: vi.fn() }));
vi.mock('hooks/useContract', () => ({ default: vi.fn() }));
vi.mock('components/AutocompleteControlField', () => ({
  default: ({ options }) => <div data-testid="nft-options">{options.map((option) => option.label).join('|')}</div>
}));

describe('NFTField catalog loading', () => {
  test('loads the NFT catalog without returning an async effect cleanup', async () => {
    useWeb3React.mockReturnValue({
      account: '0x1234567890abcdef1234567890abcdef12345678'
    });
    useContract.mockReturnValue({
      callStatic: {
        getTokenList: vi.fn().mockResolvedValue([{
          erc20ContractAddress: '0x0000000000000000000000000000000000000011',
          flags: FLAGS.MAPPING_ERC721_NFT_DEFINITION,
          iaddress: '0x0000000000000000000000000000000000000022',
          name: 'Example NFT',
          tokenID: 1
        }])
      }
    });

    const { unmount } = render(<NFTField control={{}} />);

    await waitFor(() => {
      expect(screen.getByTestId('nft-options')).toHaveTextContent(/Verus created ERC721/);
    });
    expect(() => unmount()).not.toThrow();
  });
});
