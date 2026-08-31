import bs58check from 'bs58check';
import { utils } from 'ethers';

const HASH_LENGTH = 20;
const MAX_VERSION = 0xffff;

const toBuffer = (value) => Buffer.isBuffer(value) ? value : Buffer.from(value);

export const fromBase58Check = (encodedAddress) => {
  const payload = toBuffer(bs58check.decode(encodedAddress));

  if (payload.length !== HASH_LENGTH + 1 && payload.length !== HASH_LENGTH + 2) {
    throw new TypeError(`Invalid address payload length: ${payload.length}`);
  }

  const versionLength = payload.length - HASH_LENGTH;

  return {
    hash: payload.subarray(versionLength),
    version: versionLength === 1 ? payload[0] : payload.readUInt16BE(0)
  };
};

export const toBase58Check = (hash, version) => {
  const addressHash = toBuffer(hash);

  if (addressHash.length !== HASH_LENGTH) {
    throw new TypeError(`Expected a ${HASH_LENGTH}-byte address hash.`);
  }

  if (!Number.isInteger(version) || version < 0 || version > MAX_VERSION) {
    throw new TypeError('Expected an unsigned two-byte address version.');
  }

  const versionPrefix = version <= 0xff
    ? Buffer.from([version])
    : Buffer.from([version >> 8, version & 0xff]);

  return bs58check.encode(Buffer.concat([versionPrefix, addressHash]));
};

export const hash160 = (value) => Buffer.from(
  utils.arrayify(utils.ripemd160(utils.sha256(toBuffer(value))))
);
