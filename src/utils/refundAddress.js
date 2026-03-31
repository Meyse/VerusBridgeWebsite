import { address as baddress, crypto as bcrypto } from '@bitgo/utxo-lib';
import { utils } from 'ethers';

const REFUND_ADDRESS_MESSAGE = 'Agreeing to this will create a public key address for Verus Refunds.';

export const REFUND_ADDRESS_STORAGE_KEY = 'pubkeyAddress';

const getHexEncodedRefundMessage = () => `0x${Buffer.from(REFUND_ADDRESS_MESSAGE, 'utf8').toString('hex')}`;

export const requestRefundAddressData = async (account) => {
  if (!window.ethereum) {
    throw new Error('Ethereum provider not found.');
  }

  const signature = await window.ethereum.request({
    method: 'personal_sign',
    params: [getHexEncodedRefundMessage(), account]
  });

  const messageHash = utils.hashMessage(REFUND_ADDRESS_MESSAGE);
  const publicKey = utils.recoverPublicKey(utils.arrayify(messageHash), signature);
  const compressedPublicKey = utils.computePublicKey(publicKey, true);
  const refundAddress = baddress.toBase58Check(
    bcrypto.hash160(Buffer.from(compressedPublicKey.slice(2), 'hex')),
    60
  );

  return {
    publicKey,
    refundAddress
  };
};
