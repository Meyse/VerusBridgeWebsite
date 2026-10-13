import { Wallet, utils } from 'ethers';

import { GLOBAL_ADDRESS } from 'constants/contractAddress';
import { getConfigOptions } from 'utils/txConfig';

import {
  REFUND_ADDRESS_STORAGE_KEY,
  REFUND_ADDRESS_V2_STORAGE_KEY,
  RefundKeyMismatchError,
  getCachedRefundAddress,
  getStoredRefundAddresses,
  requestAndCacheRefundAddressData,
  requestRefundAddressData
} from './refundAddress';

const REFUND_MESSAGE = 'Agreeing to this will create a public key address for Verus Refunds.';

// Worked example from the plan (8.2): secp256k1 private key 1. All three values
// below come from outside this code base. The R-address is base58check of the
// hash160 with version byte 60, computed separately.
const KEY_ONE = `0x${'0'.repeat(63)}1`;
const KEY_ONE_ADDRESS = '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf';
const KEY_ONE_COMPRESSED_PUBLIC_KEY = '0x0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const KEY_ONE_HASH160 = '751e76e8199196d454941c45d1b3a323f1433bd6';
const KEY_ONE_REFUND_ADDRESS = 'RKxTdfmtxtfLDKZBgx6SvNkBtNu9jRYnLh';

const OTHER_KEY = `0x${'0'.repeat(63)}2`;
const decodeMessage = (hex) => Buffer.from(hex.slice(2), 'hex').toString('utf8');

const createLibrary = ({ accounts, sign }) => {
  const library = {
    provider: {},
    send: vi.fn(async (method, params) => {
      if (method === 'personal_sign') {
        return sign(params);
      }

      if (method === 'eth_accounts') {
        return typeof accounts === 'function' ? accounts() : accounts;
      }

      throw new Error(`Unexpected wallet call: ${method}`);
    })
  };

  return library;
};

const signMessageWith = (privateKey) => (params) => new Wallet(privateKey).signMessage(decodeMessage(params[0]));
const wrappedMethods = (library) => library.send.mock.calls.map(([method]) => method);
const readV2 = () => JSON.parse(window.localStorage.getItem(REFUND_ADDRESS_V2_STORAGE_KEY) || '{}');

describe('refund address verification', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('derives the worked-example refund address from the signed message', async () => {
    const library = createLibrary({ accounts: [KEY_ONE_ADDRESS], sign: signMessageWith(KEY_ONE) });

    const result = await requestRefundAddressData(KEY_ONE_ADDRESS, library);

    expect(result.refundAddress).toBe(KEY_ONE_REFUND_ADDRESS);
    expect(utils.computePublicKey(result.publicKey, true)).toBe(KEY_ONE_COMPRESSED_PUBLIC_KEY);
    expect(utils.hexlify(utils.ripemd160(utils.sha256(KEY_ONE_COMPRESSED_PUBLIC_KEY))).slice(2)).toBe(KEY_ONE_HASH160);
    expect(library.send).toHaveBeenCalledWith('personal_sign', [
      `0x${Buffer.from(REFUND_MESSAGE, 'utf8').toString('hex')}`,
      KEY_ONE_ADDRESS
    ]);
  });

  test('puts the refund address into the bounceback destination after the ETH address', async () => {
    const library = createLibrary({ accounts: [KEY_ONE_ADDRESS], sign: signMessageWith(KEY_ONE) });
    const { refundAddress } = await requestRefundAddressData(KEY_ONE_ADDRESS, library);

    const options = getConfigOptions({
      address: KEY_ONE_ADDRESS,
      auxDest: refundAddress,
      destination: 'swaptoETH',
      GASPrice: { SATSCOST: '1', WEICOST: '1' },
      poolAvailable: true,
      token: { value: GLOBAL_ADDRESS.ETH }
    });

    expect(options.destinationaddress.endsWith(`01160214${KEY_ONE_HASH160}`)).toBe(true);
  });

  test('accepts the account in any letter case', async () => {
    const library = createLibrary({ accounts: [KEY_ONE_ADDRESS], sign: signMessageWith(KEY_ONE) });

    const result = await requestRefundAddressData(KEY_ONE_ADDRESS.toLowerCase(), library);

    expect(result.refundAddress).toBe(KEY_ONE_REFUND_ADDRESS);
  });

  test('stops when another key signed, caches nothing, and makes no other wallet call', async () => {
    const library = createLibrary({ accounts: [KEY_ONE_ADDRESS], sign: signMessageWith(OTHER_KEY) });

    await expect(requestAndCacheRefundAddressData(KEY_ONE_ADDRESS, library))
      .rejects.toBeInstanceOf(RefundKeyMismatchError);

    expect(window.localStorage.getItem(REFUND_ADDRESS_V2_STORAGE_KEY)).toBeNull();
    expect(getCachedRefundAddress(KEY_ONE_ADDRESS)).toBe('');
    expect(new Set(wrappedMethods(library))).toEqual(new Set(['personal_sign', 'eth_accounts']));
  });

  test('says which account the bridge cannot use when the key does not match', async () => {
    const library = createLibrary({ accounts: [KEY_ONE_ADDRESS], sign: signMessageWith(OTHER_KEY) });

    await expect(requestRefundAddressData(KEY_ONE_ADDRESS, library)).rejects.toThrow(
      "Your wallet did not sign with this account's key. The bridge cannot create a refund address for this account."
    );
  });

  test('stops when the wallet signed the hex text instead of the message bytes', async () => {
    const library = createLibrary({
      accounts: [KEY_ONE_ADDRESS],
      sign: (params) => new Wallet(KEY_ONE).signMessage(params[0])
    });

    await expect(requestAndCacheRefundAddressData(KEY_ONE_ADDRESS, library))
      .rejects.toBeInstanceOf(RefundKeyMismatchError);

    expect(window.localStorage.getItem(REFUND_ADDRESS_V2_STORAGE_KEY)).toBeNull();
  });

  test('stops on a malformed signature and caches nothing', async () => {
    const library = createLibrary({ accounts: [KEY_ONE_ADDRESS], sign: () => '0x1234' });

    await expect(requestAndCacheRefundAddressData(KEY_ONE_ADDRESS, library)).rejects.toThrow();

    expect(window.localStorage.getItem(REFUND_ADDRESS_V2_STORAGE_KEY)).toBeNull();
  });

  test('discards the result when the wallet account changed during signing', async () => {
    let currentAccounts = [KEY_ONE_ADDRESS];
    const library = createLibrary({
      accounts: () => currentAccounts,
      sign: async (params) => {
        const signature = await new Wallet(KEY_ONE).signMessage(decodeMessage(params[0]));
        currentAccounts = [new Wallet(OTHER_KEY).address];
        return signature;
      }
    });

    await expect(requestAndCacheRefundAddressData(KEY_ONE_ADDRESS, library)).rejects.toThrow();

    expect(window.localStorage.getItem(REFUND_ADDRESS_V2_STORAGE_KEY)).toBeNull();
  });

  test('stores a verified v2 record and does not sign again for a valid record', async () => {
    const library = createLibrary({ accounts: [KEY_ONE_ADDRESS], sign: signMessageWith(KEY_ONE) });

    const first = await requestAndCacheRefundAddressData(KEY_ONE_ADDRESS, library);
    const second = await requestAndCacheRefundAddressData(KEY_ONE_ADDRESS, library);

    expect(first.refundAddress).toBe(KEY_ONE_REFUND_ADDRESS);
    expect(second.refundAddress).toBe(KEY_ONE_REFUND_ADDRESS);
    expect(second.publicKey).toBe(first.publicKey);
    expect(library.send.mock.calls.filter(([method]) => method === 'personal_sign')).toHaveLength(1);
    expect(Object.values(readV2())).toEqual([{
      account: KEY_ONE_ADDRESS,
      publicKey: first.publicKey,
      refundAddress: KEY_ONE_REFUND_ADDRESS,
      version: 2
    }]);
    expect(getCachedRefundAddress(KEY_ONE_ADDRESS)).toBe(KEY_ONE_REFUND_ADDRESS);
    expect(getStoredRefundAddresses()).toEqual({ [KEY_ONE_ADDRESS]: KEY_ONE_REFUND_ADDRESS });
  });

  test('treats an old address-only cache entry as unverified and asks for a new signature', async () => {
    const legacy = JSON.stringify({ [KEY_ONE_ADDRESS]: 'RLegacyAddressThatWasNeverVerified11111' });
    window.localStorage.setItem(REFUND_ADDRESS_STORAGE_KEY, legacy);
    const library = createLibrary({ accounts: [KEY_ONE_ADDRESS], sign: signMessageWith(KEY_ONE) });

    expect(getCachedRefundAddress(KEY_ONE_ADDRESS)).toBe('');

    const result = await requestAndCacheRefundAddressData(KEY_ONE_ADDRESS, library);

    expect(result.refundAddress).toBe(KEY_ONE_REFUND_ADDRESS);
    expect(library.send.mock.calls.filter(([method]) => method === 'personal_sign')).toHaveLength(1);
    expect(window.localStorage.getItem(REFUND_ADDRESS_STORAGE_KEY)).toBe(legacy);
  });

  test.each([
    ['a record with another version', (record) => ({ ...record, version: 1 })],
    ['a refund address that does not match the key', (record) => ({ ...record, refundAddress: 'RWrongAddress' })],
    ['a public key that belongs to another account', (record) => ({
      ...record,
      publicKey: utils.computePublicKey(OTHER_KEY)
    })],
    ['a record stored for another account', (record) => ({ ...record, account: new Wallet(OTHER_KEY).address })]
  ])('ignores %s', async (_label, tamper) => {
    const library = createLibrary({ accounts: [KEY_ONE_ADDRESS], sign: signMessageWith(KEY_ONE) });
    await requestAndCacheRefundAddressData(KEY_ONE_ADDRESS, library);
    const [storageKey, record] = Object.entries(readV2())[0];
    window.localStorage.setItem(
      REFUND_ADDRESS_V2_STORAGE_KEY,
      JSON.stringify({ [storageKey]: tamper(record) })
    );

    expect(getCachedRefundAddress(KEY_ONE_ADDRESS)).toBe('');
    expect(getStoredRefundAddresses()).toEqual({});
  });

  test('shares one signature request for the same wallet and account, and not across wallets', async () => {
    let resolveSignature;
    const pending = new Promise((resolve) => { resolveSignature = resolve; });
    const firstWallet = createLibrary({ accounts: [KEY_ONE_ADDRESS], sign: () => pending });
    const secondWallet = createLibrary({ accounts: [KEY_ONE_ADDRESS], sign: signMessageWith(KEY_ONE) });

    const first = requestAndCacheRefundAddressData(KEY_ONE_ADDRESS, firstWallet);
    const repeated = requestAndCacheRefundAddressData(KEY_ONE_ADDRESS, firstWallet);
    const other = requestAndCacheRefundAddressData(KEY_ONE_ADDRESS, secondWallet);

    await other;
    resolveSignature(await new Wallet(KEY_ONE).signMessage(REFUND_MESSAGE));

    await expect(first).resolves.toMatchObject({ refundAddress: KEY_ONE_REFUND_ADDRESS });
    await expect(repeated).resolves.toMatchObject({ refundAddress: KEY_ONE_REFUND_ADDRESS });
    expect(firstWallet.send.mock.calls.filter(([method]) => method === 'personal_sign')).toHaveLength(1);
    expect(secondWallet.send.mock.calls.filter(([method]) => method === 'personal_sign')).toHaveLength(1);
  });

  test('asks for a connected wallet before it requests a signature', async () => {
    await expect(requestRefundAddressData('', {})).rejects.toThrow('Wallet account not found.');
    await expect(requestRefundAddressData(KEY_ONE_ADDRESS, undefined)).rejects.toThrow('Wallet is not connected.');
  });
});
