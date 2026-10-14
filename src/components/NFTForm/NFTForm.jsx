import React, { useEffect, useState } from 'react';

import { Alert, Box, Button, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import { useWeb3React } from '@web3-react/core';
import { Contract } from 'ethers';
import { useForm } from 'react-hook-form';

import DELEGATOR_ABI from 'abis/DelegatorAbi.json';
import ERC1155_ABI from 'abis/ERC1155.json';
import ERC721_ABI from 'abis/ERC721Abi.json';
import { getEthereumTransactionUrl } from 'config/explorerLinks';
import {
  BLOCKCHAIN_NAME,
  DELEGATOR_ADD,
  ETHEREUM_BLOCKCHAIN_NAME,
  ETH_FEES,
  FLAGS,
  GLOBAL_ADDRESS,
  GLOBAL_IADDRESS,
  HEIGHT_LOCATION_IN_FORKS,
  VERUS_RPC_URL
} from 'constants/contractAddress';
import useContract from 'hooks/useContract';
import { useVerusDestinationResolution } from 'hooks/useVerusDestinationResolution';
import { useOptionalWalletContext } from 'providers/WalletProvider';
import { getContract } from 'utils/contract';
import { BN, padLeft, toWei } from 'utils/ethereumUnits';
import { convertVerusAddressToEthAddress } from 'utils/convert';
import { describeOperationError, runGuardedOperation } from 'utils/guardedOperation';
import { NFTAddressType } from 'utils/rules';
import { MESSAGES } from 'utils/sendScreens';
import { resolveVerusDestination } from 'utils/verusDestination';
import { VerusdRpcInterface } from 'utils/verusdRpc';
import {
  assertBridgeTransactionContext,
  isExpectedWalletChain
} from 'utils/walletNetwork';
import { getSendRuntime } from 'wallets/sendRuntime';
import { walletNameAtStart } from 'wallets/walletNames';
import { getWalletSession } from 'wallets/walletSession';

import AddressField from './NFTAddressField';
import NFTAmountField from './NFTAmountField';
import NFTField from './NFTField';

const maxGas = 6000000;
const maxGas2 = 100000;
const NFT_FAILED_MESSAGE = `The transaction failed on ${ETHEREUM_BLOCKCHAIN_NAME}. Your NFT was not bridged.`;
// A4: the approval did not give the bridge access to this NFT.
const NFT_NOT_APPROVED_MESSAGE = 'The bridge is not approved for this NFT. Approve it in your wallet, then try again.';
const verusd = new VerusdRpcInterface(GLOBAL_IADDRESS.VRSC, VERUS_RPC_URL);

export default function NFTForm() {
  const [poolAvailable, setPoolAvailable] = useState(false);
  const [isTxPending, setIsTxPending] = useState(false);
  const [alert, setAlert] = useState(null);
  const [verusChainHeight, setverusChainHeight] = useState(null);
  const { account, chainId, library } = useWeb3React();
  const connectedWallet = useOptionalWalletContext()?.connectedWallet || null;
  const delegatorContract = useContract(DELEGATOR_ADD, DELEGATOR_ABI);

  const { handleSubmit, control, watch } = useForm({
    mode: 'all'
  });
  const selectedToken = watch('nft');
  const address = watch('address');
  const {
    address: resolvedAddress,
    error: addressResolutionError,
    isResolving: isAddressResolving,
    message: addressResolutionMessage
  } = useVerusDestinationResolution(address, verusd, BLOCKCHAIN_NAME);

  const checkBridgeLaunched = async (contract) => {
    try {

      const pool = await contract.callStatic.bridgeConverterActive();
      setPoolAvailable(pool);
      const forksData = await delegatorContract.callStatic.bestForks(0);
      const heightPos = HEIGHT_LOCATION_IN_FORKS;
      const heightHex = parseInt(`0x${forksData.substring(heightPos, heightPos + 8)}`, 16);
      setverusChainHeight(heightHex || 1);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err)
      setverusChainHeight(1);
    }
  }

  useEffect(() => {
    if (delegatorContract && account) {
      checkBridgeLaunched(delegatorContract);
    }
  }, [delegatorContract, account])


  // The NFT send runs through the guards (A2 to A5): an approval step when the
  // bridge is not approved yet, the A4 read-back of that approval through the
  // site RPC, then the transfer. Each state shows in the alert above the form.
  const onSubmit = async (values) => {
    const { nft, amount, address } = values;
    setAlert(null);
    setIsTxPending(true);

    try {
      const transactionDestination = await resolveVerusDestination(address, verusd, BLOCKCHAIN_NAME);
      const transactionAddress = transactionDestination.address;
      await assertBridgeTransactionContext(library, connectedWallet);

      const runtime = getSendRuntime();
      const tokenERC = nft.erc20address;
      const tokenID = `0x${padLeft(nft.value.toHexString().slice(2), 64)}`;
      // eslint-disable-next-line
      const is721 = parseInt(nft.flags & FLAGS.MAPPING_ERC721_NFT_DEFINITION) == FLAGS.MAPPING_ERC721_NFT_DEFINITION;
      const steps = [];
      let amountToSend;

      if (is721) {
        amountToSend = 1;
        steps.push({
          abi: ERC721_ABI,
          address: tokenERC,
          afterSuccess: async () => {
            const approved = await new Contract(tokenERC, ERC721_ABI, runtime.siteProvider).getApproved(tokenID);
            if (String(approved).toLowerCase() !== DELEGATOR_ADD.toLowerCase()) {
              throw new Error(NFT_NOT_APPROVED_MESSAGE);
            }
          },
          args: [DELEGATOR_ADD, tokenID],
          gasLimitFloor: maxGas2,
          method: 'approve',
          type: 'erc721-approval'
        });
      } else {
        amountToSend = amount || 1;
        const NFTInstContract = getContract(tokenERC, ERC1155_ABI, library, account);
        const [isApproved, amountOfNFTs] = await Promise.all([
          NFTInstContract.callStatic.isApprovedForAll(account, DELEGATOR_ADD),
          NFTInstContract.callStatic.balanceOf(account, tokenID)
        ]);

        if (amountOfNFTs < amount) {
          throw new Error(`You do not have enough NFT's to send. You have ${amountOfNFTs} and you are trying to send ${amount}.`);
        }

        if (!isApproved) {
          steps.push({
            abi: ERC1155_ABI,
            address: tokenERC,
            afterSuccess: async () => {
              const approved = await new Contract(tokenERC, ERC1155_ABI, runtime.siteProvider)
                .isApprovedForAll(account, DELEGATOR_ADD);
              if (!approved) {
                throw new Error(NFT_NOT_APPROVED_MESSAGE);
              }
            },
            args: [DELEGATOR_ADD, true],
            gasLimitFloor: maxGas2,
            method: 'setApprovalForAll',
            type: 'erc1155-approval'
          });
        }
      }

      const addressType = NFTAddressType(transactionAddress);
      const hexID = convertVerusAddressToEthAddress(transactionAddress);
      const CReserveTransfer = {
        version: 1,
        currencyvalue: { currency: nft.iaddress, amount: amountToSend }, // currency sending from ethereum
        flags: 1,
        feecurrencyid: poolAvailable ? GLOBAL_ADDRESS.ETH : GLOBAL_ADDRESS.VRSC, // fee is vrsc pre bridge launch, veth or others post.
        fees: poolAvailable ? ETH_FEES.SATS : ETH_FEES.VRSC_SATS_FEE,
        destination: { destinationtype: addressType, destinationaddress: hexID }, // destination address currecny is going to
        destcurrencyid: poolAvailable ? GLOBAL_ADDRESS.BETH : GLOBAL_ADDRESS.VRSC,   // destination currency is vrsc on direct. bridge.veth on bounceback
        destsystemid: "0x0000000000000000000000000000000000000000",     // destination system not used
        secondreserveid: "0x0000000000000000000000000000000000000000"    // used as return currency type on bounce back
      }

      steps.push({
        abi: DELEGATOR_ABI,
        address: DELEGATOR_ADD,
        args: [CReserveTransfer],
        gasLimitFloor: maxGas,
        method: 'sendTransfer',
        overrides: { value: new BN(toWei(ETH_FEES.ETH, 'ether')).toString() },
        type: 'nft'
      });

      if (steps.length > 1) {
        setAlert({
          message: `${walletNameAtStart(connectedWallet)} will now pop up to allow the Verus Bridge Contract to transfer (${nft.name}) from your wallet.`,
          severity: 'warning'
        });
      }

      await runGuardedOperation({
        onPending: ({ hash }) => setAlert({
          href: getEthereumTransactionUrl(hash), message: MESSAGES.waitingForConfirmation, severity: 'info'
        }),
        onSlow: ({ hash }) => setAlert({
          href: getEthereumTransactionUrl(hash), message: MESSAGES.notConfirmed, severity: 'warning'
        }),
        runtime,
        session: getWalletSession(),
        steps
      });

      setAlert({ message: `Your NFT transfer is confirmed on ${ETHEREUM_BLOCKCHAIN_NAME}.`, severity: 'success' });
    } catch (error) {
      setAlert(describeOperationError(error, { failureMessage: NFT_FAILED_MESSAGE }));
    } finally {
      setIsTxPending(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)}>
        {alert &&
          <Alert severity={alert.severity} sx={{ mb: 3 }}>
            <Typography>
              {alert.message}
              {alert.href ? (
                <>
                  {' '}
                  <a href={alert.href} rel="noopener noreferrer" target="_blank">View on Etherscan</a>
                </>
              ) : null}
            </Typography>
          </Alert>
        }
        {account ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography>
              {poolAvailable ? "Bridge.veth currency Launched." : "Bridge.veth currency not launched."}
            </Typography>
            <Typography>
              Last Confirmed Verus height: <b>{verusChainHeight > 1 ? verusChainHeight : "-"}</b>
            </Typography>
          </Alert>
        ) :
          (<Alert severity="info" sx={{ mb: 3 }}>
            <Typography>
              <b>Wallet not connected</b>
            </Typography>
          </Alert>)
        }
        <Grid container spacing={3}>
          <Grid size={12}>
            <AddressField
              addressResolutionError={addressResolutionError}
              addressResolutionMessage={addressResolutionMessage}
              control={control}
            />
          </Grid>
          <Grid size={12}>
            <NFTField
              control={control}
              poolAvailable={poolAvailable}
            />
          </Grid>
          { /* eslint-disable-next-line */}
          {(parseInt(selectedToken?.flags & FLAGS.MAPPING_ERC1155_ERC_DEFINITION) == FLAGS.MAPPING_ERC1155_ERC_DEFINITION) && (
            <Grid size={12}>
              <NFTAmountField
                control={control}
                selectedToken={selectedToken}
              />
            </Grid>
          )}
          <Box mt="30px" textAlign="center" width="100%">
            <Button
              color="primary"
              disabled={
                !resolvedAddress
                || isAddressResolving
                || Boolean(addressResolutionError)
                || !selectedToken?.value
                || !isExpectedWalletChain(chainId)
              }
              loading={isTxPending}
              type="submit"
              variant="contained"
            >
              Send
            </Button>
          </Box>
        </Grid>
      </form>
    </>
  );
}
