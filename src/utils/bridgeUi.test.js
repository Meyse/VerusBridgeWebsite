import {
  buildDestinationCurrency,
  buildTokenCurrency,
  getCurrencyIcon,
  getTokenDisplayName,
  getTokenDisplaySymbol,
  getTokenVerusSymbol,
  sortSourceCurrencies
} from './bridgeUi';
import { GLOBAL_ADDRESS } from 'constants/contractAddress';

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
    expect(currency.icon).toBe('/icons/currencies/eth.svg');
    expect(currency.address).toBeUndefined();
    expect(currency.searchTerms).toContain('vETH');
    expect(currency.searchTerms).not.toContain('0x0000000000000000000000000000000000000000');
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

  test('prefers canonical Verus naming for mapped reserve tokens', () => {
    expect(getTokenVerusSymbol({
      name: 'DAI.vETH',
      ticker: 'DAI',
      value: '0x8b72F1c2D326d376aDd46698E385Cf624f0CA1dA'
    })).toBe('DAI.vETH');
  });

  test('uses canonical Verus symbols for direct receive destinations', () => {
    const destinationCurrency = buildDestinationCurrency(
      { value: 'VRSC', iaddress: '0x8b72F1c2D326d376aDd46698E385Cf624f0CA1dA' },
      {
        name: 'DAI.vETH',
        ticker: 'DAI',
        value: '0x8b72F1c2D326d376aDd46698E385Cf624f0CA1dA'
      }
    );

    expect(destinationCurrency.symbol).toBe('DAI.vETH');
    expect(destinationCurrency.name).toBe('Dai Stablecoin');
  });

  test('uses human-readable names for mapped direct receive destinations', () => {
    const destinationCurrency = buildDestinationCurrency(
      { value: 'VRSC', iaddress: '0x4444444444444444444444444444444444444444' },
      {
        name: 'vUSDC.vETH',
        ticker: 'USDC',
        ethereumName: 'USD Coin',
        ethereumSymbol: 'USDC',
        value: '0x4444444444444444444444444444444444444444',
        erc20address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
      }
    );

    expect(destinationCurrency.symbol).toBe('vUSDC.vETH');
    expect(destinationCurrency.name).toBe('USD Coin');
  });

  test('uses human-readable names for canonical destination currencies', () => {
    expect(buildDestinationCurrency(
      { value: 'bridgeVRSC', iaddress: GLOBAL_ADDRESS.VRSC }
    )).toMatchObject({
      name: 'Verus',
      symbol: 'VRSC'
    });

    expect(buildDestinationCurrency(
      { value: 'bridgeETH', iaddress: GLOBAL_ADDRESS.ETH }
    )).toMatchObject({
      name: 'Ethereum',
      symbol: 'vETH'
    });

    expect(buildDestinationCurrency(
      { value: 'bridgeMKR', iaddress: GLOBAL_ADDRESS.MKR }
    )).toMatchObject({
      name: 'Maker',
      symbol: 'MKR.vETH'
    });

    expect(buildDestinationCurrency(
      { value: 'bridgeBRIDGE', iaddress: GLOBAL_ADDRESS.BETH }
    )).toMatchObject({
      name: 'Bridge.vETH',
      symbol: 'Bridge.vETH'
    });
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
    expect(currency.icon).toBe('/icons/currencies/link.svg');
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
    expect(currency.icon).toBe('/icons/currencies/usdc.svg');
    expect(currency.searchTerms).toContain('[0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48] as vUSDC.vETH');
  });

  test('resolves provided symbol icons for additional ERC20 assets', () => {
    expect(getCurrencyIcon('BAT')).toBe('/icons/currencies/bat.svg');
    expect(getCurrencyIcon('PAXG')).toBe('/icons/currencies/paxg.svg');
    expect(getCurrencyIcon('XAUT')).toBe('/icons/currencies/xaut.svg');
    expect(getCurrencyIcon('WBTC')).toBe('/icons/currencies/wbtc.svg');
  });

  test('sorts source currencies by popularity first and alphabetically after that', () => {
    const currencies = [
      { id: 'vrsc', name: 'VRSC', symbol: 'VRSC' },
      { id: 'usdt', name: 'Tether USD', symbol: 'USDT' },
      { id: 'alpha', name: 'Alpha Token', symbol: 'ALPHA' },
      { id: 'mkr', name: 'Maker', symbol: 'MKR' },
      { id: 'bat', name: 'BAT', symbol: 'BAT' },
      { id: 'eth', name: 'Ethereum', symbol: 'ETH' },
      { id: 'beta', name: 'Beta Token', symbol: 'BETA' },
      { id: 'dai', name: 'Dai Stablecoin', symbol: 'DAI' },
      { id: 'usdc', name: 'USDC', symbol: 'USDC' },
      { id: 'link', name: 'ChainLink Token', symbol: 'LINK' }
    ];

    expect(sortSourceCurrencies(currencies).map((currency) => currency.symbol)).toEqual([
      'ETH',
      'DAI',
      'MKR',
      'USDC',
      'USDT',
      'LINK',
      'BAT',
      'ALPHA',
      'BETA',
      'VRSC'
    ]);
  });
});
