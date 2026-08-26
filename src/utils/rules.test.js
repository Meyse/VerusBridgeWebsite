import {
  buildExcludedEthereumAddressSet,
  isETHAddressAsync,
  normalizeEthereumAddress,
  validateAddress
} from './rules';

describe('address exclusion validation', () => {
  test('accepts a well-formed Ethereum address without a network request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(isETHAddressAsync('0x1234567890123456789012345678901234567890')).resolves.toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  test('rejects malformed destination addresses', async () => {
    await expect(validateAddress('0x1234')).resolves.toBe('Address is not valid');
  });

  test('canonicalizes prefixed and unprefixed exclusion-list spellings identically', () => {
    expect(normalizeEthereumAddress('0xAbCd')).toBe('abcd');
    expect(normalizeEthereumAddress('AbCd')).toBe('abcd');
  });

  test('fails closed when an exclusion-list entry is malformed', () => {
    expect(() => buildExcludedEthereumAddressSet([
      ' 0x1234567890123456789012345678901234567890'
    ])).toThrow(/valid Ethereum addresses/);
    expect(() => buildExcludedEthereumAddressSet([
      '0x1234567890123456789012345678901234567890'
    ])).not.toThrow();
  });
});
