import {
  buildTokenCurrency,
  getTokenDisplayName,
  getTokenDisplaySymbol
} from './bridgeUi';

describe('bridge source token display metadata', () => {
  test('shows Ethereum-facing labels for ETH while keeping legacy aliases searchable', () => {
    const token = {
      name: 'vETH',
      ticker: 'ETH',
      value: '0x454CB83913D688795E237837d30258d11ea7c752',
      erc20address: '0x0000000000000000000000000000000000000000'
    };

    const currency = buildTokenCurrency(token);

    expect(getTokenDisplayName(token)).toBe('Ethereum');
    expect(getTokenDisplaySymbol(token)).toBe('ETH');
    expect(currency.name).toBe('Ethereum');
    expect(currency.symbol).toBe('ETH');
    expect(currency.searchTerms).toContain('vETH');
  });

  test('prefers the Ethereum-side bridge symbol for the bridge reserve token', () => {
    const token = {
      name: 'Bridge.vETH',
      ticker: 'VBRID',
      ethereumName: 'Bridge.vETH',
      ethereumSymbol: 'VBRID',
      value: '0x0200EbbD26467B866120D84A0d37c82CdE0acAEB',
      erc20address: '0xE60553fB53347114F2AF5dA8cB2d60FD37bCB9A2'
    };

    const currency = buildTokenCurrency(token);

    expect(currency.name).toBe('VBRID');
    expect(currency.symbol).toBe('VBRID');
    expect(currency.icon).toBe('/icons/currencies/bridgeveth.svg');
    expect(currency.searchTerms).toContain('Bridge.vETH');
  });

  test('shows known ERC20 names immediately before contract metadata finishes loading', () => {
    const token = {
      name: 'DAI.vETH',
      ticker: 'DAI',
      value: '0x8b72F1c2D326d376aDd46698E385Cf624f0CA1dA',
      erc20address: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    };

    const currency = buildTokenCurrency(token);

    expect(currency.name).toBe('Dai Stablecoin');
    expect(currency.symbol).toBe('DAI');
    expect(currency.searchTerms).toContain('DAI.vETH');
  });

  test('still prefers contract-derived names for non-canonical ERC20 tokens', () => {
    const token = {
      name: 'SomeMappedToken',
      ticker: 'SMT',
      ethereumName: 'Some Mapped Token',
      ethereumSymbol: 'SMT',
      value: '0x1111111111111111111111111111111111111111',
      erc20address: '0x2222222222222222222222222222222222222222'
    };

    const currency = buildTokenCurrency(token);

    expect(currency.name).toBe('Some Mapped Token');
    expect(currency.symbol).toBe('SMT');
    expect(currency.searchTerms).toContain('SomeMappedToken');
  });

  test('falls back to the mapped asset name without the Verus wrapper text', () => {
    const token = {
      name: '[ChainLink Token] as vLINK.vETH',
      ticker: 'LINK',
      value: '0x3333333333333333333333333333333333333333',
      erc20address: '0x514910771AF9Ca656af840dff83E8264EcF986CA'
    };

    const currency = buildTokenCurrency(token);

    expect(currency.name).toBe('ChainLink Token');
    expect(currency.symbol).toBe('LINK');
    expect(currency.searchTerms).toContain('[ChainLink Token] as vLINK.vETH');
  });

  test('falls back to the symbol when the mapped asset name is only a raw address', () => {
    const token = {
      name: '[0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48] as vUSDC.vETH',
      ticker: 'USDC',
      value: '0x4444444444444444444444444444444444444444',
      erc20address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    };

    const currency = buildTokenCurrency(token);

    expect(currency.name).toBe('USDC');
    expect(currency.symbol).toBe('USDC');
    expect(currency.searchTerms).toContain('[0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48] as vUSDC.vETH');
  });
});
