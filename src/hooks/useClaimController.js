import { useCallback, useEffect, useState } from 'react';

import { useWeb3React } from '@web3-react/core';

import DELEGATOR_ABI from 'abis/DelegatorAbi.json';
import { useToast } from 'components/Toast/ToastProvider';
import { DELEGATOR_ADD, TESTNET } from 'constants/contractAddress';
import useContract from 'hooks/useContract';
import { fromBase58Check } from 'utils/verusAddress';
import { padLeft } from 'utils/ethereumUnits';
import { getTokenOptions } from 'utils/options';
import { requestRefundAddressData } from 'utils/refundAddress';
import {
  uint64ToVerusFloat,
  validateClaimAddress
} from 'utils/rules';
import {
  assertBridgeTransactionContext,
  isExpectedWalletChain
} from 'utils/walletNetwork';

const maxGas = 800000;
const maxGasClaim = 80000;
const TYPE_FEE = 1;
const TYPE_REFUND = 2;
const TYPE_REFUND_CHECK = 3;
const TYPE_PUBLICKEY = 4;
const MINIMUM_EARNINGS_TO_CLAIM = 0.006;
const CONNECT_WALLET_LOOKUP_MESSAGE = TESTNET
  ? 'Connect a wallet from the header to inspect refunds.'
  : 'Connect a wallet from the header to inspect earnings and refunds.';

const formatHexAddress = (address, type) => {
  const verusAddress = fromBase58Check(address);
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
    const padded = Buffer.from(`${padLeft(formatted, 64)}`, 'hex');
    padded[1] = 16;
    return `0x${padded.toString('hex')}`;
  }

  if (type === TYPE_FEE || type === TYPE_PUBLICKEY) {
    return `0x${Buffer.from(`${padLeft(formatted, 64)}`, 'hex').toString('hex')}`;
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

const hasPositiveAmount = (amount) => {
  const parsedAmount = parseFloat(amount);
  return Number.isFinite(parsedAmount) && parsedAmount > 0;
};

const buildEarningsStatus = (amount, addressToInspect) => {
  if (!hasPositiveAmount(amount)) {
    return {
      severity: 'info',
      message: 'No bridgekeeper earnings detected for this address yet.'
    };
  }

  if (addressToInspect?.startsWith('R')) {
    return {
      severity: 'info',
      message: `${amount} ETH is linked to this payout address.`
    };
  }

  if (parseFloat(amount) < MINIMUM_EARNINGS_TO_CLAIM) {
    return {
      severity: 'warning',
      message: `${amount} ETH found. A minimum of 0.006 ETH is required to cover import cost.`
    };
  }

  return {
    severity: 'info',
    message: `${amount} ETH is ready to claim as bridgekeeper earnings.`
  };
};

const buildRefundStatus = ({
  entries,
  failedInspectionCount = 0,
  hasTokenLoadError,
  totalInspectionCount = 0
}) => {
  if (hasTokenLoadError) {
    return {
      severity: 'warning',
      message: 'Refunded assets are temporarily unavailable to inspect.'
    };
  }

  if (failedInspectionCount > 0) {
    if (failedInspectionCount === totalInspectionCount) {
      return {
        severity: 'error',
        message: 'Unable to inspect refunded assets right now.'
      };
    }

    return {
      severity: 'warning',
      message: entries.length
        ? `Found ${entries.length} refundable ${entries.length === 1 ? 'asset' : 'assets'} for this address. Some assets could not be inspected right now.`
        : 'Some refunded assets could not be inspected right now.'
    };
  }

  if (!entries.length) {
    return {
      severity: 'info',
      message: 'No refunded assets detected for this address.'
    };
  }

  return {
    severity: 'info',
    message: `Found ${entries.length} refundable ${entries.length === 1 ? 'asset' : 'assets'} for this address.`
  };
};

const buildDisconnectedInspectionStatus = () => ({
  severity: 'info',
  message: CONNECT_WALLET_LOOKUP_MESSAGE
});

const getAddressError = (address) => {
  if (!address) {
    return '';
  }

  const result = validateClaimAddress(address);
  return result === true ? '' : result;
};

export default function useClaimController() {
  const [address, setAddress] = useState('');
  const [earningsAmount, setEarningsAmount] = useState(null);
  const [earningsStatus, setEarningsStatus] = useState(null);
  const [refundEntries, setRefundEntries] = useState([]);
  const [refundStatus, setRefundStatus] = useState(null);
  const [tokenOptions, setTokenOptions] = useState([]);
  const [hasLoadedRefundTokens, setHasLoadedRefundTokens] = useState(false);
  const [refundTokenLoadError, setRefundTokenLoadError] = useState(false);
  const [hasLookup, setHasLookup] = useState(false);
  const [isEarningsLookupPending, setIsEarningsLookupPending] = useState(false);
  const [isRefundLookupPending, setIsRefundLookupPending] = useState(false);
  const [actionTarget, setActionTarget] = useState('');
  const [walletAddressDetails, setWalletAddressDetails] = useState(null);
  const [walletAddressStatus, setWalletAddressStatus] = useState(null);
  const [isWalletAddressPending, setIsWalletAddressPending] = useState(false);
  const [lookupRevision, setLookupRevision] = useState(0);
  const { account, chainId, library } = useWeb3React();
  const { addToast } = useToast();
  const delegatorContract = useContract(DELEGATOR_ADD, DELEGATOR_ABI);

  const normalizedAddress = address.trim();
  const addressError = getAddressError(normalizedAddress);
  const isWalletVerificationRequired = !TESTNET && normalizedAddress.startsWith('R');
  const isWalletLinkedAddress = Boolean(
    normalizedAddress
    && walletAddressDetails
    && walletAddressDetails.refundAddress === normalizedAddress
  );

  const clearEarningsLookup = useCallback(() => {
    setIsEarningsLookupPending(false);
    setEarningsAmount(null);
    setEarningsStatus(null);
  }, []);

  const clearRefundLookup = useCallback(() => {
    setIsRefundLookupPending(false);
    setRefundEntries([]);
    setRefundStatus(null);
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadRefundTokens = async () => {
      if (!delegatorContract) {
        if (!ignore) {
          setTokenOptions([]);
          setHasLoadedRefundTokens(false);
          setRefundTokenLoadError(false);
        }
        return;
      }

      if (!ignore) {
        setHasLoadedRefundTokens(false);
        setRefundTokenLoadError(false);
      }

      try {
        const tokens = await getTokenChoices(delegatorContract);
        if (!ignore) {
          setTokenOptions(tokens);
          setHasLoadedRefundTokens(true);
        }
      } catch (error) {
        if (!ignore) {
          setTokenOptions([]);
          setRefundTokenLoadError(true);
          setHasLoadedRefundTokens(true);
        }
      }
    };

    loadRefundTokens();

    return () => {
      ignore = true;
    };
  }, [delegatorContract]);

  const inspectClaimableEarnings = useCallback(async (addressToInspect) => {
    const feeAddress = formatHexAddress(addressToInspect, TYPE_FEE);
    const earningsRaw = await delegatorContract.callStatic.claimableFees(feeAddress);
    const nextEarningsAmount = uint64ToVerusFloat(earningsRaw);

    return {
      earningsAmount: nextEarningsAmount,
      earningsStatus: buildEarningsStatus(nextEarningsAmount, addressToInspect)
    };
  }, [delegatorContract]);

  const inspectRefundEntries = useCallback(async (addressToInspect) => {
    const refundAddress = formatHexAddress(addressToInspect, TYPE_REFUND_CHECK);
    const refundResults = await Promise.all(tokenOptions.map(async (token) => {
      try {
        const amount = uint64ToVerusFloat(await delegatorContract.callStatic.refunds(refundAddress, token.value));
        return {
          didFail: false,
          entry: {
            ...token,
            amount
          }
        };
      } catch (error) {
        return {
          didFail: true,
          entry: null
        };
      }
    }));
    const failedInspectionCount = refundResults.filter((result) => result.didFail).length;
    const nextRefundEntries = refundResults
      .map((result) => result.entry)
      .filter((entry) => entry && hasPositiveAmount(entry.amount));

    return {
      refundEntries: nextRefundEntries,
      refundStatus: buildRefundStatus({
        entries: nextRefundEntries,
        failedInspectionCount,
        hasTokenLoadError: refundTokenLoadError,
        totalInspectionCount: tokenOptions.length
      })
    };
  }, [delegatorContract, refundTokenLoadError, tokenOptions]);

  useEffect(() => {
    let ignore = false;

    if (TESTNET) {
      setHasLookup(Boolean(normalizedAddress && !addressError && delegatorContract));
      clearEarningsLookup();
      return () => {
        ignore = true;
      };
    }

    if (!normalizedAddress) {
      setHasLookup(false);
      clearEarningsLookup();
      clearRefundLookup();
      return () => {
        ignore = true;
      };
    }

    if (addressError) {
      setHasLookup(false);
      clearEarningsLookup();
      return () => {
        ignore = true;
      };
    }

    if (!delegatorContract) {
      setHasLookup(false);
      clearEarningsLookup();
      setEarningsStatus(buildDisconnectedInspectionStatus());
      return () => {
        ignore = true;
      };
    }

    setHasLookup(true);
    setEarningsAmount(null);
    setEarningsStatus(null);
    setIsEarningsLookupPending(true);

    const loadEarnings = async () => {
      try {
        const inspection = await inspectClaimableEarnings(normalizedAddress);
        if (!ignore) {
          setEarningsAmount(inspection.earningsAmount);
          setEarningsStatus(inspection.earningsStatus);
        }
      } catch (error) {
        if (!ignore) {
          setEarningsAmount(null);
          setEarningsStatus({
            severity: 'error',
            message: error.message || 'Unable to inspect bridgekeeper earnings right now.'
          });
        }
      } finally {
        if (!ignore) {
          setIsEarningsLookupPending(false);
        }
      }
    };

    loadEarnings();

    return () => {
      ignore = true;
    };
  }, [
    addressError,
    clearEarningsLookup,
    clearRefundLookup,
    delegatorContract,
    inspectClaimableEarnings,
    lookupRevision,
    normalizedAddress
  ]);

  useEffect(() => {
    let ignore = false;

    if (!normalizedAddress) {
      clearRefundLookup();
      return () => {
        ignore = true;
      };
    }

    if (addressError) {
      clearRefundLookup();
      return () => {
        ignore = true;
      };
    }

    if (!delegatorContract) {
      clearRefundLookup();
      setRefundStatus(buildDisconnectedInspectionStatus());
      return () => {
        ignore = true;
      };
    }

    setRefundEntries([]);
    setRefundStatus(null);

    if (!hasLoadedRefundTokens) {
      setIsRefundLookupPending(true);
      return () => {
        ignore = true;
      };
    }

    if (refundTokenLoadError) {
      setIsRefundLookupPending(false);
      setRefundEntries([]);
      setRefundStatus(buildRefundStatus({
        entries: [],
        hasTokenLoadError: true
      }));
      return () => {
        ignore = true;
      };
    }

    setIsRefundLookupPending(true);

    const loadRefunds = async () => {
      try {
        const inspection = await inspectRefundEntries(normalizedAddress);
        if (!ignore) {
          setRefundEntries(inspection.refundEntries);
          setRefundStatus(inspection.refundStatus);
        }
      } catch (error) {
        if (!ignore) {
          setRefundEntries([]);
          setRefundStatus({
            severity: 'error',
            message: 'Unable to inspect refunded assets right now.'
          });
        }
      } finally {
        if (!ignore) {
          setIsRefundLookupPending(false);
        }
      }
    };

    loadRefunds();

    return () => {
      ignore = true;
    };
  }, [
    addressError,
    clearRefundLookup,
    delegatorContract,
    hasLoadedRefundTokens,
    inspectRefundEntries,
    lookupRevision,
    normalizedAddress,
    refundTokenLoadError
  ]);

  useEffect(() => {
    setWalletAddressDetails(null);
    setWalletAddressStatus(null);
    setIsWalletAddressPending(false);
  }, [account]);

  useEffect(() => {
    setWalletAddressStatus(null);
  }, [normalizedAddress]);

  const refreshLookup = useCallback(() => {
    setLookupRevision((value) => value + 1);
  }, []);

  const loadWalletAddressDetails = useCallback(async () => {
    if (!account) {
      throw new Error('Connect a wallet from the header to use the connected wallet address.');
    }

    if (walletAddressDetails) {
      return walletAddressDetails;
    }

    const nextDetails = await requestRefundAddressData(account);
    setWalletAddressDetails(nextDetails);
    return nextDetails;
  }, [account, walletAddressDetails]);

  const handleWalletAddressAction = useCallback(async () => {
    if (!account) {
      setWalletAddressStatus({
        severity: 'info',
        message: isWalletVerificationRequired
          ? 'Connect a wallet from the header to verify this payout address.'
          : 'Connect a wallet from the header to use the connected wallet address.'
      });
      return;
    }

    setIsWalletAddressPending(true);
    setWalletAddressStatus(null);

    try {
      const nextDetails = await loadWalletAddressDetails();

      if (isWalletVerificationRequired) {
        setWalletAddressStatus(
          nextDetails.refundAddress === normalizedAddress
            ? {
              severity: 'success',
              message: 'Connected wallet verified for this payout address.'
            }
            : {
              severity: 'warning',
              message: `Connected wallet derives ${nextDetails.refundAddress}, not this payout address.`
            }
        );
        return;
      }

      setAddress(nextDetails.refundAddress);
    } catch (error) {
      setWalletAddressStatus({
        severity: 'error',
        message: error.message || 'Unable to derive the connected wallet payout address right now.'
      });
    } finally {
      setIsWalletAddressPending(false);
    }
  }, [account, isWalletVerificationRequired, loadWalletAddressDetails, normalizedAddress]);

  const handleClaimEarnings = useCallback(async () => {
    if (TESTNET) {
      return;
    }

    if (!normalizedAddress || addressError) {
      return;
    }

    if (!account) {
      setEarningsStatus({
        severity: 'info',
        message: 'Connect a wallet from the header to claim earnings.'
      });
      return;
    }

    if (!delegatorContract) {
      setEarningsStatus({
        severity: 'warning',
        message: 'Bridge data is temporarily unavailable.'
      });
      return;
    }

    setActionTarget('earnings');

    try {
      await assertBridgeTransactionContext(library);

      if (isWalletVerificationRequired) {
        const nextDetails = await loadWalletAddressDetails();

        if (nextDetails.refundAddress !== normalizedAddress) {
          setEarningsStatus({
            severity: 'warning',
            message: `${normalizedAddress} is not derived from the connected wallet. Switch to the matching wallet or use the connected wallet action above.`
          });
          return;
        }

        await delegatorContract.callStatic.sendfees(
          `0x${nextDetails.publicKey.slice(4, 68)}`,
          `0x${nextDetails.publicKey.slice(68, 132)}`
        );

        await assertBridgeTransactionContext(library);
        const txResult = await delegatorContract.sendfees(
          `0x${nextDetails.publicKey.slice(4, 68)}`,
          `0x${nextDetails.publicKey.slice(68, 132)}`,
          { from: account, gasLimit: maxGasClaim }
        );

        await txResult.wait();
        addToast({ type: 'success', description: 'Wallet-linked earnings transaction submitted successfully.' });
        setEarningsStatus({
          severity: 'success',
          message: 'Bridgekeeper earnings claimed successfully to the connected Ethereum wallet.'
        });
        refreshLookup();
        return;
      }

      const feeAddress = formatHexAddress(normalizedAddress, TYPE_FEE);
      await delegatorContract.callStatic.sendfees(feeAddress, `0x${Buffer.alloc(32).toString('hex')}`);
      await assertBridgeTransactionContext(library);
      const txResult = await delegatorContract.sendfees(
        feeAddress,
        `0x${Buffer.alloc(32).toString('hex')}`,
        { from: account, gasLimit: maxGas }
      );

      await txResult.wait();
      addToast({ type: 'success', description: 'Earnings claim transaction submitted successfully.' });
      setEarningsStatus({
        severity: 'success',
        message: 'Bridgekeeper earnings claimed successfully.'
      });
      refreshLookup();
    } catch (error) {
      addToast({ type: 'error', description: error.message || 'Earnings claim transaction failed.' });
      setEarningsStatus({
        severity: 'error',
        message: error.message || 'Unable to claim earnings right now.'
      });
    } finally {
      setActionTarget('');
    }
  }, [
    account,
    addressError,
    addToast,
    delegatorContract,
    isWalletVerificationRequired,
    library,
    loadWalletAddressDetails,
    normalizedAddress,
    refreshLookup
  ]);

  const handleClaimRefund = useCallback(async (currency) => {
    if (!normalizedAddress || addressError) {
      return;
    }

    if (!account) {
      setRefundStatus({
        severity: 'info',
        message: 'Connect a wallet from the header to claim refunded assets.'
      });
      return;
    }

    if (!delegatorContract) {
      setRefundStatus({
        severity: 'warning',
        message: 'Bridge data is temporarily unavailable.'
      });
      return;
    }

    const selectedEntry = refundEntries.find((entry) => entry.value === currency);
    if (!selectedEntry) {
      return;
    }

    setActionTarget(`refund:${currency}`);

    try {
      await assertBridgeTransactionContext(library);
      const refundAddress = formatHexAddress(normalizedAddress, TYPE_REFUND);
      const previewClaim = await delegatorContract.callStatic.claimRefund(refundAddress, currency);

      if (previewClaim === '0x') {
        setRefundStatus({
          severity: 'warning',
          message: `No ${selectedEntry.name} is currently available to refund.`
        });
        return;
      }

      await assertBridgeTransactionContext(library);
      const txResult = await delegatorContract.claimRefund(refundAddress, currency, {
        from: account,
        gasLimit: maxGas
      });

      await txResult.wait();
      addToast({ type: 'success', description: `${selectedEntry.name} refund transaction submitted successfully.` });
      setRefundStatus({
        severity: 'success',
        message: `${selectedEntry.name} refunded successfully.`
      });
      refreshLookup();
    } catch (error) {
      addToast({ type: 'error', description: error.message || 'Refund transaction failed.' });
      setRefundStatus({
        severity: 'error',
        message: error.message || 'Unable to claim the selected refund right now.'
      });
    } finally {
      setActionTarget('');
    }
  }, [account, addressError, addToast, delegatorContract, library, normalizedAddress, refundEntries, refreshLookup]);

  let walletActionLabel = 'Use connected wallet';
  if (isWalletVerificationRequired) {
    walletActionLabel = isWalletLinkedAddress ? 'Connected wallet verified' : 'Verify connected wallet';
  }

  let earningsActionLabel = 'Claim back to this Verus address';
  if (isWalletVerificationRequired) {
    earningsActionLabel = isWalletLinkedAddress
      ? 'Claim to connected Ethereum wallet'
      : 'Verify connected wallet to claim';
  }

  let earningsClaimHelp = '';
  if (normalizedAddress && !addressError && isWalletVerificationRequired) {
    if (isWalletLinkedAddress) {
      earningsClaimHelp = 'This payout address matches the connected wallet.';
    } else if (walletAddressDetails) {
      earningsClaimHelp = `Connected wallet derives ${walletAddressDetails.refundAddress}, not this payout address.`;
    } else {
      earningsClaimHelp = 'Verify the connected wallet before claiming this R-address.';
    }
  }

  const canSubmitWalletTransactions = Boolean(account && isExpectedWalletChain(chainId));

  const canClaimEarnings = !TESTNET && Boolean(
    canSubmitWalletTransactions
    && normalizedAddress
    && !addressError
    && hasPositiveAmount(earningsAmount)
    && !actionTarget
    && (
      isWalletVerificationRequired
        ? isWalletLinkedAddress
        : parseFloat(earningsAmount) >= MINIMUM_EARNINGS_TO_CLAIM
    )
  );

  const hasAnyResults = refundEntries.length > 0 || (!TESTNET && hasPositiveAmount(earningsAmount));

  const isLookupPending = isRefundLookupPending || (!TESTNET && isEarningsLookupPending);
  const lookupStatuses = TESTNET ? [refundStatus] : [earningsStatus, refundStatus];
  const hasLookupIssue = lookupStatuses.some((status) => status && status.severity !== 'info');
  const hasCompletedLookup = Boolean(refundStatus) && (TESTNET || Boolean(earningsStatus));
  const isEmptyLookup = Boolean(
    hasLookup
    && !isLookupPending
    && !hasAnyResults
    && !addressError
    && !hasLookupIssue
    && hasCompletedLookup
  );

  return {
    account,
    actionTarget,
    canSubmitWalletTransactions,
    address,
    addressError,
    canClaimEarnings,
    earningsAmount,
    earningsActionLabel,
    earningsClaimHelp,
    earningsStatus,
    handleClaimEarnings,
    handleClaimRefund,
    handleWalletAddressAction,
    hasAnyResults,
    hasLookup,
    isActionPending: Boolean(actionTarget),
    isEarningsLookupPending,
    isEmptyLookup,
    isLookupPending,
    isRefundLookupPending,
    isWalletLinkedAddress,
    isWalletAddressPending,
    isWalletVerificationRequired,
    refundEntries,
    refundStatus,
    setAddress,
    walletActionLabel,
    walletAddressStatus
  };
}
