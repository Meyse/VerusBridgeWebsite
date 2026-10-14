// A scripted Ethereum chain for tests (plan 8.4). The provider is a real ethers
// 5.8 StaticJsonRpcProvider; only its JSON-RPC `send` answers from memory. So
// tests run ethers' own polling and replacement detection.
import { BigNumber, providers, utils } from 'ethers';

const hex = (value) => BigNumber.from(value).toHexString().replace(/^0x0+(?=[0-9a-f])/, '0x');
const ZERO_HASH = `0x${'00'.repeat(32)}`;
const blockHash = (number) => utils.keccak256(utils.toUtf8Bytes(`block-${number}`));

export const createScriptedChain = ({ chainId, startBlock = 100, code = '0x6000' }) => {
  const blocks = new Map();
  const transactions = new Map();
  const receipts = new Map();
  const minedNonces = new Map();
  let height = startBlock;

  const addBlock = (number, entries) => {
    blocks.set(number, { entries, number });
  };

  for (let number = 0; number <= startBlock; number += 1) {
    addBlock(number, []);
  }

  const txJson = (entry) => {
    const { parsed } = entry;
    return {
      blockHash: entry.blockNumber == null ? null : blockHash(entry.blockNumber),
      blockNumber: entry.blockNumber == null ? null : hex(entry.blockNumber),
      chainId: hex(parsed.chainId),
      from: parsed.from,
      gas: hex(parsed.gasLimit),
      gasPrice: hex(parsed.gasPrice || 0),
      hash: parsed.hash,
      input: parsed.data,
      nonce: hex(parsed.nonce),
      r: parsed.r,
      s: parsed.s,
      to: parsed.to,
      transactionIndex: entry.blockNumber == null ? null : hex(entry.index),
      type: '0x0',
      v: hex(parsed.v),
      value: hex(parsed.value)
    };
  };

  const blockJson = (number, withTransactions) => {
    const block = blocks.get(number);
    if (!block) {
      return null;
    }

    return {
      baseFeePerGas: null,
      difficulty: '0x0',
      extraData: '0x',
      gasLimit: hex(30000000),
      gasUsed: '0x0',
      hash: blockHash(number),
      miner: '0x0000000000000000000000000000000000000000',
      nonce: '0x0000000000000000',
      number: hex(number),
      parentHash: number === 0 ? ZERO_HASH : blockHash(number - 1),
      timestamp: hex(1700000000 + number * 12),
      transactions: block.entries.map((entry) => (withTransactions ? txJson(entry) : entry.parsed.hash))
    };
  };

  // Adds a signed transaction that the network knows but has not mined.
  const addPending = (raw) => {
    const parsed = utils.parseTransaction(raw);
    if (!transactions.has(parsed.hash)) {
      transactions.set(parsed.hash, { blockNumber: null, index: null, parsed, raw });
    }
    return parsed.hash;
  };

  // Mines a new block with these signed transactions.
  const mine = (items = []) => {
    height += 1;
    const entries = items.map((item, index) => {
      const raw = typeof item === 'string' ? item : item.raw;
      const status = typeof item === 'string' ? 1 : (item.status ?? 1);
      const gasUsed = typeof item === 'string' ? 21000 : (item.gasUsed ?? 21000);
      const hash = addPending(raw);
      const entry = transactions.get(hash);
      entry.blockNumber = height;
      entry.index = index;
      const from = entry.parsed.from.toLowerCase();
      minedNonces.set(from, Math.max(minedNonces.get(from) || 0, entry.parsed.nonce + 1));
      receipts.set(hash, {
        blockHash: blockHash(height),
        blockNumber: hex(height),
        contractAddress: null,
        cumulativeGasUsed: hex(gasUsed),
        effectiveGasPrice: hex(entry.parsed.gasPrice || 0),
        from: entry.parsed.from,
        gasUsed: hex(gasUsed),
        logs: [],
        logsBloom: `0x${'00'.repeat(256)}`,
        status: status ? '0x1' : '0x0',
        to: entry.parsed.to,
        transactionHash: hash,
        transactionIndex: hex(index),
        type: '0x0'
      });
      return entry;
    });
    addBlock(height, entries);
    return height;
  };

  // Forgets a transaction, as an RPC node does after a replacement.
  const forget = (hash) => {
    transactions.delete(hash);
  };

  const rpc = async (method, params = []) => {
    switch (method) {
      case 'eth_chainId':
        return hex(chainId);
      case 'net_version':
        return String(chainId);
      case 'eth_blockNumber':
        return hex(height);
      case 'eth_getCode':
        return code;
      case 'eth_gasPrice':
        return hex(1000000000);
      case 'eth_estimateGas':
        return hex(300000);
      case 'eth_getTransactionCount': {
        const mined = minedNonces.get(String(params[0]).toLowerCase()) || 0;
        if (params[1] !== 'pending') {
          return hex(mined);
        }
        const pending = [...transactions.values()].filter((entry) => (
          entry.blockNumber == null && entry.parsed.from.toLowerCase() === String(params[0]).toLowerCase()
        ));
        return hex(mined + pending.length);
      }
      case 'eth_getTransactionByHash': {
        const entry = transactions.get(params[0]);
        return entry ? txJson(entry) : null;
      }
      case 'eth_getTransactionReceipt':
        return receipts.get(params[0]) || null;
      case 'eth_getBlockByNumber': {
        const number = params[0] === 'latest' ? height : BigNumber.from(params[0]).toNumber();
        return blockJson(number, Boolean(params[1]));
      }
      case 'eth_sendRawTransaction':
        return addPending(params[0]);
      default:
        throw new Error(`Scripted chain does not answer ${method}`);
    }
  };

  class ScriptedProvider extends providers.StaticJsonRpcProvider {
    send(method, params) {
      return rpc(method, params);
    }
  }

  const provider = new ScriptedProvider('http://scripted.invalid', { chainId, name: 'scripted' });
  provider.pollingInterval = 20;

  return {
    addPending,
    forget,
    getHeight: () => height,
    mine,
    provider,
    rpc
  };
};
