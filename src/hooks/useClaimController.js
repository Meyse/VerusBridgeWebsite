import { useEffect, useMemo, useState } from 'react';

import { useWeb3React } from '@web3-react/core';
import web3 from 'web3';

import DELEGATOR_ABI from 'abis/DelegatorAbi.json';
import { useToast } from 'components/Toast/ToastProvider';
import { DELEGATOR_ADD } from 'constants/contractAddress';
import useContract from 'hooks/useContract';
import bitGoUTXO from 'utils/bitUTXO';
import { getTokenOptions } from 'utils/options';
import { requestRefundAddressData } from 'utils/refundAddress';
import {
  isiAddress,
  isRAddress,
  uint64ToVerusFloat,
  validateClaimAddress
} from 'utils/rules';

const maxGas = 800000;
const maxGasClaim = 80000;
const TYPE_FEE = 1;
const TYPE_REFUND = 2;
const TYPE_REFUND_CHECK = 3;
const TYPE_PUBLICKEY = 4;

const formatHexAddress = (address, type) => {
  const verusAddress = bitGoUTXO.address.fromBase58Check(address);
  let formatted = null;

  switch (verusAddress.version) {
    case 60:
      formatted = `0214${verusAddress.hash.toString('hex')}`;
      break;
    case 102:
      formatted = `0414${verusAddress.hash.toString('hex')}`;
      break;
    default:
      return null;
  }

  if (type === TYPE_REFUND_CHECK) {
    const padded = Buffer.from(`${web3.utils.padLeft(formatted, 64)}`, 'hex');
    padded[1] = 16;
    return `0x${padded.toString('hex')}`;
  }

  if (type === TYPE_FEE || type === TYPE_PUBLICKEY) {
    return `0x${Buffer.from(`${web3.utils.padLeft(formatted, 64)}`, 'hex').toString('hex')}`;
  }

  return `0x${formatted}`;
};

const getTokenChoices = async (delegatorContract) => {
  const tokens = await delegatorContract.callStatic.getTokenList(0, 0);
  return getTokenOptions(false, tokens.map((token) => ({
    label: token.name,
    name: token.name,
    ticker: token.ticker,
    value: token.iaddress,
    iaddress: token.iaddress,
    erc20address: token.erc20ContractAddress,
    flags: token.flags
  })));
};

export default function useClaimController() {
  const [address, setAddress] = useState('');
  const [alert, setAlert] = useState(null);
  const [claimRefund, setClaimRefund] = useState(false);
  const [feeToClaim, setFeeToClaim] = useState(null);
  const [isTxPending, setIsTxPending] = useState(false);
  const [refundCurrency, setRefundCurrency] = useState('');
  const [tokenOptions, setTokenOptions] = useState([]);
  const [usePublicKey, setUsePublicKey] = useState(false);
  const { account } = useWeb3React();
  const { addToast, removeAllToasts } = useToast();
  const delegatorContract = useContract(DELEGATOR_ADD, DELEGATOR_ABI);

  const selectedRefundCurrency = useMemo(
    () => tokenOptions.find((token) => token.value === refundCurrency) || null,
    [refundCurrency, tokenOptions]
  );

  const addressError = useMemo(() => {
    if (!address || usePublicKey) {
      return '';
    }

    const result = validateClaimAddress(address);
    return result === true ? '' : result;
  }, [address, usePublicKey]);
  const canSubmit = useMemo(() => {
    if (usePublicKey) {
      return Boolean(account) && !isTxPending;
    }

    return Boolean(feeToClaim && feeToClaim !== '0.00000000' && !addressError && !isTxPending);
  }, [account, addressError, feeToClaim, isTxPending, usePublicKey]);
  const submitLabel = useMemo(() => {
    if (usePublicKey) {
      return 'Claim via public key';
    }

    if (claimRefund) {
      return 'Claim refund';
    }

    return 'Claim fees';
  }, [claimRefund, usePublicKey]);

  useEffect(() => {
    let ignore = false;

    const loadRefundTokens = async () => {
      if (!delegatorContract) {
        return;
      }

      try {
        const tokens = await getTokenChoices(delegatorContract);
        if (!ignore) {
          setTokenOptions(tokens);
        }
      } catch (error) {
        if (!ignore) {
          setTokenOptions([]);
        }
      }
    };

    loadRefundTokens();

    return () => {
      ignore = true;
    };
  }, [delegatorContract]);

  const checkForAssets = async (addressToCheck, type, currency) => {
    const formattedAddress = formatHexAddress(addressToCheck, type);
    let feeSats = null;
    let fees = null;

    if (type === TYPE_FEE) {
      feeSats = await delegatorContract.callStatic.claimableFees(formattedAddress);
      fees = uint64ToVerusFloat(feeSats);
      if (fees === '0.00000000' || parseFloat(fees) < 0.006) {
        setAlert({
          severity: 'warning',
          message: `${fees} ETH available to claim. A minimum of 0.006 ETH is required to cover import cost.`
        });
        setFeeToClaim(null);
        return fees;
      }

      setAlert({ severity: 'info', message: `${fees} ETH available to claim.` });
    } else if (type === TYPE_REFUND_CHECK) {
      feeSats = await delegatorContract.callStatic.refunds(formattedAddress, currency);
      fees = uint64ToVerusFloat(feeSats);
      setAlert({
        severity: fees === '0.00000000' ? 'warning' : 'info',
        message: `${fees} available to refund.`
      });
    } else if (type === TYPE_PUBLICKEY) {
      feeSats = await delegatorContract.callStatic.claimableFees(formattedAddress);
      fees = uint64ToVerusFloat(feeSats);
    }

    setFeeToClaim(fees);
    return fees;
  };

  useEffect(() => {
    let ignore = false;

    const loadClaimableAssets = async () => {
      if (!address || usePublicKey || (!isRAddress(address) && !isiAddress(address))) {
        if (!ignore && feeToClaim !== null) {
          removeAllToasts();
          setAlert(null);
          setFeeToClaim(null);
        }
        return;
      }

      if (claimRefund) {
        if (!selectedRefundCurrency?.value) {
          if (!ignore) {
            setFeeToClaim(null);
            setAlert(null);
          }
          return;
        }

        await checkForAssets(address, TYPE_REFUND_CHECK, selectedRefundCurrency.value);
        return;
      }

      await checkForAssets(address, TYPE_FEE);
    };

    loadClaimableAssets();

    return () => {
      ignore = true;
    };
  }, [address, claimRefund, removeAllToasts, selectedRefundCurrency, usePublicKey]);

  const handleSubmit = async () => {
    if (!usePublicKey && addressError) {
      return;
    }

    if (!usePublicKey && !address) {
      setAlert({ severity: 'warning', message: 'Enter a Verus R-address or i-address.' });
      return;
    }

    if (usePublicKey && !account) {
      setAlert({ severity: 'info', message: 'Connect a wallet from the header to use public-key claiming.' });
      return;
    }

    setAlert(null);
    setIsTxPending(true);

    try {
      if (usePublicKey) {
        const { publicKey, refundAddress } = await requestRefundAddressData(account);
        const checkFees = await checkForAssets(refundAddress, TYPE_PUBLICKEY);

        if (checkFees === '0.00000000') {
          setAlert({
            severity: 'warning',
            message: `${refundAddress} has no fees to claim. Try another Ethereum account.`
          });
          setIsTxPending(false);
          return;
        }

        const txResult = await delegatorContract.sendfees(
          `0x${publicKey.slice(4, 68)}`,
          `0x${publicKey.slice(68, 132)}`,
          { from: account, gasLimit: maxGasClaim }
        );

        await txResult.wait();
        addToast({ type: 'success', description: 'Claim to ETH transaction submitted successfully.' });
        setFeeToClaim(null);
      } else if (claimRefund) {
        const refundAddress = formatHexAddress(address, TYPE_REFUND);
        const previewClaim = await delegatorContract.callStatic.claimRefund(refundAddress, selectedRefundCurrency.value);

        if (previewClaim === '0x') {
          setAlert({
            severity: 'warning',
            message: `No ${selectedRefundCurrency.value} available to refund.`
          });
          setIsTxPending(false);
          return;
        }

        const txResult = await delegatorContract.claimRefund(refundAddress, selectedRefundCurrency.value, {
          from: account,
          gasLimit: maxGas
        });

        await txResult.wait();
        addToast({ type: 'success', description: 'Refund transaction submitted successfully.' });
        setFeeToClaim(null);
      } else {
        const feeAddress = formatHexAddress(address, TYPE_FEE);
        if (address.startsWith('R')) {
          setAlert({
            severity: 'warning',
            message: `Import the private key for ${address} into MetaMask and use public-key claim to receive fees directly to that wallet.`
          });
          setIsTxPending(false);
          return;
        }

        await delegatorContract.callStatic.sendfees(feeAddress, `0x${Buffer.alloc(32).toString('hex')}`);
        const txResult = await delegatorContract.sendfees(
          feeAddress,
          `0x${Buffer.alloc(32).toString('hex')}`,
          { from: account, gasLimit: maxGas }
        );

        await txResult.wait();
        addToast({ type: 'success', description: 'Fee claim transaction submitted successfully.' });
        setFeeToClaim(null);
      }

      setAlert(null);
    } catch (error) {
      addToast({ type: 'error', description: error.message || 'Claim transaction failed.' });
      setAlert(null);
    } finally {
      setIsTxPending(false);
    }
  };

  return {
    account,
    address,
    addressError,
    alert,
    canSubmit,
    claimRefund,
    feeToClaim,
    handleSubmit,
    isTxPending,
    refundCurrency,
    selectRefundCurrency: (value) => setRefundCurrency(value),
    setAddress,
    setClaimRefund: (nextValue) => {
      setClaimRefund(nextValue);
      setAlert(null);
      if (!nextValue) {
        setAddress('');
      } else {
        setUsePublicKey(false);
      }
    },
    setUsePublicKey: (nextValue) => {
      setUsePublicKey(nextValue);
      setAddress('');
      setAlert(null);
      if (claimRefund) {
        setClaimRefund(false);
      }
    },
    selectedRefundCurrency,
    submitLabel,
    tokenOptions,
    usePublicKey
  };
}
