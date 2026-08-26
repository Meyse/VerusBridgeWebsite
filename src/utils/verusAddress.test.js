import bs58check from 'bs58check';

import { fromBase58Check, toBase58Check } from './verusAddress';

const I_ADDRESS_FIXTURES = [
  ['1Af5b8015C64d39Ab44C60EAd8317f9F5a9B6C4C', 'i5w5MuNik5NtLcYmNzcvaoixooEebB6MGV'],
  ['454CB83913D688795E237837d30258d11ea7c752', 'i9nwxtKuVYX4MSbeULLiK2ttVi6rUEhh4X'],
  ['8b72F1c2D326d376aDd46698E385Cf624f0CA1dA', 'iGBs4DWztRNvNEJBt4mqHszLxfKTNHTkhM'],
  ['0200EbbD26467B866120D84A0d37c82CdE0acAEB', 'i3f7tSctFkiPpiedY8QR5Tep9p4qDVebDx'],
  ['65b5AaC6A4aa0Eb656AB6B8812184e7545b6A221', 'iCkKJuJScy4Z6NSDK7Mt42ZAB2NEnAE1o4'],
  ['A6ef9ea235635E328124Ff3429dB9F9E91b64e2d', 'iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq'],
  ['67460C2f56774eD27EeB8685f29f6CEC0B090B00', 'iCtawpxUiCc2sEupt7Z4u8SDAncGZpgSKm'],
  ['CCe5d18f305474F1e0e0ec1C507D8c85e7315fdf', 'iN9vbHXexEh6GTZ45fRoJGKTQThfbgUwMh'],
  ['ffEce948b8A38bBcC813411D2597f7f8485a0689', 'iSojYsotVzXz4wh2eJriASGo6UidJDDhL2'],
  ['005005b2b10a897FeD36FbD71c878213a7a169BF', 'i3WBJ7xEjTna5345D7gPnK4nKfbEBujZqL']
];

describe('Verus Base58Check addresses', () => {
  test.each(I_ADDRESS_FIXTURES)('preserves the version-102 address for %s', (hashHex, address) => {
    const decoded = fromBase58Check(address);

    expect(decoded.version).toBe(102);
    expect(decoded.hash.toString('hex')).toBe(hashHex.toLowerCase());
    expect(toBase58Check(Buffer.from(hashHex, 'hex'), 102)).toBe(address);
  });

  test.each([
    [60, 'R9NVxTj2ewfiTUzAfn7FSsq9kxNt6fjaaZ'],
    [255, '2mcH7xdrD782Zw1B4Sb4Q1KuZVKcphYyr21'],
    [256, '2n1ciwk9VpJVSkSK9U1PiVTBM7psmRDD9V4']
  ])('preserves the version-prefix boundary for version %i', (version, address) => {
    const hash = Buffer.alloc(20, 1);

    expect(toBase58Check(hash, version)).toBe(address);
    expect(fromBase58Check(address)).toEqual({ hash, version });
  });

  test('rejects invalid checksums and forbidden Base58 characters', () => {
    expect(() => fromBase58Check('i5w5MuNik5NtLcYmNzcvaoixooEebB6MGW')).toThrow();
    expect(() => fromBase58Check('0OIl')).toThrow();
  });

  test.each([20, 23])('rejects a %i-byte decoded payload', (length) => {
    expect(() => fromBase58Check(bs58check.encode(Buffer.alloc(length)))).toThrow(/payload length/);
  });
});
