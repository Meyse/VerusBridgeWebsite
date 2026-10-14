# Brave Wallet Support: Implementation Plan

Date: 2026-10-13

Base: `main` at `79d6685`

Status: implemented on branch `claude/brave-wallet-eip6963` (2026-10-14), not merged or released. Section 13 lists what the implementation decided or changed. The requirements below are revision 11, unchanged. Revision 11. Codex (`gpt-6-astra`) approved revision 5 after 5 review rounds on 2026-10-13. Revision 6 applied the owner's decision D18 (no wrong-chain risk). The Codex review of revision 6 found a Brave hardware-account case (2.6). Revisions 7 and 8 apply the owner's decision D20 and the other review points. Codex approved revision 8 after 3 more review rounds on 2026-10-13. Revision 9 applies the owner's decision to list only supported wallets (D2). It changes the wallet list and its tests, not the transaction guards. Revision 10 adds the send screens (section 3.2), decisions D21 to D26, work phase S, and their tests, checks, and risks. The owner chose design A and the reload rule on 2026-10-13 (D21, D22). Revision 10 changes how the G6 states reach the user. It does not change the guards. Codex reviewed revisions 9 and 10 together in four rounds on 2026-10-13. Revision 11 applies those reviews: approval outcomes (T7, C1, rule 8), one error classifier (D23), the screen selection order, the notice lifecycle, the routing and history rules, the records store flags, and the stored fields. Codex approved revision 11 on 2026-10-13.

Audience: an agent or developer who implements or reviews this work. The plan is self-contained:

- Section 2 gives the evidence.
- Section 3 gives the approved UI, including the send screens (3.2).
- Section 4 gives the decisions.
- Section 5 gives the transaction safety guards.
- Sections 6 to 10 give the work, the tests, and the acceptance criteria.

## 1. Goal

Observable outcome after this work:

1. In Brave with a Brave Wallet, a user can connect, reconnect after a reload, switch network, sign the refund-address message, and send a bridge transaction.
2. The Connect wallet menu lists only the supported wallets, MetaMask and Brave Wallet, when they announce themselves with EIP-6963, by name and icon (D2). The user picks one. Other wallets never appear, so a user cannot connect a wallet that cannot send. A line under the list says which wallets work.
3. MetaMask in Chrome works as it does today.
4. User-facing messages name the connected wallet. They do not say "MetaMask" for every wallet.
5. **No wallet sends a bridge transaction on the wrong network, except in one narrow case that the owner accepted (D20).** For one reviewed transfer, every wallet gets the same request: the same `to`, `from`, `data`, `value`, and `chainId`. Only two wallets can send. Each uses a send path whose network check is shown in the wallet's source (D18, G4):
   - **Path E, enforced network** (MetaMask, `rdns` `io.metamask`): the request carries `chainId`. MetaMask rejects a request whose `chainId` differs from its network (2.6).
   - **Path S, sign and check** (Brave Wallet, `rdns` `com.brave.wallet`): the wallet only signs. The site decodes the signed transaction and checks its network, account, nonce, and fields. Only then does the site broadcast it through its own Ethereum RPC. If anything differs, the site discards it, and nothing reaches the network.
   - **Brave hardware accounts (D20).** For a Ledger or Trezor account, Brave broadcasts the transaction when it signs (2.6). The site cannot check it first. Brave reads the network when it receives the request, directly after the site's last network check. The site warns at once if the network changes while the request is open (G4).
   - **Every other wallet** does not appear in the menu (D2), so the site never connects to it.

   If the site observes a change of wallet session, account, or network before it asks the wallet, or cannot confirm the refund key, it stops with no wallet write. The site reports a transfer as successful only when it finds the transaction on the expected chain, with the expected fields, and with a successful receipt (G6).
6. **After the user presses Confirm, the card always shows what is happening and what the result is** (D21). One status card replaces the Review content. It shows a wait screen, then a result screen. It says "Sent" only after a successful receipt (G6). Every failure has its own screen or notice with a next action. A reload reopens the result screen of a transfer that is not resolved (D22). Section 3.2 gives the full list.

Out of scope:

- WalletConnect, QR codes, and mobile deep links.
- A migration to wagmi, viem, ethers 6, or a newer web3-react.
- Changes to bridge routes, fees, or contract calls. The guards in section 5 only add checks around the existing calls.
- General smart-account support. Guard G1 blocks smart accounts on routes that need a refund key. This plan does not claim that smart accounts work on other routes.
- Brave on iOS. It uses a different provider script. Check it in a follow-up.
- Send screens for the claim and NFT flows. They keep their alert and toast UI. They use the same records and outcomes (G6). A follow-up can give them the 3.2 screens.
- A fix for the fixed gas limits in the bridge calls (risk 22). That is a change to the contract calls.

## 2. Background and evidence

### 2.1 Current wallet path

- The site uses `@web3-react/core` 6.1.9 and `@web3-react/injected-connector` 6.0.7 (`src/connectors/injectedConnector.js`). The connector only uses `window.ethereum`. It uses the legacy `send` and `enable` methods. The package is from 2020 and has no maintenance.
- App code also reads `window.ethereum` directly:
  - `src/hooks/useInactiveListener.js` (event listeners)
  - `src/components/SiteHeader.jsx:289` (network switch)
  - `src/utils/refundAddress.js:132-136` (`personal_sign`)
- The header menu (`WALLET_OPTIONS`, `src/components/SiteHeader.jsx:144`) has one fixed MetaMask entry.
- The card button (`Connect your wallet`, `src/components/BridgeCard.jsx:1052`) calls `controller.connectWallet()`, which activates the injected connector at once (`src/hooks/useBridgeController.js:2580`). It does not open the menu.

### 2.2 The Brave bug

- Issue: [brave/brave-browser#58890](https://github.com/brave/brave-browser/issues/58890). Fix PR: [brave/brave-core#40625](https://github.com/brave/brave-core/pull/40625). On 2026-10-13 both were open, with no milestone. A Brave maintainer wrote that Brave locks these properties on purpose, for security. Do not plan on a Brave fix.
- Cause: when a Brave Wallet exists, Brave's dapp-metrics script (`components/misc_metrics/resources/web3_metrics_install_proxy.js`) wraps `window.ethereum` in a Proxy. Its `get` trap returns a new wrapper for every value. Brave Wallet defines `on`, `emit`, `removeListener`, and `removeAllListeners` as non-writable and non-configurable (`components/brave_wallet/resources/ethereum_provider.js`). A Proxy must return the real value for such a property. So every read of `window.ethereum.on` throws a `TypeError`.
- `InjectedConnector.activate()` reads `window.ethereum.on`. So Connect wallet fails in Brave with a Brave Wallet. Commit `079cf84` already guards `useInactiveListener`, so the page no longer goes blank. Connect and auto-reconnect still fail.
- Since Brave 1.96, Brave injects its provider only after the user creates a Brave Wallet. A Brave profile with no wallet has no `window.ethereum`.

### 2.3 The safe path

Source: `components/brave_wallet/renderer/js_ethereum_provider.cc` in brave-core.

- Brave also sets `window.braveEthereum`. This is a separate, non-configurable window property. The metrics script only wraps `ethereum`, `solana`, `cardano`, and `web3`, so `window.braveEthereum` has no metrics wrapper.
- Brave announces its wallet with EIP-6963. The event detail is `info: { rdns: 'com.brave.wallet', uuid, name, icon }` and `provider: window.braveEthereum`.
- Brave sends the announcement at `DidFinishLoad` (window `load`). Brave adds its `eip6963:requestProvider` listener only at that point. A request sent before `load` gets no Brave answer, but Brave still announces once at `load`.
- The `uuid` is random for each page load. EIP-6963 says `rdns` is self-attested, so another extension can copy it.
- A Node replica of Brave's install order, with Brave's real proxy code, gave these results: `window.ethereum.on` throws; `.on` on `window.braveEthereum` works; `.on` on the EIP-6963 provider works; `request` works on all paths. This is a simulation, not a test in a real Brave.

### 2.4 Brave Wallet supports every call the site makes

From brave-core source: `eth_requestAccounts`, `eth_accounts`, `eth_chainId`, legacy `send(string)`, `enable`, `personal_sign`, `eth_sendTransaction`, and `wallet_switchEthereumChain`. Brave knows chain 1 (Ethereum) and chain 11155111 (Sepolia), so the site never needs `wallet_addEthereumChain`.

Brave's provider also returns `isMetaMask: true`. Do not use `isMetaMask` to identify a wallet.

### 2.5 web3-react 6 behaviour that matters here

From `@web3-react/core` 6.1.9 (`dist/core.esm.js`):

- `activate(connector)` without `throwErrors`: on an error, the state keeps `connector` and sets `error`, and the promise resolves. A resolved promise does not mean success.
- On an `UnsupportedChainIdError`, `library` is `undefined`, because the state is not active.
- `activate(connector, undefined, true)` (eager connect): on an error, the connector is deactivated and the error is thrown. `useEagerConnect` then calls `setError`, so the state has no connector.
- `Web3ConnectionProvider.jsx:15` activates the read-only `networkConnector` when no wallet is connected. That connector must never be used for wallet calls.

### 2.6 How the bridge transaction is built

- The site builds every field of the bridge call itself. `getConfigOptions` (`src/utils/txConfig.js`) builds the reserve transfer. `delegatorContract.sendTransfer(reserveTransfer, { from, gasLimit, value })` (`src/hooks/useBridgeController.js:2361`) sends it through the ethers 5 `JsonRpcSigner` as `eth_sendTransaction`.
- The wallet only adds or changes gas, fee, and nonce values. Some wallets let the user edit those values, or edit an ERC-20 approval amount.
- The current send has no `chainId` field. In ethers 5.8, a `chainId` in contract-call overrides throws. `contract.populateTransaction.<method>(...)` followed by `signer.sendTransaction({ ...tx, chainId })` keeps the calldata and sends the `chainId` (checked by Codex with a local ethers run).
- Wallets treat `chainId` differently. Brave Wallet ignores it and uses the network that is set for the site (brave-core `components/brave_wallet/browser/ethereum_provider_impl.cc:324`). Brave rejects a `from` address that is not an allowed account. MetaMask rejects a `chainId` that differs from its network: `validateParamChainId` throws "Invalid transaction params: chainId must match the network client" (MetaMask/core `packages/transaction-controller/src/utils/validation.ts:357`, called from `validateTxParams` at line 122).
- Brave Wallet supports `eth_signTransaction` (`kEthSignTransaction` in `ethereum_provider_impl.cc`). Brave dispatches each request to its handler synchronously (`ethereum_provider_impl.cc:1164`). The send and sign handler reads the site's network at once and puts it into the transaction (`ethereum_provider_impl.cc:297`, `:324`). For a sign-only request from a normal (software) account, Brave sets the status to `Signed` and does not publish the transaction (`components/brave_wallet/browser/eth_tx_manager.cc:660`). It returns the signed raw transaction to the site (`ethereum_provider_impl.cc:1525`). MetaMask does not support `eth_signTransaction`.
- **Brave hardware accounts publish on sign.** For a Ledger or Trezor account, Brave's wallet UI calls `processEthHardwareSignature` (`components/brave_wallet_ui/common/async/hardware.ts`). `EthTxManager::ProcessEthHardwareSignature` (`eth_tx_manager.cc:532`) calls `PublishTransaction` and does not check `sign_only`. The site then gets the transaction hash (status `Submitted`), not the raw transaction (`ethereum_provider_impl.cc:1525`). Brave does not tell the site the account type before the request. The Codex review found this on 2026-10-13, and a check of the brave-core `master` source confirmed it. It was not tested with a real device.
- Brave picks the next nonce from the network count, its confirmed transactions, and its submitted transactions (`components/brave_wallet/browser/nonce_tracker.cc:24`). It does not count signed-only transactions. So a signed transaction that the site discards does not reserve a nonce.
- The site's signer is `library.getSigner(account).connectUnchecked()` (`src/utils/contract.js:16`). In ethers 5.8.0, its response `wait()` calls `provider.waitForTransaction(hash)`. That path has no replacement tracking and does not reject a receipt with `status === 0`. The checked path, `provider._wrapTransaction(tx, hash, startBlock).wait()`, calls `_waitForTransaction` with the sender, nonce, `to`, `data`, and `value`. It reports replacements as `TRANSACTION_REPLACED` with `reason` `repriced`, `cancelled`, or `replaced`, and rejects `status === 0` (`@ethersproject/providers/lib.esm/base-provider.js:1088`, `:1330`).

### 2.7 Wallet-dependent risks found in review

1. **Refund key.** On bounce-back routes to an Ethereum address, the site asks for `personal_sign` over a fixed message (`src/utils/refundAddress.js`). It recovers a public key from the signature, derives a Verus R-address (hash160 of the compressed key, version 60), and caches it in `localStorage` (`pubkeyAddress`). `txConfig.js:37` embeds that address in the transfer as `auxDest`. The claim page uses the public key for `sendfees` (`src/hooks/useClaimController.js:491`). **No code checks that the recovered key belongs to the connected account.** A signature from another key, or a signature over the hex text instead of the message bytes, still recovers a key. The site then embeds a refund address that the user cannot spend. Smart-account wallets can return such signatures.
2. **Cached refund addresses.** The cache stores only the address. `useBridgeController.js:2050` skips signing when a cached address exists. A wrong address stays in use.
3. **Changing context during a transfer.** The submit flow waits for a signature, a name lookup, an approval, and the approval receipt. During those waits, the user can change account, network, or wallet. `assertBridgeTransactionContext` (`src/utils/walletNetwork.js:60`) checks the chain and the bridge code, but not the account or the wallet session.
4. **Edited approvals.** After an ERC-20 approval, the site does not read the allowance back.
5. **Timeout before confirmation.** `useBridgeController.js:2355` starts a 240 s timer before the wallet confirms. On timeout, the site shows an error and clears the pending state. The user can then send the transfer a second time, although the first one can still confirm. The pending state is local React state (`useBridgeController.js:1076`), so a reload also loses it.
6. **Review identity.** The review snapshot (`useBridgeController.js:1144`) includes the account and the chain, but not the wallet provider.

### 2.8 The send flow today

- While a send runs, the Confirm button shows a spinner and the label "Submitting..." (`useBridgeController.js:2564`, `BridgeCard.jsx:1178`). Nothing tells the user to act in the wallet.
- An ERC-20 send opens the wallet twice, once for the approval and once for the transfer. The site shows three alert messages in turn (`useBridgeController.js:2192`, `:2222`, `:2229`).
- The wallet asks for the amount plus the bridge fee. `metaMaskFee` adds `ETH_FEES.ETH` to the amount, and adds the gateway fee on bounce-back routes (`useBridgeController.js:2325` to `:2335`). Review shows the parts. A user can think that the wallet asks for the wrong amount.
- `handleSubmit` waits for `txResult.wait()`. Then it shows the toast "Bridge transaction submitted successfully." (`useBridgeController.js:2368`, `:2369`). The Review screen stays, and Confirm works again. A user can send the same transfer twice.
- The toast also appears for a reverted transaction (2.6: the unchecked `wait()` does not reject `status === 0`). A diagnosis on 2026-10-13 found this on a Sepolia send that ran out of gas.
- Errors reach the user as toasts with the raw `error.message` (`useBridgeController.js:2372`). The 240 s timeout shows "Transaction timeout exceeded." as an error (`:2357`), although the transaction can still confirm.
- The Activity page (`src/pages/BridgeActivity.jsx`) is a public feed of bridge exports and notarizations. It has no filter for the connected account and no lookup by transaction hash. It cannot show the status of one transfer.
- The review route is `?step=review`. Without a review snapshot, `BridgeHomePage.jsx` navigates away from it (near line 110). So a reload returns to the form.

## 3. Approved UI

### 3.1 Wallet picker and guard messages

The owner reviewed a clickable preview: [Bridge Wallet Picker](https://claude.ai/artifact/1t2Xxwd78SKcKk1Le9KCJq). The preview was updated for revision 9 (supported wallets only). The link is private, so it may not open for you. The text below is the full description.

Keep the current header, menu, and card styles. Reuse the `walletOption*`, `dropdown*`, `connectedButton`, and `networkNotice` classes in `src/styles/ReferenceBridge.module.css`.

1. **Wallet list.** Connect wallet opens the existing dropdown. It shows one row for each detected supported wallet (D2), so at most MetaMask and Brave Wallet. Each row has the wallet's announced icon in the existing 40 px icon tile (icon at 28 px) and the announced name. Under the rows, one muted line: "Works with MetaMask and Brave Wallet."
2. **Icon fallback.** If a supported wallet announces an icon that the site cannot use (D11), its tile is plain gray, with no icon and no glyph. The owner rejected a generic wallet icon.
3. **Waiting for approval.** After a click, the chosen row shows a second line, "Confirm in {wallet name}", and a small spinner at the right. The other rows are dimmed and disabled. The menu stays open until the wallet answers.
4. **No supported wallet.** When discovery is settled and no supported wallet is found, the dropdown shows "No supported wallet found" and one line: "The bridge works with MetaMask and Brave Wallet. Install one of them, then reload this page." It shows no rows. Other installed wallets, for example Coinbase Wallet, are not named.
5. **Connected.** The header button shows the wallet icon (18 px, 5 px radius) before the short address. The menu header label changes from "Connected wallet" to "Connected with {wallet name}", with a 14 px icon. The menu actions stay the same: View on Etherscan and Disconnect.
6. **Card button.** "Connect your wallet" in the bridge card opens the same header dropdown. It does not connect directly.
7. **Wrong network.** The header looks the same as today. Messages name the wallet (step C4).

The safety guards add these messages. They were not in the preview. Show them in the existing alert or toast for that flow.

| Case | Message |
|---|---|
| G1: recovered key does not match the account | {Wallet} did not sign with this account's key. The bridge cannot create a refund address for this account. |
| G3: session, account, or network changed | Your wallet, account, or network changed. Review the transfer again. |
| G3: another tab is sending | A transfer from this account is in progress in another tab. Finish it there first. |
| G3: browser cannot lock across tabs | This browser cannot stop two tabs from sending at once, so the bridge cannot send. Update your browser, then try again. |
| G5: allowance too low | The approved amount is lower than the transfer amount. Approve the full amount to continue. |
| D4: wallet cannot report changes | {Wallet} does not report account or network changes, so the bridge cannot use it. |
| G6: sent, not confirmed yet | Transaction sent. Waiting for confirmation. (with the explorer link) |
| G6: no confirmation after the timeout | No confirmation yet. The transfer can still go through. (with the explorer link and a "Check again" button) |
| G6: not found on the expected chain | This transaction is not on Ethereum yet. Check the network in your wallet's activity. |
| G6: transaction reverted | The transaction failed on Ethereum. Your funds were not bridged. |
| G6: replaced by a different transaction | Your wallet replaced this transaction with a different one. Check the replacement before you send again. (with the explorer link to the replacement) |
| G6: pending transaction differs from the review | The transaction differs from the reviewed transfer. Check its details in your wallet before you continue. |
| G6: storage unavailable before dispatch | This browser does not let the site save data, so the bridge cannot protect you from sending twice. Allow site data for this site, then try again. |
| G6: interrupted before the hash arrived | A transfer was started, but the site did not get its transaction from your wallet. Check your wallet's activity before you send again. (with possible matches as links, and "Clear after checking my wallet") |
| G6: confirmed, but not the reviewed transaction | A different transaction than the one you reviewed was confirmed. Check it before you continue. (with the explorer link) |
| G4: wallet has no send path (D18; a defensive check, see D2) | The bridge can send only with MetaMask or Brave Wallet. Connect one of them to send. |
| G4: wallet does not support the request | {Wallet} does not support this request. Update {wallet}, then try again. |
| G4: path S, signed for another network | {Wallet} signed for another network. Nothing was sent. Switch {wallet} to Ethereum, then try again. |
| G4: path S, transaction changed | {Wallet} changed the transaction. Nothing was sent. |
| G4: path S, earlier transaction not confirmed | This account has a transaction that is not confirmed yet. Nothing was sent. Wait until it confirms, then try again. |
| G4: path S, nonce disagreement | {Wallet} and the bridge do not agree on the next transaction number. Nothing was sent. Wait a minute, then try again. |
| G4: path S, network changed while the request was open (D20) | The network in {wallet} changed while the request was open. Reject the request in {wallet}, then start again. |
| G6: send blocked by an unresolved transfer | A transfer from this account is not confirmed yet. Wait for it, or check it again. |
| G6: override action | Button: "Send another transfer anyway". Confirmation text: "If the first transfer still goes through, you will bridge twice." |

### 3.2 Send screens

The owner chose design A ("Receipt") on 2026-10-13 after comparing three designs. The owner also reviewed the full state list in a clickable preview: [Bridge Send States](https://claude.ai/artifact/3hpu2geTsnxakK8KhHStBD). The link is private, so it may not open for you. The text below is the full description. Sample values in the text (`0.005 ETH`, `RDJZ59o6…BtAi7`, `0x3f9a…c21e`) come from the ptestbridge review screen. They are examples.

**Rules**

1. **One frame.** After the user presses Confirm, one status card replaces the Review content. It shows the wait, the result, and every error after the wallet request. The user never sees a live Confirm button for a transfer in flight.
2. **Where a state shows.** If nothing was sent, the user stays on Review, or returns to the form when the review closes. A notice appears above the main button, and the button label becomes the next action (N1 to N9 and the X-notices). If a transaction exists, or can exist, a result screen replaces Review (T1 to T7).
3. **What proves "nothing was sent".** Only these do: a rejection (`4001`), an unsupported-request error (`4200`, `-32601`), a failed check before the request, and a G4 discard. Any other error after the request leaves the record open (G6). It shows T6 or T3, never a "nothing was sent" message (D23). These facts are about one request. After a confirmed approval, the approval was sent, so rule 8 applies.
4. **"Sent" is rare.** The word "Sent" appears only on T2. T2 needs a record of type `transfer` with the G6 outcome `success`. An approval that succeeds never shows T2. It shows T7, or the next wallet step.
5. **No Cancel.** The wallet screens (W1 to W3) have no Cancel button. The site cannot cancel an open wallet request. If the site returned to Review, the user could still confirm the open request, and the site would not track it. Rejecting in the wallet ends the wait (N1).
6. **Copy names the wallet** (D12). `{wallet}` is the message name. `{Wallet}` is the same name at the start of a sentence. `{chain}` is `ETHEREUM_BLOCKCHAIN_NAME` (Sepolia on test builds).
7. **Money words.** A screen says "funds were not bridged", not "nothing was sent", when a fee was spent (T4).
8. **Approval history.** The flow keeps the id of its approval record. After the approval succeeded, every stop of the transfer says "The transfer was not sent. The approval stays in place." in place of "Nothing was sent." This covers a rejection, a failed check, a G3 invalidation, a G4 discard, and a G5 failure. T4, T5, and T6 after an approval add the sentence "The approval stays in place."

**When W1 appears.** Confirm shows the existing button spinner, with the label "Checking…", while the G3 checks run. W1 (or W2) appears when the request is dispatched, that is, when the `awaiting-wallet` record is written (G3 step 6). A failed check returns the user to Review with a notice. The user never sees W1 appear and vanish.

**Screen selection.** `getSendScreen` (S1) checks these in order and returns the first match. Its input is the flow of this document and the newest record that belongs to it, or the record that D22 selected after a restore. The order settles every conflict between a record and the live flow.

1. No record and no live flow: no screen.
2. A record resolved as `user-cleared`: no screen, whatever its origin. A record that was already resolved when the records store restored it (an earlier load): no screen. A record that belongs to the flow of this document, or that was unresolved when the store restored it (`restoredUnresolvedIds`, A5), keeps its screen after it resolves, until the user leaves the screen. A rerender or a remount never removes it. Dismissal stops only the automatic reopening. A browser Forward or a direct `?step=status` shows the selected screen.
3. A record with the `mismatch` flag and no outcome: X15.
4. Outcome `confirmed-unexpected`: X16.
5. Outcome `success`: T2 for type `transfer`. For type `erc20-approval`: C1 while the live flow runs the G5 check and the transfer's G3 checks. When the live flow stops after the approval, no screen: the form or Review shows the notice of the stop (rule 8). T7 when no live flow exists (a restored approval that was pending and then succeeds).
6. Outcome `reverted`: T4. Outcome `cancelled` or `replaced`: T5.
7. Outcome `rejected` or `discarded`: no screen. A `rejected` outcome with reason `user` gives N1, and with reason `unsupported` gives X9. A `discarded` outcome gives the notice of its G4 reason: X10 (chain), X11 (fields), X12 (earlier transaction), X13 (nonce), N9 (another record holds the nonce), or X17 (latch).
8. A record in state `awaiting-wallet`: W1 or W2 while this tab holds the live request, and W3 when the G4 latch is set. Without a live request (restored after a reload, or the request ended with an unknown error): T6.
9. A record with a hash and no outcome. If the path-S broadcast failed or got no answer (flow state `broadcastFailed`, from `onBroadcastFailure`): T3 at once. If the RPC has never returned the transaction and the record holds no raw transaction, after the 240 s timer or after a restore: X14. T3 in the same timing cases when the RPC returned the transaction, or when the record holds a raw transaction. T1 before that.

A missing RPC result is not proof of another network, so X14 only asks the user to check the wallet. W1 and W2 come only from the record of the request that is open now. For a token send, W1 (step 2 of 2) shows when the transfer's own `awaiting-wallet` record is written, never from the approval record.

**Frame and style.** Reuse the existing classes and tokens. Put the new styles in `src/styles/SendStatus.module.css`.

| Part | Spec |
|---|---|
| Card | The `bridgeCard` shell: 464 px maximum width, 8 px padding, 24 px radius, the existing shadow. Children are 8 px apart. |
| Hero section | Like `cardSection`: `--theme-surface-strong`, 1 px `--theme-border`, 20 px radius. Padding 34 px 16 px 30 px. A centered column with 18 px gap. |
| Mark | 72 px, at the top of the hero. See "Status mark". |
| Title | 28 px, line height 1.1, weight 600, letter spacing -0.03em, `--theme-text-strong`, `text-wrap: balance`. |
| Body | 15 px, `--theme-text-muted`, tabular numbers, `text-wrap: balance`, 40 characters maximum width. 6 px below the title. |
| Details panel | The `reviewDetails` class: `--theme-surface-muted`, 18 px radius, 16 px padding, 12 px between rows. Label 14 px muted, left. Value 14 px, weight 600, tabular numbers, right. A link value uses `--theme-link`. |
| Primary action | The `submitButton` class: full width, 20 px radius, 20 px text, weight 500, `--theme-accent`. A primary action that opens the explorer is an `<a>` with the same class. |
| Quiet action | 14 px, weight 600, `--theme-text-muted`, padding 10 px 14 px, 12 px radius, transparent. On hover: `--theme-text-strong` on `--theme-surface-muted`. |
| Action area | 8 px above the panel, 4 px between actions, centered. It takes its space from the first frame and stays hidden (`visibility`) until the mark has settled. The card does not change height. |
| Notice | A row with a 10 px gap, padding 12 px 14 px, 16 px radius, 14 px text, line height 1.4. An 18 px icon at the left. The title has weight 650 on the first line. The body follows below. It sits directly above the Confirm button, 8 px away. |
| Notice tones | Info: `--theme-accent-soft` background, `--theme-accent-text`. Warning: `--theme-warning-bg`, `--theme-warning-text`. Danger: `--theme-danger-bg`, `--theme-danger-text`. |

New tokens for `src/index.css`, in both themes:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--theme-success-solid` | `#15803d` | `#15803d` | Mark disc and ring for T2 |
| `--theme-warning-solid` | `#b45309` | `#b45309` | Mark disc and ring for T3, T5, T6, T7, W3, X14, X15, X16 |
| `--theme-danger-solid` | `#dc2626` | `#dc2626` | Mark disc and ring for T4 |
| `--theme-link` | `#2b5cc2` | `#8ab0ff` | Link values and the explorer links |
| `--theme-accent-bright` | `#3165d4` | `#4f7fff` | Spinner arc, wallet pulse, progress bar |
| `--theme-track` | `rgba(148, 163, 184, 0.28)` | `rgba(124, 144, 178, 0.28)` | Spinner track, wallet tile, empty progress segment |

White glyphs on the solid tones keep a contrast of at least 4.5 to 1.

**Status mark.** An SVG with `viewBox="0 0 72 72"`, centered circles with radius 32 and stroke width 4.

- *Pending (T1).* A track circle in `--theme-track`. An arc over it: dash `50 151.06`, round caps, `--theme-accent-bright`, rotating once per second, linear, without end.
- *Settle.* Runs once, when a live result arrives. Times start at the arrival of the result:
  - 0 ms: the arc and the track fade out (150 ms).
  - 80 ms: a ring in the tone color draws from the top, clockwise (450 ms, `cubic-bezier(0.4, 0, 0.2, 1)`).
  - 400 ms: a disc in the tone color grows from scale 0 to 1 (340 ms, `cubic-bezier(0.34, 1.56, 0.64, 1)`).
  - 420 ms: one ripple. A 2 px ring in the tone color grows from scale 1 to 1.8 and fades from 0.5 to 0 (900 ms, ease-out).
  - 560 ms: the glyph draws (320 ms, ease-out). The glyph is white, stroke 5.2, round caps and joins.
  - The old title and body fade out and move up 8 px (160 ms). The new text fades in from 8 px below (220 ms, after a 240 ms delay).
  - The action area fades in and rises 8 px (320 ms, after a 720 ms delay).
- *Glyph paths* (in the 72 unit box): check `M22.5 37.5l9.5 9.5 18-20`. Cross `M27 27l18 18` and `M45 27L27 45`. Clock `M36 22.5V37l9.5 6`. Exclamation `M36 23.5v15` and `M36 48.5v.1`. The glyph for each screen: check for T2, clock for T3 and X14, cross for T4, exclamation for T5, T6, T7, W3, X15, and X16. C1 and T1 show the spinner only.
- *Wallet mark (W1, W2).* A circle tile in `--theme-track`, with the wallet's icon at 40 px in the middle (D11). A wallet without a usable icon shows the tile alone, with no glyph (3.1, icon fallback). Two rings pulse outward: 2 px `--theme-accent-bright`, scale 1 to 1.55, opacity 0.45 to 0, 2.4 s, ease-out, repeating. The second ring starts 1.2 s later.
- *Restored screens* (D22) render in their settled state, with no animation.
- *Reduced motion.* With `prefers-reduced-motion: reduce`, the spinner becomes a static arc, the pulse stops, and all transitions are instant. The text "Confirming…" still shows the state.

**Wallet screens**

| ID | Title | Body | Rows | Source |
|---|---|---|---|---|
| W1 | Confirm in {wallet} | Check the {wallet} window and confirm the transaction. | You send `0.005 ETH`<br>Bridge fee `0.0030 ETH`<br>Total in {wallet} `0.0080 ETH` | Record `awaiting-wallet`, type `transfer`. Both paths. For a token send after the approval, the body starts with "Step 2 of 2." and the progress bar fills both segments. |
| W2 | Allow {symbol} | Step 1 of 2. Let the bridge spend your {symbol}. Below the body: a progress bar of two 28 x 4 px segments, 6 px apart, 2 px radius, the first filled. | Spending cap `5 USDC`<br>Bridge contract `0x2f1c…9a4e` | Record `awaiting-wallet`, type `erc20-approval`. While the approval mines, T1 shows with the body "Step 1 of 2. Waiting for {chain}" and no "Arrives in" row. |
| W3 | Network changed | The network in {wallet} changed while the request was open. Reject the request in {wallet}, then start again. | None. No actions. | The G4 latch for path S (D20), reason `network`: the `eth_chainId` answer differs, or `chainChanged` fired. This card is the blocking dialog that G4 names. Brave Wallet only. |
| W3 | Account changed | The account in {wallet} changed while the request was open. Reject the request in {wallet}, then start again. | None. No actions. | Latch reason `account`: `accountsChanged` fired. |
| W3 | Network not confirmed | {Wallet} did not confirm its network while the request was open. Reject the request in {wallet}, then start again. | None. No actions. | Latch reason `unconfirmed`: the `eth_chainId` answer was rejected, malformed, or late. |
| C1 | Checking… | Step 2 of 2. Checking the transfer. | None. No actions. The mark is the spinner of T1. | Token sends only. The live flow runs the G5 allowance read and the transfer's G3 checks after the approval succeeded. It lasts until the transfer's own `awaiting-wallet` record is written, or until a check fails. |

After a latch, when the wallet answers: a rejection shows N1. A returned hash shows T1 (G4). A returned raw transaction is discarded (G4) and the form shows X17.

Rows for W1: one row for the amount, one row for each fee row of Review (`reviewFeeRows`), and for ETH sends one row "Total in {wallet}". The total is the `value` of the dispatched request, formatted with `formatEthValue` (D25). Token sends show no total row. Rows for W2: the cap is the approval amount and the contract is `DELEGATOR_ADD`, shortened with `formatCompactAddress`.

A hint appears under the rows 15 s after W1 or W2 shows (fade 500 ms, constant `WALLET_HINT_DELAY_MS`): "{Wallet} not showing? Open it from your browser toolbar." It is 13 px, muted, and centered. W1 and W2 have no timeout, because the wallet can still answer. The record, the lock, and the tracking stay in place. After a reload, T6 shows.

**Result screens**

| ID | Title | Body | Rows | Actions | Source |
|---|---|---|---|---|---|
| T1 | Confirming… | Waiting for {chain} | Arrives in `1-6 hours`<br>Destination `RDJZ59o6…BtAi7`<br>Transaction: View on Etherscan | None | Record `signed`, `submitted`, or `observed`, with no outcome and less than 240 s since the hash. On path S the hash exists after signing, so the link can say "not found" until the broadcast lands. "Arrives in" is `reviewTimeEstimate`. |
| T2 | Sent | `0.005 ETH → ~46.58396199 VRSCTEST` (the review snapshot values, with the "~" prefix of Review for estimates) | Arrives in, Destination, Transaction (as T1) | Primary: New transfer<br>Quiet: View bridge activity | Type `transfer` and outcome `success` (G6). Never for an approval (T7). |
| T3 | No confirmation yet | The transfer can still go through. | Waiting for `4 min`<br>Transaction: View on Etherscan | Primary: Check again<br>Quiet: Back to bridge | The record is unresolved 240 s after the hash (G6 step 6). A restored record shows T3 at once (D22). On path S, a broadcast that fails or gets no answer (G4 step 6) also shows T3 at once, so "Check again" is available. "Waiting for" counts whole minutes from `hashAt`. A hash-only record that the RPC never returned shows X14 instead (Screen selection). |
| T4 | Transaction failed | Your funds were not bridged. For a token send after a confirmed approval, add: The approval stays in place. | Fee paid `0.0021 ETH`<br>Transaction: View on Etherscan | Primary: Try again<br>Quiet: Copy details | Outcome `reverted`. The fee is `gasUsed` times `effectiveGasPrice` of the receipt. |
| T5 | Transaction replaced | Your wallet replaced this transaction with a different one. Check the replacement before you send again. | Original `0x3f9a…c21e`<br>Replacement `0x81b2…07d4` | Primary: View replacement (explorer link)<br>Quiet: New transfer | Outcome `cancelled` or `replaced`. |
| T6 | No transaction received | A transfer was started, but the site did not get its transaction from your wallet. Check your wallet's activity before you send again. | Possible matches: up to three explorer links (G6 step 5). Omit the row when there are none. | Primary: Check again<br>Quiet: Clear after checking my wallet | A record in state `awaiting-wallet` without a live request: an error that is not a `rejected` result after dispatch, or a reload. |
| T7 | Approval confirmed | The transfer was not sent. The approval stays in place. | Spending cap `5 USDC` (`confirmedCap`, decoded from the mined approval transaction, not the requested amount)<br>Transaction: View on Etherscan | Primary: Review again<br>Quiet: New transfer | Type `erc20-approval`, outcome `success`, and no live flow of this document: a restored approval that was pending and then succeeds. A stop inside a live flow shows the notice of the stop instead. T7 never starts the transfer. "Review again" opens a fresh Review (`openReview`). A reload after the approval already confirmed shows no screen, because nothing is pending. |

Rows that need a link use `getEthereumTransactionUrl(hash)` (S5). A record without a valid hash has no link row.

**Approval records.** A record of type `erc20-approval` uses the same screens, with these changes:

| Screen | Change |
|---|---|
| T1 | Body: "Step 1 of 2. Waiting for {chain}". No "Arrives in" row. |
| T3 | Body: "The approval can still go through. The transfer was not sent." |
| T4 | Title: "Approval failed". Body: "The transfer was not sent." |
| T5 | Body: "Your wallet replaced this approval with a different transaction. Check the replacement before you send again." |
| T6 | Body: "An approval was started, but the site did not get its transaction from your wallet. Check your wallet's activity before you send again." |

**Other G6 results.** They use the layout of the screen named in the table.

| ID | Title | Body (the G6 message in 3.1) | Layout |
|---|---|---|---|
| X14 | Not on {chain} yet | Check the network in your wallet's activity. | T3. Primary: Check again. |
| X15 | Not the reviewed transfer | The transaction differs from the reviewed transfer. Check its details in your wallet before you continue. | T5, with the pending transaction in the row. Primary: View on Etherscan. Quiet: Back to bridge. |
| X16 | Not the reviewed transfer | A different transaction than the one you reviewed was confirmed. Check it before you continue. | T5. Primary: View on Etherscan. Quiet: New transfer. |

**Notices** (nothing was sent)

| ID | Tone | Title | Body | Button label | Source |
|---|---|---|---|---|---|
| N1 | Info | Cancelled in {wallet} | Nothing was sent. | Confirm | Outcome `rejected`, reason `user` (D23). Also for the approval prompt. |
| N2 | Warning | {Wallet} has an open request | Finish or reject it in {wallet}, then confirm again. | Confirm | **Not in this release** (risk 17). Do not build N2 yet. Error `-32002` ends in T6. |
| N3 | Warning | {Wallet} is on another network | Switch {wallet} to {chain} to continue. | Switch to {chain} | The live `eth_chainId` differs before the request (G3). The button calls `wallet_switchEthereumChain` through the pinned provider (C1). |
| N4 | Warning | Not enough ETH | This transfer needs `0.0080 ETH` plus the network fee. Your wallet has `0.0031 ETH`. | Not enough ETH (disabled) | `hasEnoughNativeEth` is false. The need is the request `value`. The balance is `nativeEthBalanceRaw`. |
| N5 | Warning | {name} now points to a new address | Check the new address before you continue. | Review again | The identity check that exists today (`useBridgeController.js:2281`). `{name}` is the VerusID. |
| N6 | Warning | The bridge is paused | Sends are switched off for now. Nothing was sent. | Bridge paused (disabled) | `isBridgePaused`. |
| N7 | Warning | One more signature needed | {Wallet} signs once so the bridge can refund you if a transfer fails. It costs no gas. | Sign in {wallet} | `ensureRefundAddressSignature()` fails on a bounce-back route. This replaces the alert with `REFUND_SIGNATURE_ALERT_CODE`. The signature is `personal_sign`, so it costs no gas. |
| N8 | Danger | Something went wrong | Nothing was sent. Try again. Under it, a "Details" fold with `error.message` in a monospace line. | Try again | An error before the request is dispatched, for example a failed RPC check. After dispatch, use T6 (D23). |
| N9 | Warning | Earlier transfer not confirmed | A transfer from this account is not confirmed yet. Wait for it, or check it again. | Check again. Under the button, a quiet action: Send another transfer anyway. | The send-blocking rule (G6). The quiet action is not offered when the record holds a raw transaction (path S). |

**Notice lifecycle.** A notice shows on the surface in the table. The main button runs the action in the table. Only `confirm` submits the form. `canConfirmReview` stays the permission to send. It does not control the other actions. A stale review never becomes sendable to keep a notice visible.

| ID | Surface | Review snapshot | Main button runs | Enabled |
|---|---|---|---|---|
| N1 | Review | Kept. The dispatch marked it `in-flight`. A `rejected` record in the same session marks it `ready` again. | `confirm` | When `canConfirmReview` |
| N3 | Form | Closed. A network change invalidates the session (G3). | `switchNetwork` | Always |
| N4 | Review | Kept, not sendable while the balance is short. Sendable again when the balance recovers, if the session and `editSignature` still match. | None | Never |
| N5 | Form | Closed (`clearReview`, as today at `useBridgeController.js:2281`). | `openReview` | When the form inputs are valid |
| N6 | Form | Closed. The existing effect closes a review while `submitDisabledReason` is set (`useBridgeController.js:2460`). | None | Never |
| N7 | Form, or Review at Confirm | Kept. | `signRefundKey` | Always |
| N8 | Review | Kept while the session is unchanged. | `tryAgain` | When the form inputs are valid |
| N9 | Review | Kept, not sendable while a record blocks. | `checkAgain` | Always |
| X1, X17 | Form | Closed. | `openReview` | When the form inputs are valid |
| X6, X10 to X13 | Review | Kept while the session is unchanged. | `tryAgain` | When the form inputs are valid |
| X2 to X5, X7 to X9 | Review or form | Not sendable. | None | Never |

`tryAgain` runs `confirm` when the review is `ready`, the session matches, and `canConfirmReview` holds. Otherwise it runs `openReview`, which builds a fresh review. A retry never waits for the old snapshot to become `ready`.

**Review snapshot status.** A snapshot is `ready` or `in-flight`. Confirm needs `ready`. The dispatch (the `awaiting-wallet` write) marks it `in-flight`. A `rejected` or `discarded` record in an unchanged session marks it `ready` again. So does a stop that sends nothing, in an unchanged session, after a confirmed approval (a G5 failure or a failed transfer check). Any other outcome leaves it `in-flight`, and leaving the status screen closes it. A changed session closes it. So a Back to `?step=review` after a result shows no sendable Confirm.

**Other notices.** Every other message in 3.1 uses the notice layout in the warning tone. The title is the first sentence without its final period. The body is the rest. A message with one sentence has no body.

| ID | Message in 3.1 | Button label |
|---|---|---|
| X1 | G3: session, account, or network changed | Review again |
| X2 | G1: recovered key does not match the account | Confirm (disabled) |
| X3 | G3: another tab is sending | Confirm (disabled) |
| X4 | G3: browser cannot lock across tabs | Confirm (disabled) |
| X5 | G6: storage unavailable before dispatch | Confirm (disabled) |
| X6 | G5: allowance too low | Try again |
| X7 | D4: wallet cannot report changes | Confirm (disabled) |
| X8 | G4: wallet has no send path | Confirm (disabled) |
| X9 | G4: wallet does not support the request | Confirm (disabled) |
| X10 to X13 | G4 path S: signed for another network, transaction changed, earlier transaction not confirmed, nonce disagreement | Try again |
| X17 | G3: session, account, or network changed, plus the sentence "Nothing was sent." Used when G4 discards a raw transaction after a latch. | Review again |

**The G6 messages in 3.1 and the screens.** The text of each message stays. These screens carry them:

| Message in 3.1 | Screen |
|---|---|
| G6: sent, not confirmed yet | T1. The design replaces the sentence "Transaction sent. Waiting for confirmation." with the title "Confirming…". |
| G6: no confirmation after the timeout | T3 |
| G6: not found on the expected chain | X14 |
| G6: transaction reverted | T4 |
| G6: replaced by a different transaction | T5 |
| G6: pending transaction differs from the review | X15 |
| G6: interrupted before the hash arrived | T6 |
| G6: confirmed, but not the reviewed transaction | X16 |
| G6: send blocked by an unresolved transfer | N9 |
| G6: override action | The quiet action in N9, with the inline confirmation |

**Actions**

| Action | Behavior |
|---|---|
| New transfer | Opens the form. Clears the amount and the destination address. Keeps the chosen currencies. |
| View bridge activity | A link to `/activity`. The label does not say "track", because Activity is a public feed (2.8). |
| Check again | With `canMutateRecords`: G6 step 5 under the flow lock. It polls the known hash and rebroadcasts a validated stored raw transaction. Without `canMutateRecords`: RPC reads only. It sends no broadcast and no wallet request, writes no storage, and does not try to take an unavailable Web Lock. The result updates the display in memory only. The button shows its spinner while this runs. |
| Back to bridge | Hides the screen and shows the form (replace). The record stays unresolved. It stays hidden until the next load (D22). |
| Try again, Review again | Calls `openReview()` with the current form inputs. It commits the new snapshot before it navigates (the `flushSync` order of `useBridgeController.js:2518`). If the form inputs are gone, for example after a reload, it opens the form. A restored display string is never a review. N8, X6, and X10 to X13 use `tryAgain` (see the notice lifecycle). |
| Copy details | Copies these lines: `Wallet`, `Network` with the chain id, `Transaction` hash, `Outcome`, `Time` (ISO). It copies no account address and no key. The label shows "Copied" for 2 s. If the clipboard call fails, the card shows the text in a selectable block. |
| View on Etherscan, View replacement | An `<a>` with `target="_blank"` and `rel="noopener noreferrer"`. |
| Clear after checking my wallet, Send another transfer anyway | An inline confirmation replaces the actions: "If the first transfer still goes through, you will bridge twice." with the buttons "Clear" (or "Send anyway") and "Cancel". Clear resolves the record as `user-cleared` (G6), closes the screen, and opens the form (replace). T6 never returns for that record. |
| Switch to {chain}, Sign in {wallet} | As named in the notice lifecycle table. |

**Wallet differences**

| Topic | MetaMask (path E) | Brave Wallet (path S) |
|---|---|---|
| Wallet prompt | A send prompt. | A sign prompt. The site then checks and broadcasts (G4). Plan check 7 confirms this. |
| W3 | Never shows. | Can show (D20). |
| T1 explorer link | Works at once. | Can say "not found" until the broadcast lands. |
| N9 override | Offered. | Not offered while the site holds the raw transaction. |
| Error for an open request | `-32002` (N2, not decided). | Brave's code is not checked. |
| Total in {wallet} | The prompt shows the request `value`. | Not checked (D25, risk 18). |
| Icon | The announced icon. | The announced icon, or the plain tile (D11). |

**Selection, route, and history**

- Three things stay apart: the selected record (what the data says), the live flow (what this tab is doing), and the route (what the user sees). `getSendScreen` selects. The controller never navigates. `BridgeHomePage.jsx` owns every navigation, and `BridgeCard` renders the status card only when the route is `?step=status` and a screen exists.
- Add the step `?step=status`. With no screen and no notice transition, it goes to the form (replace). A notice transition decides first (see the history table).
- The records store reports `ready` when it has finished reading storage (A5). `ready` is set on every path, also after a storage error and without `navigator.locks`, so routing never waits forever. The existing normalization of `?step=review` without a snapshot and of an invalid step waits for `ready`. A reload at `?step=review` with an unresolved record goes to `?step=status`, and the form never flashes.
- A second flag, `canMutateRecords`, is false when the Web Lock is missing or storage cannot be written (G6). The screens then show restored records read-only: Clear after checking my wallet and Send another transfer anyway are disabled, and Check again is limited to RPC reads (see Actions). Sends are disabled (G6).
- **Reopen once per load.** After `ready`, the page picks the newest unresolved record (D22) and replaces the route once per document load. The flag and the `dismissed` set live in a module-level store (`src/utils/sendScreenState.js`), not in a component. They survive a route change and a remount of `BridgeHomePage`, for example a visit to `/activity` and back. "Back to bridge" and leaving the status step with the browser Back button add the record id to `dismissed`. Dismissal stops only the automatic reopening. An update of a dismissed record never reopens it.
- **Late results.** The records store emits a transition event `{ recordId, from, to }` (A5). For each event the page makes one decision. It applies these exclusions first, in order: a record that is not a bridge send on this chain; a dismissed record; an outcome that has no result screen (`rejected`, `discarded`, `user-cleared`), because its notice follows the lifecycle table; an approval success that a continuing live flow consumes; a route that is already `?step=status`, where the screen updates in place; a route that is `?step=review`. Only when none applies, and the route is the form, the page pushes `?step=status`. A persistent condition such as "has an outcome" never triggers a navigation. A timer change (T1 to T3) does not navigate.
- **Which records.** D22 considers only bridge sends: type `transfer` or `erc20-approval`, on the build's chain (`EXPECTED_ETHEREUM_CHAIN_ID`). Claim, NFT, and NFT approval records never open this screen. They still block sends (G6) and use their own alert areas. A record of another chain is ignored here and never links to this build's explorer.

| Event | Navigation |
|---|---|
| Confirm, W1 or W2 appears | Replace `?step=review` with `?step=status`. |
| W to T, T1 to T3, T3 to a result | None. |
| A notice ends a flow (N1, N8, X6, X10 to X13, or a notice after a stop in an unchanged session) | The surface of the notice decides, before the empty-status normalization. A notice assigned to Review, with a `ready` snapshot, replaces `?step=status` with `?step=review`. A notice assigned to the form, or without a valid snapshot, replaces it with the form. The normalization of Review must not then replace Review with the form. |
| Try again, Review again | Replace `?step=status` with `?step=review` after the new snapshot is committed. |
| New transfer, Back to bridge, Clear | Replace `?step=status` with the form. |
| Reload with an unresolved record | Replace the current entry with `?step=status`. |
| A record resolves while the user is on the form | Push `?step=status`. |
| Browser Back from `?step=status` | Normal history traversal. It usually leads to the form, but only "Back to bridge" guarantees it. The flow and the tracking continue. No automatic reopen. |
| Browser Forward to `?step=status` | Shows the screen when a record is selected. Otherwise it goes to the form (replace). |
| Browser Back or Forward to `?step=review` after a dispatch | The snapshot is `in-flight` or closed, so Review is not sendable and the route goes to the form. |

**Stored fields.** Each record stores only what the screens need. Validate every field on read: its type, and the maximum length below. Drop a field that fails. Render every field as text. Never use a display field to rebuild a transaction, or as authority to send. The raw-transaction validation before a rebroadcast (G6) stays as it is.

| Field | Content | Limit |
|---|---|---|
| `startedAt`, `hashAt` | The time of the dispatch, and the time the hash arrived | number |
| `display.send` | Amount and symbol, for example `0.005 ETH` | 48 characters |
| `display.receive` | Amount and symbol, with the "~" prefix | 48 characters |
| `display.destination`, `display.destinationName` | The address, and the VerusID name or empty | 100 characters each |
| `display.timeEstimate` | For example `1-6 hours` | 24 characters |
| `display.walletName` | `info.name` | 64 characters |
| `display.feeRows` | At most 3 rows of label and value | 24 characters each |
| `display.approvalCap`, `display.spender` | Approval records only: the requested cap (W2) and the contract | 48 and 42 characters |
| `confirmedCap` | Approval records only: the amount decoded from the mined approval transaction (T7). G5 allows the user to edit the amount, so never show the requested cap after confirmation. | 48 characters |
| `feePaid` | Written when the receipt arrives | 24 characters |
| `replacementHash` | The mined replacement (T5), or the actual transaction (X16) | 66 characters |
| `approvalRecordId` | On a transfer record that follows a confirmed approval | id |
| `mismatch` | Set by the G6 step 2 comparison | boolean |

If the update that stores the hash fails, the screen keeps the hash and the explorer link in memory (G6). Delete a resolved record 30 days after its resolution (`RESOLVED_RECORD_RETENTION_MS`). Never delete an unresolved record. Keep a resolved record while an unresolved record references it through `approvalRecordId`.

**Accessibility**

- Only the title and the body sit in a live region (`aria-live="polite"`, atomic). The card root is not a live region, so an update does not announce the actions. N1 uses `role="status"`. The other notices use `role="alert"`.
- The mark is `aria-hidden`. A swapped-out text is `aria-hidden` and `visibility: hidden` after its fade.
- Focus. When W1 or W2 replaces Review, move focus to the card title (`tabIndex={-1}`). When a screen returns to Review or the form, focus the first notice (`tabIndex={-1}`) if there is one, otherwise the main button. When an inline confirmation replaces the actions, focus its text. On Cancel, focus the action that opened it. A result that opens by itself leaves focus alone, with one exception: when the focused element was in the form that the result replaces, the card title takes focus. The form inputs keep their values, because only New transfer clears them. The live region announces the result.
- Restored screens, and screens with reduced motion, show the actions at once. Only a live transition hides the actions until the mark settles.
- Every action is a button or a link, reachable by keyboard. The existing `--theme-focus-ring` is a low-opacity shadow. Add `outline: 2px solid var(--theme-accent-bright); outline-offset: 2px` on `:focus-visible` for the actions of the status card and the notices.
- At a width of 320 px, titles wrap, rows wrap, and nothing clips. Check 320 px, 375 px, and 1024 px in both themes.

## 4. Decisions

| ID | Decision | Reason |
|---|---|---|
| D1 | Find wallets with EIP-6963. Keep the `announceProvider` listener for the life of the page. Send `requestProvider` at start and again at window `load`. Read every announcement property inside `try/catch`. | Brave announces at `load` only (2.3). A throwing getter must not break discovery. |
| D2 | **Owner decision, 2026-10-13: list only supported wallets.** Discovery keeps an announcement only when its `rdns` is exactly `io.metamask` or `com.brave.wallet`. Keep these values in one constant, `SUPPORTED_WALLET_RDNS`, which D18 also uses. Ignore every other announcement, also `io.metamask.flask`. There is no legacy `window.ethereum` entry. | A wallet that cannot send (D18) must not appear. A connected wallet that cannot send confuses users. Current MetaMask and Brave Wallet both announce with EIP-6963. |
| D3 | Discovery is "settled" 500 ms after window `load`. If discovery starts after `document.readyState === 'complete'`, settle 500 ms after start. Make the delay one named constant. `start()` and `stop()` are idempotent. | Gives late wallets time to announce. |
| D4 | Add one connector class on the web3-react 6 `AbstractConnector`. It takes a provider object and uses only EIP-1193 `request`. If it cannot subscribe to `accountsChanged` and `chainChanged`, activation fails with the D4 message. | A wallet that does not report changes cannot keep the session check (G3) current. Fail closed. |
| D5 | Runtime identity of a wallet entry: the announcement `uuid` plus the provider object. Ignore a repeat announcement with the same `uuid`. Never replace the provider of an existing entry. A new provider with an `rdns` that is already listed becomes a separate entry. | `rdns` can be copied. The connected provider must not change under the user. |
| D6 | Remember the chosen wallet's `rdns` in `localStorage`, only as a reconnect preference. Eager connect reconnects only when exactly one entry has that `rdns`. Keep the auto-connect suppression key (`verus-bridge.injected-wallet-auto-connect-disabled`) and its meaning. | Users with two wallets must get the wallet they chose. Two entries with one `rdns` need a person to choose. |
| D7 | Migration: if no `rdns` is remembered, eager connect only when exactly one supported wallet reports a non-empty `eth_accounts`. Otherwise, do not connect. The user picks from the menu. | Current MetaMask users keep auto-reconnect. The site never guesses between wallets. |
| D8 | List order: entries that match the remembered `rdns` first, then by name (A to Z). | Announcement order changes between loads. |
| D9 | App code never reads `window.ethereum` or its properties. | Brave can throw on any property read. D2 removes the only reason to read it. |
| D10 | Wallet calls use the pinned wallet provider. `getActiveProvider()` returns `null` for `networkConnector`. Track the attempted wallet and the last connected wallet separately. | One wallet, one provider. The network switch must also work after a failed eager connect (2.5). |
| D11 | Render wallet icons only with `<img src>`. Accept only `data:image/` URIs. Otherwise show the gray tile. | EIP-6963 security guidance. |
| D12 | The wallet name in messages is `info.name` from the announcement. The fallback name is "your wallet". | Matches the approved copy. |
| D13 | Add `@web3-react/abstract-connector@6.0.7` as a direct dependency. Remove `@web3-react/injected-connector` at the end. Use pnpm. | pnpm blocks imports of transitive dependencies. 6.0.7 is already in the lockfile. |
| D14 | A connection is successful only when web3-react reports `active` with that wallet's connector. Store the `rdns` and clear the suppression key only then, in an effect that watches that state. Do not treat a resolved `activate()` promise as success. | 2.5: `activate()` resolves on errors too. |
| D15 | Eager connect stops when discovery is settled. It also stops when the user starts a manual connect. A late eager result never replaces a manual connection. | No surprise wallet changes. |
| D16 | All transaction guards fail closed before dispatch. The site never retries with weaker parameters, for example without `chainId`, and never picks another signing method on its own. | An untested wallet must stop, not improvise. |
| D17 | Trust boundary: the site controls the request up to dispatch. On path S, it also checks a returned signed transaction before anything reaches Ethereum. The site cannot protect against a wallet that broadcasts on `eth_signTransaction` (Brave does this for hardware accounts, D20), falsely claims another wallet's `rdns`, or changes a transaction after the user confirms it on path E. G6 never reports such an outcome as success, but it can leave the result unknown. Write this in the code comment of the guard module. | Sets an accurate limit for reviewers. |
| D18 | **Owner decision, 2026-10-13: accept no wrong-chain risk that the wallet's source does not exclude.** Choose the send path from the connected wallet entry's `rdns`: `io.metamask` uses path E (`eth_sendTransaction` with `chainId`). `com.brave.wallet` uses path S (`eth_signTransaction`, then the site checks and broadcasts). No other wallet appears in the menu (D2). `guardedSend` still refuses any other `rdns`, as a defensive check. Never fall back to `eth_sendTransaction` for a wallet other than MetaMask. A follow-up can add a wallet after a source review shows that it rejects a different `chainId` (path E), or that its `eth_signTransaction` never broadcasts (path S). | Brave ignores `chainId` (2.6), so path E is safe only for a wallet that is shown to enforce it. Brave's hardware path shows that a wallet can broadcast on `eth_signTransaction`, so path S is safe only for a wallet whose source was checked. |
| D19 | Sends require the build's Ethereum RPC URL (`BRIDGE_DEPLOYMENT.ethereumRpcUrl`). The "site RPC provider" is an ethers `JsonRpcProvider` for this URL. G6 tracks transactions through it, and path S broadcasts through it. If a build has no valid URL, disable sends with a configuration error. The local `.env` sets `REACT_APP_RPC_URL_MAINNET` and `REACT_APP_RPC_URL_SEPOLIA` to http(s) URLs (checked 2026-10-13, values not printed). | G6 must read the expected chain, not the wallet's current chain. Path S broadcasts through the same RPC. |
| D20 | **Owner decision, 2026-10-13: Brave hardware accounts.** Brave broadcasts a hardware-signed transaction on `eth_signTransaction` (2.6), and the site cannot know the account type before the request. Keep Brave sending, and accept this narrow case: the network is the one that Brave reads when it receives the request, directly after the site's last check. The site warns at once if the network changes while the request is open (G4, path S). Draft a bug report for brave-core. Post it only with the owner's approval. | The other choice was "only MetaMask sends". That stops the main goal of this work. |
| D21 | **Owner decision, 2026-10-13: design A for the send screens.** After Confirm, one status card replaces Review. It shows the wait, the result, and every error after the wallet request (3.2). An error that proves nothing was sent stays on Review, as a notice above the Confirm button. | Today the Review screen stays live after a send, and a user can send twice (2.8). One frame is easier to read than toasts. The owner compared three designs and chose A. |
| D22 | **Owner decision, 2026-10-13: a reload reopens the result screen.** On load, once the records store is ready, the newest bridge-send record that is not resolved opens its screen at `?step=status`, once per load (3.2, "Selection, route, and history"). T3 (or X14) shows for a record with a hash, and T6 for a record without. Tracking starts at once. When the record resolves, the same screen changes to its result (T2, T4, T5, T7, X15, or X16). A resolved record never reopens. "Back to bridge" hides the screen until the next load. The screen needs the record only, not a connected wallet. | The first plan showed a notice. One surface is easier to learn. A record that is not resolved blocks new sends (G6), so the user must be able to find it. |
| D23 | Error classes for the UI. One function, `classifyWalletRequestError`, in `guardedSend.js` (A3), reads only the error of the dispatched wallet request. `4001`, or `ACTION_REJECTED` when ethers wraps a wallet rejection, gives `rejected` with reason `user`. `4200` and `-32601` give `rejected` with reason `unsupported`. Everything else gives `unknown`. Errors from RPC reads, tracking, and the broadcast never go through it. A rejection proves that this one request sent nothing. A failed check before dispatch and a G4 discard prove it too. Only these show a "nothing was sent" notice. After a confirmed approval, the notice says "The transfer was not sent. The approval stays in place." (3.2, rule 8). Any other error after dispatch shows T6 (no hash) or T3 (hash). The site shows `error.message` only in the "Details" fold of N8. | G6: the wallet can have broadcast. The old toast showed raw errors and a false success (2.8). One classifier keeps G4, G6, and the screens in step. |
| D24 | The wallet screens have no Cancel and no Back action. The wait hint appears after 15 s (`WALLET_HINT_DELAY_MS`). Focus moves to the card title when the screen replaces Review. | The site cannot cancel an open wallet request (3.2, rule 5). |
| D25 | "Total in {wallet}" shows the `value` of the dispatched request, for ETH sends only. It adds no gas, because the wallet adds its own network fee. | MetaMask asks for the amount plus the bridge fee. Without this row, the totals look different (2.8). |
| D26 | The link to the Activity page says "View bridge activity". It never says "track". | Activity is a public feed. It cannot show one transfer (2.8). |

## 5. Transaction safety guards

These guards apply to MetaMask too. G1 and G2 can ship first (section 6). G3 to G6 ship with the wallet work, because the send path depends on the wallet's EIP-6963 entry (D18).

### G1: Verified refund key

- Keep the exact message and its byte encoding (`0x` + hex of the UTF-8 message).
- Sign through the pinned wallet provider: `library.send('personal_sign', [message, account])`.
- After recovery, require `utils.computeAddress(publicKey)` to equal the connected account (case-insensitive). Reject malformed signatures. On a mismatch, stop with the G1 message. Do not cache anything.
- Apply the same check to the claim page (`useClaimController.js:500`) before it uses the public key.
- This is a capability check, not a wallet-brand check. Do not use `getCode(account)` as proof that an account is a normal account. Do not accept an ERC-1271 contract signature as a refund key.

### G2: Verified refund cache

- Store a new record per account: `{ account, publicKey, refundAddress, version: 2 }`, under a new key (for example `pubkeyAddressV2`).
- When the site reads a record, check three things: the public key maps to the account, the refund address equals the base58check of the compressed key's hash160 with version 60, and the version is 2.
- Treat old address-only entries in `pubkeyAddress` as unverified. Ask for a new signature before use. Do not delete the old key.
- Key in-flight signature requests by wallet session and account, not by account alone. When the session changes, a pending signature result is discarded. A1 ships before the session module (section 6). So A1 keys them by the provider object and the account, and discards a result if either differs when it returns. A2 replaces this key with the session id.

### G3: Wallet session and transaction context

**Wallet session.** One module (`src/wallets/walletSession.js`) owns a session id, a number held outside React.

- It increments the id **synchronously**, in the event handler itself, when the pinned provider emits `accountsChanged`, `chainChanged`, or `disconnect`. It does not wait for a React state update. So an account that changes and changes back during one wait still invalidates the session.
- It also increments the id when a manual connect or disconnect starts, and when web3-react reports a different connector, account, or chain.
- It stores the pinned provider object with the id. A new provider with the same account is a new session.
- The module subscribes through the new connector (B2). If it cannot subscribe, the site disables sends with the D4 message.

**Review binding.** The review snapshot stores the session id and the provider. A review from another session is stale. The user must review again.

**Operation lock.** A transfer, claim, or NFT send takes a synchronous lock (a ref flag) before its first `await`. A second submit while the lock is held does nothing. Then, as its first `await`, the flow takes a Web Lock: `navigator.locks.request(name, { ifAvailable: true }, callback)`, with a name made from the chain id and the account. So a second tab cannot send from the same account at the same time. If the Web Lock is held, stop with the G3 "another tab" message. If the browser has no `navigator.locks`, disable sends with the G3 "cannot lock" message. Hold the Web Lock for the whole flow. Inside it, read the G6 records again before the first wallet prompt (the send-blocking rule). Release both locks in `finally`.

**Check order for each approval and each send:**

1. Populate the transaction completely, **without** `chainId`, then add it to the result. ethers 5.8.0 rejects `chainId` in contract overrides, also in `populateTransaction` (`cannot override "chainId"`, `UNSUPPORTED_OPERATION`):

   ```js
   const populated = await contract.populateTransaction[method](...args, { from, gasLimit, value });
   const tx = { ...populated, chainId: EXPECTED_ETHEREUM_CHAIN_ID };
   ```

   No wallet prompt happens here.
2. Check that the session id equals the captured id.
3. Run the asynchronous checks: live `eth_accounts` returns the pinned account as its first element, live `eth_chainId` equals the expected chain, and the bridge contract has code. Also read the current block number from the site RPC provider (D19). This is the `startBlock` for G6.
4. Check the session id again.
5. Convert the transaction to JSON-RPC form (`JsonRpcProvider.hexlifyTransaction(tx, { from: true })`).
6. Take the G6 storage lock (G6 storage rules). Inside it, in one synchronous block with no `await`: check the session id a third time, read the records fresh from storage, apply the send-blocking rule, write the G6 operation intent (state `awaiting-wallet`), and send the wallet request. Do not wait for the wallet's answer inside the storage lock. If the write fails, stop with the G6 storage message, and do not ask the wallet.
   - **Path E (MetaMask):** `provider.request({ method: 'eth_sendTransaction', params: [hexTx] })`.
   - **Path S (Brave Wallet):** `provider.request({ method: 'eth_signTransaction', params: [hexTx] })`. Path S needs the intent too, because Brave broadcasts for hardware accounts (D20). Continue with the path-S rules in G4.

On any mismatch, stop with the G3 message. Make no wallet write. Also run steps 2 to 4 after each wait in the flow (signature, name lookup, approval receipt).

Use this guard in the bridge, claim, and NFT flows. Replace `assertBridgeTransactionContext` with the shared module.

These checks stop every change that the site can observe before it asks the wallet. On path S, G4 also checks a returned signed transaction, so a network change after the last check cannot reach Ethereum through it. The exception is a Brave hardware account, which broadcasts at once (D20).

### G4: Send paths

**Both paths.**

- Every request carries `chainId: EXPECTED_ETHEREUM_CHAIN_ID`. G3 step 1 adds it to the populated object, after population, so the contract-override error in 2.6 does not happen.
- The site asks the wallet through the pinned provider's `request` (G3 step 6), not through `signer.sendTransaction`. ethers' signer would add more `await` steps after the last check.
- Use the paths for ERC-20 approvals, bridge transfers, claim transactions, and NFT transactions.
- The path follows D18. Select it when a flow starts, before its first wallet prompt, also before the refund signature. A wallet with no send path stops there with the G4 "no send path" message. The site never changes the path for a wallet during a flow.
- Results on both paths: user rejection (`4001`, or `ACTION_REJECTED` when a library wraps it) resolves the G6 intent as `rejected` with reason `user`. An unsupported-method error (`4200` or `-32601`) also resolves it as `rejected`, with reason `unsupported` and the G4 "does not support the request" message. Any other error, or no answer, leaves the intent unresolved (G6), because the wallet can have broadcast. `classifyWalletRequestError` (D23) makes this decision, for the error of the dispatched request only.

**Path E (MetaMask).** If MetaMask rejects the request because of `chainId`, stop. Do not retry without it. Then continue with G6.

**Path S (Brave Wallet).**

**While the request is open (D20).** This is a best-effort warning after dispatch, not a guarantee. Directly after the sign request, in the same synchronous block, send `eth_chainId` to the same provider. Brave processes the requests of one page in the order they arrive, and its sign handler reads the network when it processes the request (2.6). So the `eth_chainId` handler runs after the network of the transaction is fixed. The two answers can complete in any order, because the sign answer waits for the user. This order is an inference from the source, not a test.

The site **latches the operation as stopped** when any of these happens before it processes the sign result: the `eth_chainId` answer differs from the expected chain; that answer is rejected or malformed; it does not arrive within one named timeout constant; or the pinned provider emits `chainChanged` or `accountsChanged`. A latched operation:

- invalidates the session (G3), and shows the G4 "network changed while the request was open" warning in a blocking dialog. The warning can appear after the user has already confirmed in the wallet;
- does not broadcast a returned raw transaction, even if it passes the checks below. The site deletes it and resolves the record as `discarded`;
- tracks a returned hash (G6), but does not continue the flow, for example to the transfer after an approval.

The site processes the sign result only after the `eth_chainId` answer arrives or its timeout ends. For a software account, the checks below also stop a wrong signed result. For a hardware account, this warning is the only protection.

After `eth_signTransaction` returns:

1. If the result is a 32-byte hash, the wallet has broadcast the transaction itself (Brave does this for hardware accounts, 2.6). Store the hash in the record (state `submitted`), and track it (G6). The site broadcasts nothing. If the result is neither a hash nor a signed raw transaction, keep the record unresolved, and show the G6 "interrupted" message.
2. Decode the raw transaction with `utils.parseTransaction(raw)`. Require all of these:
   - `chainId` equals `EXPECTED_ETHEREUM_CHAIN_ID`;
   - the recovered `from` equals the pinned account;
   - `to`, `value`, and `data` equal the populated request (for approvals, use the approval policy in G6 step 2);
   - `nonce` equals both `getTransactionCount(account, 'latest')` and `getTransactionCount(account, 'pending')` from the site RPC provider (D19). So the account has no transaction that is not confirmed, and the signed transaction is the next one to execute. A transaction with a later nonce could wait in the mempool and execute much later;
   - no other unresolved G6 record of this account and chain holds the same nonce.
3. If any check fails, discard the signed transaction: do not broadcast it, and delete it. Resolve the record as `discarded`. Show the matching message: G4 "signed for another network", G4 "changed the transaction", G4 "earlier transaction not confirmed" (the pending count is higher than the latest count), G4 "nonce disagreement" (any other nonce difference), or G6 "send blocked" (another record holds the nonce).
4. Check the session id. Update the record to state `signed`, with the raw transaction, its hash (`utils.keccak256(raw)`), and its nonce. If the write fails, stop with the G6 storage message, and do not broadcast. G6 tracking starts now (G6 step 1).
5. Broadcast through the site RPC provider: `eth_sendRawTransaction`. If it returns the stored hash, set the state to `submitted`.
6. If the broadcast fails, returns another hash, or gets no answer, keep the record unresolved. A broadcast error does not prove that nothing was sent: for example, "already known" or "nonce too low" can mean that an earlier attempt reached the network. Tracking continues. "Check again" broadcasts the same stored raw transaction again, without the nonce checks of step 2. This is safe: the same signed transaction has the same hash and nonce, so it can execute at most once.

### G5: Allowance check

- After the approval receipt, read `allowance(account, DELEGATOR_ADD)` through the site's contract instance.
- If it is lower than the transfer amount, stop with the G5 message.
- If it is higher, continue. Do not show text that says only the requested amount was approved.
- ERC-721 NFTs use `approve(DELEGATOR_ADD, tokenId)` (`NFTForm.jsx:100`). After it, read `getApproved(tokenId)` and stop if it is not `DELEGATOR_ADD`.
- ERC-1155 NFTs use `setApprovalForAll`. Keep that call as it is. After it, read `isApprovedForAll(account, DELEGATOR_ADD)` and stop if it is false.

### G6: Submitted transactions

Keep two ideas apart:

- **Workflow stop.** The site does not perform the next approval or send of this flow.
- **Resolution.** A receipt, or a confirmed nonce replacement, on the expected chain fixes the chain outcome of a record. Only resolution allows an ordinary new send.

**Record states.** Store one record for each dispatched request, under the new key `verus-bridge.submitted-operations`:

| State | When | Content added |
|---|---|---|
| `awaiting-wallet` | G3 step 6, before dispatch, on both paths | chain id, account, send path, operation type (`erc20-approval`, `erc721-approval`, `erc1155-approval`, `transfer`, `claim`, `nft`), the populated request (`to`, `data`, `value`, `chainId`), review identity, `startBlock` (G3 step 3), time, the display fields for the send screens (3.2, "Stored fields") |
| `signed` | path S: G4 step 4, before broadcast | the raw signed transaction, its hash, and its nonce |
| `submitted` | path E: the wallet returns a hash. Path S: the wallet returns a hash (D20), or the broadcast returns the stored hash | hash |
| `observed` | the site RPC provider returns the transaction | sender, nonce, observed fields |
| `resolved` | tracking or the user reaches an outcome | outcome: `success`, `reverted`, `cancelled`, `replaced`, `confirmed-unexpected`, `rejected`, `discarded`, or `user-cleared`. A `rejected` outcome stores a reason, `user` or `unsupported` (D23). A `discarded` outcome stores its G4 reason. |

**Storage rules.**

- **Atomic updates.** All reads and writes of `verus-bridge.submitted-operations` go through `submittedOperations.js`. Each change is one read-modify-write inside a short, exclusive Web Lock named `verus-bridge.submitted-operations` (the storage lock). Inside the lock, read fresh data from storage, change only the one record, and write it back. Never hold the storage lock while the site waits for a wallet or an RPC. The flow lock (G3) and the storage lock are different locks: take the flow lock first, and take the storage lock only for each short update. Background tracking takes only the storage lock. It never waits for a flow lock. Without `navigator.locks`, the site changes no records and shows restored records read-only.
- **Forward-only states.** Each transition names the state that it expects. If the stored record is no longer in that state, ignore the transition. States only move forward: `awaiting-wallet`, `signed`, `submitted`, `observed`, `resolved`. A resolved record never changes. So a stale callback, from another tab or from before a reload, cannot undo a newer state.
- **Lock names.** Build lock names from the lowercase account and the decimal chain id.
- Storage must work before dispatch. If the intent write fails, stop with the G6 storage message. Do not dispatch.
- If a later update fails (hash or observed fields), keep the earlier unresolved record. Keep the new data in memory and on screen, with the explorer link.
- Wallet rejection (`4001`) and an unsupported-method error (`4200`, `-32601`) resolve an `awaiting-wallet` record as `rejected`. A path-S result that fails a G4 check resolves it as `discarded`. A transport error, any other error, a missing response, or a reload leaves it unresolved, because these do not prove that the wallet broadcast nothing.

**Tracking.** Track through the site RPC provider (D19). It also broadcasts path-S transactions (G4). Do not track through the wallet, because the wallet can be on another network. Tracking does not depend on the wallet session: a disconnect, a reconnect, or a reload does not stop it.

1. Every unresolved record with a hash starts tracking at once: `signed`, `submitted`, and `observed`.
   - For a record with a raw transaction (path S), take the sender, nonce, `to`, `data`, and `value` from the validated raw transaction, and start step 3 at once. Do not wait until the RPC returns the transaction, and do not wait for a broadcast answer: an earlier broadcast can have reached the network although its answer was lost.
   - For a record with only a hash (path E, or a Brave hardware account), poll `getTransaction(hash)`. When the RPC returns the transaction, store its sender, nonce, and fields (state `observed`).
   - On restore after a reload, decode a stored raw transaction again. Recompute its hash, and compare its chain, sender, nonce, and fields with the record. If anything differs, delete the raw transaction, keep the record unresolved, and track it by hash only. Only a record with a validated raw transaction can be broadcast again.
2. Compare the observed fields with the record:
   - **Transfers, claims, NFT sends, and ERC-721 and ERC-1155 approvals:** `to`, `from`, `data`, `value`, and `chainId` must match exactly. An edited ERC-721 token id or ERC-1155 operator is a mismatch.
   - **ERC-20 approvals (`erc20-approval` only):** decode the call. Require the same account, chain, token contract (`to`), method `approve`, spender `DELEGATOR_ADD`, and zero ETH value. The amount can differ, because the user can edit it in the wallet. After success, G5 decides whether the transfer can continue.
   - A mismatch while the transaction is pending is a **workflow stop, not a resolution**. The record stays unresolved, tracking continues, and ordinary new sends stay blocked. Set the `mismatch` flag on the record. Show the G6 "differs" message (X15).
   - This policy applies to **every** transaction that tracking reports, including a replacement that ethers labels `repriced`. ethers compares a replacement with the observed transaction, not with the review. Always compare with the record.
3. Wait for the receipt with ethers' checked path: `siteRpcProvider._waitForTransaction(hash, 1, timeout, { from, nonce, to, data, value, startBlock })`. This is the call that `_wrapTransaction(...).wait()` makes (2.6). Use the stored metadata and the stored `startBlock`, never the block number at reload. ethers 5.8.0 checks for replacements only when `startBlock` is set. With the stored nonce, replacement detection also works after a reload when the RPC no longer returns the original hash. `_waitForTransaction` is an internal ethers 5 API. ethers is pinned to 5.8.0. Name it in a code comment, and cover it with the real-ethers tests in 8.4.
4. Outcomes:
   - **`success`** only when the transaction is on the expected chain, its fields pass step 2, and its receipt has `status === 1`.
   - **Repriced**: `success` only if the replacement passes step 2 against the record and its receipt has `status === 1`. A repriced replacement that fails step 2 ends as `confirmed-unexpected` (if mined with `status === 1`) or `reverted`.
   - **`confirmed-unexpected`**: the tracked transaction, or its replacement, mined with `status === 1` but failed step 2. Resolve the pending status, keep the workflow stopped, and link the actual transaction. Do not report bridge success. Do not continue an approval-dependent flow. Show the G6 "unexpected" message.
   - **`reverted`**: the receipt has `status === 0`. Show the G6 "reverted" message.
   - **`cancelled`** or **`replaced`**: another transaction with the same nonce was mined. Do not say that nothing was sent; the replacement can itself be a bridge call. Show the G6 "replaced" message with an explorer link to the replacement.
5. A record without a known nonce (`awaiting-wallet` after a reload, or a hash-only `submitted` record that the RPC never returned) stays unresolved. Do not guess its nonce. Never assign a hash to a record by matching fields: identical transfers are not unique, and an older or a later identical transfer would wrongly resolve the record. Keep a known hash; never replace it.
   - "Check again" polls the known hash, if there is one. For a record with a validated raw transaction, it also broadcasts it again (G4 step 6).
   - For a record without a hash, the site may list possible matches (transactions from the account to the same `to` since `startBlock`) as explorer links for the user to inspect. A listed match never changes the record.
   - A record without a hash can end only by an explicit user action, "Clear after checking my wallet". It asks for confirmation with the duplicate warning in section 3, then resolves the record as `user-cleared`. `user-cleared` is never shown as success.
6. Start the 240 s timer only after the hash exists. A record restored after a reload opens its result screen at once (D22): T3, or T6 when it has no hash.

**Unresolved records.**

- Restore unresolved records after a reload and resume tracking. Reopen the screen of the newest one (D22).
- Dismissing a screen or a notice only hides it. It does not resolve the record.
- While a record for the same account and chain is unresolved, new bridge, claim, and NFT sends from that account are blocked, with the G6 "send blocked" message and "Check again".
- Only resolution allows an ordinary new send.
- The user can still choose "Send another transfer anyway", a separate action with the duplicate warning in section 3. That action does not resolve the old record. Tracking continues.
- The site does not offer that action while an unresolved record holds a raw transaction (path S). A broadcast of that transaction can have reached the network, also when the site RPC provider shows no trace of it. There is no discard action for such a record. New sends from the account stay blocked until tracking resolves the record: a receipt, or a confirmed transaction with the same nonce (`cancelled` or `replaced`). "Check again" broadcasts it again. If the transaction cannot be mined, for example because its fee is too low, a transaction that the user sends from the wallet itself with the same nonce resolves the record when it confirms.
- The send-blocking check runs inside the flow lock and the storage lock (G3 step 6), so it also covers other tabs.
- Recovery actions ("Check again", "Clear after checking my wallet", "Send another transfer anyway") take the flow lock of the record's account and chain. They read the record fresh inside the storage lock before they act.
- Apply records and tracking to approvals too. An unresolved approval blocks the transfer that needs it.

**Other rules.**

- If a transfer stops after its approval confirmed, say that the approval stays in place.

### Smart accounts

- G1 blocks refund-bearing routes for any account whose signature does not recover to the account address.
- On other routes, the plan makes no support claim. If a smart-account wallet returns an operation hash that never appears as a transaction, G6 reports the status as unknown.

## 6. Work steps

Each step can be one commit. Order: A1, B1, B2, A2 to A5, B3 to B5, then C1 to C5, then S1, S5, S2, S3, S4.

- A1 (G1, G2) does not depend on the send path. It can ship alone, before the rest.
- A2 to A5 select the send path from the connected wallet's EIP-6963 entry (D18). The current injected connector has no `rdns`, so these steps ship together with phases B and C, in one release.
- S1 to S5 (the send screens) need A2 (session, stale review, locks), A3 (the dispatch events and the classifier), A4 (the allowance result), A5 (records, tracking, restore, the store events), and C3 (the wallet name). They ship in the same release, because the old success toast must go (D21). S1 and S5 have little or no React. Build and test them early, once the A3 and A5 interfaces are fixed.

### Phase A: Transaction safety

**A1. Refund key (G1, G2).**

- `src/utils/refundAddress.js`: `requestRefundAddressData(account, library)` signs through `library`. Add the account check and the v2 cache.
- Update the callers: `SiteHeader.jsx:336`, `useBridgeController.js:2065`, and `useClaimController.js:500`.
- `useBridgeController.js:2050`: skip signing only when a valid v2 record exists.
- Key in-flight signature requests by the provider object and the account (G2). A2 replaces this key with the session id.

**A2. Wallet session, review binding, and lock (G3).**

- New file `src/wallets/walletSession.js`: the session id, the pinned provider, synchronous invalidation from provider events, and invalidation from web3-react state and manual connect or disconnect.
- Bind the review snapshot (`useBridgeController.js:1144`) to the session id and the provider.
- Add the operation lock and the Web Lock to the bridge, claim, and NFT submit handlers.

**A3. Guarded dispatch (G3, G4).**

- New module `src/utils/guardedSend.js`: populate, add `chainId`, check, read `startBlock`, check, hexlify, check, and ask the wallet in the G3 order. It selects the path by D18 and runs the path-S checks and broadcast (G4). It returns the hash. It also exports the rebroadcast of a stored raw transaction, which "Check again" uses (G6 step 5). It is the only place that calls `eth_sendTransaction`, `eth_signTransaction`, or `eth_sendRawTransaction`.
- `guardedSend` reports events to its caller, so the UI can follow it: `onDispatch({ recordId, kind })` when the `awaiting-wallet` record is written, `onLatch({ reason })` for the G4 latch (`network`, `account`, or `unconfirmed`), `onHash({ hash })`, `onDiscard({ reason })`, and `onBroadcastFailure({ error })`. It also exports `classifyWalletRequestError` (D23). Phase S uses these events.
- Move the checks from `assertBridgeTransactionContext` (`src/utils/walletNetwork.js:60`) into it.
- Change the approval and send calls in `useBridgeController.js` (approval near line 2217, transfer near line 2362), `useClaimController.js`, and `NFTForm.jsx` to `guardedSend`.

**A4. Approval checks (G5).**

- Add the allowance read after the approval succeeds (G6 tracking) in `useBridgeController.js`. Add the `getApproved` and `isApprovedForAll` reads in `NFTForm.jsx`.

**A5. Submitted operations and tracking (G6).**

- New module `src/utils/transactionTracking.js`: the site RPC provider (D19), the polling, the field comparison, and the outcome rules.
- New module `src/wallets/submittedOperations.js`: the record states, the storage lock, forward-only transitions, the storage rules, restore after reload, and the send-blocking rule.
- Replace the timeout and pending state near `useBridgeController.js:2355`. A5 owns this work, and S2 does not repeat it. Use the same pattern in claim and NFT sends.
- The records store exposes `ready` (storage has been read, set on every path, also after a storage error or without `navigator.locks`), `canMutateRecords` (false without the Web Lock, or when storage cannot be written), `restoredUnresolvedIds` (the ids of the records that were unresolved when the store restored them, kept for the life of the document), `subscribe`, and a transition event `{ recordId, from, to }` for each state change. Phase S needs all five.
- Bridge sends show these states on the send screens (phase S). Claim and NFT sends show them in the existing alert area. Use the section 3.1 messages.

### Phase B: Wallet discovery and connection

**B1. Discovery module.** New file `src/wallets/walletDiscovery.js`, with no React in it:

- `createWalletDiscovery(win = window)` returns a store: `start()`, `stop()`, `subscribe(listener)`, `getSnapshot()`.
- The snapshot is `{ wallets, settled }`. Each entry is `{ id, uuid, rdns, name, icon, provider }`, where `id` is the `uuid`.
- Accept an announcement only if `info.uuid`, `info.name`, and `info.rdns` are non-empty strings, `info.rdns` is in `SUPPORTED_WALLET_RDNS` (D2), and `provider.request` is a function. Apply D5 and D11.
- Never read `win.ethereum` (D9).
- Return the same snapshot object until something changes. `useSyncExternalStore` needs this.
- New file `src/wallets/useWalletDiscovery.js`: one shared store, read with `useSyncExternalStore`.

**B2. Connector.** New file `src/connectors/eip1193Connector.js`:

- `class Eip1193Connector extends AbstractConnector`. The constructor takes `{ provider, wallet }` and sets `supportedChainIds: [EXPECTED_ETHEREUM_CHAIN_ID]`.
- `activate()`: call `request({ method: 'eth_requestAccounts' })`. Map error code `4001` to `UserRejectedRequestError`. Reject an empty or malformed account list. Subscribe to `accountsChanged`, `chainChanged`, and `disconnect` inside `try/catch`. If a subscription fails, remove the partial subscriptions and fail (D4). Return `{ provider, account: accounts[0] }`.
- Make subscription idempotent: a second `activate()` must not add a second set of listeners.
- `getProvider()` returns the provider. `getChainId()` calls `eth_chainId` and rejects an invalid value. `getAccount()` calls `eth_accounts` and returns `[0] ?? null`.
- `isAuthorized()` returns `true` when `eth_accounts` is not empty. It returns `false` on any error.
- `deactivate()` removes the listeners inside `try/catch`.
- Events: `accountsChanged` with `[]` calls `emitDeactivate()`. Otherwise it calls `emitUpdate({ account })`. `chainChanged` calls `emitUpdate({ chainId, provider })`. `disconnect` calls `emitDeactivate()`.
- Export `NoWalletError` and `UserRejectedRequestError` from this module.
- Export `getConnectorForWallet(wallet)`, which caches one connector per entry `id`.

**B3. Wallet context.** New file `src/providers/WalletProvider.jsx`. Mount it in `src/App.jsx` inside `WrappedWeb3ReactProvider` and around `Web3ConnectionProvider`, so eager connect can use it. It exposes:

- `wallets`, `settled`: from discovery, sorted by D8.
- `connectedWallet`, `attemptedWallet`, `rememberedRdns` (D10).
- `pendingWalletId` and `connect(walletId)`. `connect` cancels eager connect (D15), sets the pending id, and calls `activate(connector)`. Success follows D14.
- `pickerOpen`, `openPicker()`, `closePicker()`. Move the header's `showDropdown` state for the not-connected menu here, so the card button can open it.
- `getActiveProvider()` by D10.
- Put the storage helpers next to the existing ones in `src/utils/walletConnection.js`. Add the key `verus-bridge.wallet-rdns`. Wrap every storage call in `try/catch`, like the current helpers.

**B4. Eager connect.** Change `src/hooks/useEagerConnect.js`:

- If auto-connect is suppressed, do nothing (as today).
- Apply D6 and D7. Wait for announcements until discovery is settled, then stop (D15).
- Call `activate(connector, undefined, true)` for the chosen wallet. Keep the current error handling (`setError`, then `setTried(true)`) and the `stale` guard.
- `src/providers/Web3ConnectionProvider.jsx` keeps its network-connector fallback after `triedEager`.

**B5. Inactive listener.** Change `src/hooks/useInactiveListener.js`:

- Listen on the remembered wallet's provider only, and only when D6 picks exactly one entry.
- Keep `connect`, `chainChanged`, and `accountsChanged`. Drop the deprecated `networkChanged`.
- Keep the `canListenToProviderEvents` guard pattern. Wrap `on` and `removeListener` in `try/catch`.
- Reactivate with that wallet's connector, not `injectedConnector`.

### Phase C: UI, copy, and cleanup

**C1. Header.** Change `src/components/SiteHeader.jsx`:

- Build the wallet rows from the wallet context. Delete `WALLET_OPTIONS` and the `MetaMaskIcon` import.
- Before discovery is settled, show the supported wallets that have announced. Show "No supported wallet found" only after discovery is settled.
- Add the "Works with MetaMask and Brave Wallet." line, the waiting row, the empty state, the icon in the connected button, and the "Connected with {name}" label (section 3).
- `handleSwitchNetwork`: call `requestExpectedWalletChain(await getActiveProvider())`. Then reactivate with the attempted wallet's connector.
- Disconnect: keep `suppressInjectedWalletAutoConnect()` and `deactivate()`. Keep the remembered `rdns`, so the next Connect puts that wallet first.
- Error toasts: import the error classes from `eip1193Connector.js`.
- Add the CSS for the gray icon-fallback tile, the second row line, the muted line under the rows, and the spinner to `ReferenceBridge.module.css`. Use the existing theme tokens. Respect `prefers-reduced-motion` for the spinner.

**C2. Card button.**

- `useBridgeController.connectWallet` calls `openPicker()` from the wallet context. Remove the `injectedConnector` import there.
- Check the phone layout: the header is sticky, so the opened dropdown must be visible after the card button opens it.

**C3. Wallet name in checks.** `guardedSend` and the chain check take the wallet's message name. The default is "your wallet". Update the callers in `useBridgeController.js`, `useClaimController.js`, and `NFTForm.jsx`.

**C4. Copy.** `{wallet}` is the connected wallet's message name (D12). Capitalize it at the start of a sentence.

| Where | Today | New |
|---|---|---|
| `SiteHeader.jsx:292` | MetaMask switched to Ethereum. | {Wallet} switched to Ethereum. |
| `SiteHeader.jsx:298` | Could not switch MetaMask to Ethereum. | Could not switch {wallet} to Ethereum. |
| `useBridgeController.js:2138` | Switch MetaMask to Ethereum before bridging assets. | Switch {wallet} to Ethereum before bridging assets. |
| `useBridgeController.js:2194` | MetaMask will now allow the bridge contract to spend … | {Wallet} will now allow the bridge contract to spend … |
| `useBridgeController.js:2231` | … Review the amount in MetaMask before sending … | … Review the amount in {wallet} before sending … |
| `walletNetwork.js:41` | Switch MetaMask to Ethereum before continuing. | Switch {wallet} to Ethereum before continuing. |
| `walletNetwork.js:49` | MetaMask is not available in this browser. | No supported wallet found in this browser. |
| `NFTForm.jsx:90`, `:115` | Metamask will now pop up to allow … | {Wallet} will now pop up to allow … |
| `Claim.jsx:179` | … importing that private key into MetaMask. | … importing that private key into your wallet. |

`ETHEREUM_BLOCKCHAIN_NAME` stays in each message, as today.

**C5. Remove old code.**

- Delete these files. Nothing imports them, except each other: `src/components/Header.jsx`, `src/components/ConnectButton.jsx`, `src/components/WalletConnectDialog.jsx`, `src/constants/walletConfig.jsx`.
- Delete `src/connectors/injectedConnector.js` and its test. Move the supported-chain check to the new connector's test.
- Delete `src/images/icons/metamask-icon.svg` if nothing imports it.
- Run `pnpm remove @web3-react/injected-connector`. Check the lockfile diff.
- Search the code for `window.ethereum` and `injectedConnector`. None may remain.

### Phase S: Send screens (D21 to D26)

Build in this order: S1, S5, S2, S3, S4. S1 fixes the copy. S1 and S5 need only the A3 and A5 interfaces.

**S1. Screen model (no React).** New file `src/utils/sendScreens.js`:

- `getSendScreen({ flow, record, wallet, now })` returns a screen object, or `null`: `{ id, tone, mark, title, body, rows, primary, quiet, notice }`. `flow` describes this tab: whether a wallet request is live, the latch reason, and the approval record id. `record` is the newest record of the flow, or the record that D22 selected. It is a pure function.
- It follows the order in 3.2, "Screen selection". It holds every string of section 3.2, the approval variants, and the rule 8 sentences, in one constants object. `{wallet}` comes from `wallet.name`, or "your wallet" (D12). It capitalizes the name at the start of a sentence.
- It imports `classifyWalletRequestError` from `guardedSend.js` (A3, D23). It has no classifier of its own.
- No other file holds screen copy.

**S5. Explorer helper.** `src/config/explorerLinks.js`: add `getEthereumTransactionUrl(hash)`. It requires `/^0x[0-9a-fA-F]{64}$/` and returns `${ETHERSCAN_BASE_URL}/tx/${hash}`. Otherwise it returns `null`, and the screen shows no link.

**S2. Controller.** Change `src/hooks/useBridgeController.js`:

- Remove `isTxPending` and the toasts for send results. A5 already replaced the timeout and the pending state. S2 adds no second timer.
- Keep a `sendFlow` object: `{ phase, recordId, approvalRecordId, latchReason }`. Feed it from the `guardedSend` events (A3) and from the records store (`subscribe`, A5).
- Expose `sendScreen` (the selection) and the `mainAction` of the notice lifecycle table: `{ label, onPress, disabled, isSubmit }`. Expose the actions: `checkAgain`, `tryAgain`, `openReview`, `newTransfer`, `backToBridge`, `copyDetails`, `clearRecord`, `sendAnyway`, `switchNetwork`, `signRefundKey`. The controller never navigates. It exposes the events, and the page navigates (S4).
- Keep the review snapshot status (`ready`, `in-flight`) of 3.2. Split the effect near `useBridgeController.js:2460`: N3, N5, N6, X1, and X17 still close the review, and N4 and N9 do not.
- Pass the `approvalRecordId` to `getSendScreen`, so every stop after a confirmed approval uses the rule 8 text.
- Show W1 or W2 only after the `awaiting-wallet` record of that request is written. For a token send, run W2, T1 (step 1 of 2), C1 (the G5 check and the transfer's G3 checks), W1 (step 2 of 2, from the transfer's own record), T1. A failure in C1 returns to the form or Review with the rule 8 notice, and the review is `ready` again when the session is unchanged. A restored approval record never starts the transfer.
- Remove the text "Bridge transaction submitted successfully." The toast listeners for connection and network changes stay (risk 13).

**S3. Components and styles.**

- New `src/components/SendStatus/SendStatusCard.jsx`: the hero, the details panel, and the actions, from a screen object. New `StatusMark.jsx` (spinner, settle, glyphs, wallet tile). New `ReviewNotice.jsx`. New `InlineConfirm.jsx` for the duplicate warning.
- New `src/styles/SendStatus.module.css` with the 3.2 styles. Add the new tokens to `src/index.css`.
- Drive the animation with a `data-phase` attribute (`pending`, `done`) on the card root. A restored screen, and a screen with reduced motion, start in `done`.
- `src/components/BridgeCard.jsx`: render `SendStatusCard` in place of the Review form only when the route is `?step=status` and `controller.sendScreen` exists, and hide the "Edit details" row then. Render `ReviewNotice` above the main button of the form and of Review. The main button uses `mainAction`: `type="button"`, except for `confirm`, which submits. Follow the focus and live-region rules of 3.2 ("Accessibility").

**S4. Routing and reload.** Follow 3.2, "Selection, route, and history":

- `src/utils/homeNavigation.js`: add `HOME_STATUS_STEP = 'status'`. `getHomeStep` and `hasNonCanonicalHomeStep` accept it.
- `src/utils/sendScreenState.js`: a module-level store (no React) for the once-per-load flag and the `dismissed` set. It survives a remount of the page.
- `enterReview` (`BridgeHomePage.jsx:70`) takes a navigation mode: `push` (the default, form to review) or `replace` (a retry from the status step). Keep the order of `useBridgeController.js:2518`: commit the snapshot with `flushSync`, then navigate.
- `src/pages/BridgeHomePage.jsx` owns every navigation: the event table, the `ready` barrier, the once-per-load reopen, the late-result decision with its exclusions, and the notice-return decision (3.2). The notice-return decision runs before the empty-status normalization. Use the module-level store for the flag and the `dismissed` set. The records store keeps `restoredUnresolvedIds` for selection rule 2. The existing normalization of `?step=review` without a snapshot (near line 109) and of an invalid step (near line 95) waits for `ready`. The review-snapshot rule does not apply to `?step=status`.
- The router tests are in 8.8.

## 7. File changes

| File | Phase | Change |
|---|---|---|
| `src/utils/refundAddress.js` | A | Sign through `library`, account check, v2 cache. |
| `src/wallets/walletSession.js` | A | New. Wallet session id, pinned provider, synchronous invalidation. |
| `src/utils/guardedSend.js` | A | New. Path selection (D18), the G3 order, path-S checks and broadcast. The only caller of the three send methods. Dispatch events and `classifyWalletRequestError` (D23). |
| `src/utils/transactionTracking.js` | A | New. Expected-chain tracking and outcomes. |
| `src/wallets/submittedOperations.js` | A | New. Stored records, restore, send blocking. `ready`, `subscribe`, transition events, display fields, retention. |
| `src/utils/contract.js` | A | Keep `getContract` for reads and population. Sends no longer use the unchecked signer. |
| `src/utils/walletNetwork.js` | A, C | Checks move to `guardedSend.js`. Network switch request, wallet name, copy. |
| `src/hooks/useBridgeController.js` | A, C, S | Guards, explicit-chain sends, allowance check, pending state, picker, copy. Send flow state, notices, actions (S2). |
| `src/hooks/useClaimController.js` | A, C | Guards, explicit-chain sends, refund check, copy. |
| `src/components/NFTForm/NFTForm.jsx` | A, C | Guards, explicit-chain sends, approval check, copy. |
| `src/wallets/walletDiscovery.js` | B | New. EIP-6963 store, filtered to supported wallets (D2). |
| `src/wallets/useWalletDiscovery.js` | B | New. React hook. |
| `src/connectors/eip1193Connector.js` | B | New. Connector, error classes, connector cache. |
| `src/providers/WalletProvider.jsx` | B | New. Wallet context. |
| `src/App.jsx` | B | Mount `WalletProvider`. |
| `src/utils/walletConnection.js` | B | Remembered-`rdns` helpers. |
| `src/hooks/useEagerConnect.js` | B | D6, D7, D15. |
| `src/hooks/useInactiveListener.js` | B | Remembered wallet's provider. |
| `src/components/SiteHeader.jsx` | A, C | Signing caller, wallet rows, states, network switch, copy. |
| `src/styles/ReferenceBridge.module.css` | C | Gray icon-fallback tile, row second line, muted line, spinner. |
| `src/utils/sendScreens.js` | S | New. Pure screen model, all send-screen copy, error classes (S1). |
| `src/components/SendStatus/SendStatusCard.jsx`, `StatusMark.jsx`, `ReviewNotice.jsx`, `InlineConfirm.jsx` | S | New. The status card, the mark, the notice, the duplicate confirmation (S3). |
| `src/styles/SendStatus.module.css` | S | New. The 3.2 styles. |
| `src/index.css` | S | New tokens (3.2). |
| `src/components/BridgeCard.jsx` | S | Render the status card instead of Review. Notice and button labels. |
| `src/pages/BridgeHomePage.jsx`, `src/utils/homeNavigation.js` | S | The `status` step, `enterReview` mode, and the reopen rule (S4). |
| `src/utils/sendScreenState.js` | S | New. Module-level reopen flag and dismissed set (S4). |
| `src/config/explorerLinks.js` | S | `getEthereumTransactionUrl` (S5). |
| `src/pages/Claim.jsx` | C | Copy. |
| `package.json`, `pnpm-lock.yaml` | B, C | Add `@web3-react/abstract-connector`. Remove `@web3-react/injected-connector`. |
| Old files in C5 | C | Delete. |

## 8. Tests

Write few, meaningful tests. Test through public interfaces. Mock only at the wallet boundary: fake EIP-1193 providers and dispatched window events. Do not mock internal modules where the real one works. Take expected values from a spec or a worked example, never from the code under test.

Reuse the Brave fixture `createBraveWalletProvider` in `src/hooks/useInactiveListener.test.jsx`. Move it to a shared test helper. Add a variant that also announces an unwrapped provider with EIP-6963, the way Brave does.

### 8.1 Request equality across wallets

This is the main evidence for the first part of goal 5. It proves that every wallet gets the same request. It does not prove how a wallet executes that request; 8.3 and section 9 cover execution.

- Build two fake providers that can send: a MetaMask-like provider (`io.metamask`) and the Brave fixture (`com.brave.wallet`). Each records every request and answers with fixed RPC results.
- Run the same reviewed ETH transfer, the same ERC-20 approval plus transfer, and the same bounce-back transfer through each provider. Use real ethers serialization.
- Decode the recorded wallet requests (`eth_sendTransaction` for the MetaMask-like provider, `eth_signTransaction` for the Brave fixture). Assert that `to`, `from`, `chainId`, `value`, the approval spender and amount, and the bridge calldata are equal for both providers.

### 8.1a Send paths (D18, G4)

Use real ethers 5.8.0 signing in the fake providers, so the raw transactions are real.

- A provider announced with `rdns` `io.metamask` gets `eth_sendTransaction` with `chainId`. It never gets `eth_signTransaction`.
- A provider announced with `rdns` `com.brave.wallet` gets `eth_signTransaction`. It never gets `eth_sendTransaction`. The site broadcasts the raw transaction through the site RPC provider, and the hash equals `keccak256(raw)`.
- Defensive check: `guardedSend` with a provider whose `rdns` is not supported shows the "no send path" message before any wallet prompt, also before the refund signature. Zero sign, send, and raw broadcast calls.
- On both paths, the `awaiting-wallet` record exists before the wallet request.
- The Brave fixture rejects `eth_signTransaction` with `4200` or `-32601`: the "does not support the request" message, the record is `rejected`, and zero `eth_sendTransaction` calls.
- The Brave fixture returns a 32-byte hash (hardware behaviour, D20): the record moves to `submitted` with that hash, tracking runs, and the site broadcasts nothing.
- The Brave fixture changes its network directly after it receives the sign request: the D20 warning shows, and the operation is latched.
- The follow-up `eth_chainId` answer differs, is rejected, is malformed, or times out: the operation is latched. A returned raw transaction is not broadcast, even if it passes every check. A returned hash is tracked, and an approval-dependent transfer does not continue.
- A signed transaction with another `chainId`: nothing is broadcast, the raw transaction is deleted, and the record is `discarded`.
- A signed transaction with another `from`, `to`, `value`, or `data`: the same result.
- A signed ERC-20 approval with an edited amount: broadcast, then G5 decides. A signed ERC-721 approval with another token id: nothing is broadcast.
- A signed nonce that differs from the latest count: nothing is broadcast, with the "nonce disagreement" message. A pending count higher than the latest count: nothing is broadcast, with the "earlier transaction not confirmed" message.
- The intent write fails: no wallet request. The `signed` write fails: nothing is broadcast.
- The broadcast fails: the record stays unresolved. "Check again" broadcasts the same raw transaction, with the same hash, and does not repeat the nonce checks.
- A reload after the `signed` record is stored but before the broadcast: the record is restored, tracking resumes, and "Check again" broadcasts it.
- Two tabs (shared storage and a fake `navigator.locks`) submit from the same account: only one flow reaches the wallet. The other shows the "another tab" message. Without `navigator.locks`, sends are disabled.

### 8.2 Refund key worked example

Use the well-known secp256k1 private key `1`. Independent values:

- Ethereum address: `0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf`
- Compressed public key: `0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798`
- hash160 of the compressed key: `751e76e8199196d454941c45d1b3a323f1433bd6` (the same hash as Bitcoin address `1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH`)

Tests:

- A fake provider signs with key `1`. The `auxDest` part of `destinationaddress` ends with `01160214751e76e8199196d454941c45d1b3a323f1433bd6`.
- A signature from another key: G1 stops, nothing is cached, and the provider gets **zero** approval or send calls.
- A signature over the hex text instead of the message bytes: the same result.
- An old address-only cache entry: the site asks for a new signature before the transfer.

### 8.3 Guards before dispatch, and wallet behaviour after dispatch

**Before dispatch.** For each case, assert zero `eth_sendTransaction`, `eth_signTransaction`, and `eth_sendRawTransaction` calls after the stop:

- The account changes during the signature wait, and during the approval wait.
- The account changes and changes back during one wait (the event alone must invalidate the session).
- The provider changes, with the same account.
- The chain changes during the approval wait.
- A `chainChanged` event fires while G3 step 3 waits for `getCode`.
- The wallet disconnects during a wait.
- `eth_accounts` is empty or returns another first account.
- The allowance after approval is lower than the amount.
- The review snapshot belongs to an older session.
- Two rapid submit calls: exactly one flow runs.
- The wallet rejects a request with `chainId`: no second request without it.
- Real ethers 5.8.0: `populateTransaction` without `chainId`, then `chainId` added to the result. The dispatched params contain `chainId` and the same calldata as 8.1. Passing `chainId` as an override throws `UNSUPPORTED_OPERATION` (keep this as a guard test).

**After the wallet request.**

- A Brave-like fake provider switches to another network while it handles `eth_signTransaction`, and signs with that network's `chainId`. Zero `eth_sendRawTransaction` calls, the raw transaction is deleted, and the "signed for another network" message shows.
- A fake provider that broadcasts on `eth_signTransaction` (like Brave with a hardware account) returns a hash. The site tracks that hash (8.1a), never reports success unless G6 finds a matching transaction on the expected chain, and blocks new sends while the record is unresolved.
- A MetaMask-like fake provider whose network differs from the request's `chainId` rejects the request. The site does not retry without `chainId`.

### 8.4 Submitted transactions

Use real ethers 5.8.0 code: a `JsonRpcProvider` subclass whose `send` answers from a scripted chain (blocks, transactions, receipts, nonces). Do not inject synthetic `TRANSACTION_REPLACED` errors; the test must exercise `_waitForTransaction`. Cases:

- A mined transaction with `status === 1`: success.
- A mined revert (`status === 0`): failure.
- Repriced, then mined with `status === 1`: success with the new hash.
- Repriced, then reverted: failure.
- Cancelled (zero-value transaction to self with the same nonce): failure.
- Replaced by a different transaction with the same nonce: `replaced`. The message links to the replacement and does not say that nothing was sent.
- Replaced by a different transaction that itself calls the bridge contract: `replaced`, with the same message.
- A pending transaction whose fields differ from the record: a workflow stop. The record stays unresolved, tracking continues, and new sends stay blocked.
- That unexpected transaction then mines with `status === 1`: `confirmed-unexpected`, no bridge success, and an approval-dependent transfer does not continue.
- That unexpected transaction is repriced before mining: still `confirmed-unexpected`, because step 2 compares the replacement with the record.
- An ERC-20 approval with an edited amount: a higher amount passes step 2 and then G5; a lower amount passes step 2 and then stops at G5. A different spender or token stops the workflow.
- The site observes the original transaction, the page reloads, a replacement is mined, and the RPC no longer returns the original hash: tracking still reports `replaced` from the stored nonce and `startBlock`.
- The timer starts only after the hash. On timeout, the record stays unresolved.

Persistence:

- Timeout, then dismiss the notice: the record stays unresolved and new sends stay blocked.
- Timeout, then reload: the record is restored and tracking resumes.
- Timeout, then disconnect and reconnect: tracking continues, and the block stays.
- "Send another transfer anyway" sends only after the duplicate warning is confirmed. The old record stays tracked.
- Reload after dispatch but before the hash arrives: the `awaiting-wallet` record is restored as unresolved, and new sends stay blocked.
- An older identical transfer, mined before `startBlock` or at it, does not resolve the interrupted intent.
- A later identical transfer (also one sent with the override) does not resolve the interrupted intent and does not replace a known hash.
- "Clear after checking my wallet" resolves a record without a hash as `user-cleared` only after the duplicate warning is confirmed. It is never shown as success.
- Storage write fails before dispatch: no wallet request, and the storage message shows.
- Path S: the broadcast reaches the RPC, its answer is lost, and the transaction is mined: `success`. Tracking starts from the stored raw transaction, without a broadcast answer.
- Path S: a reload before the broadcast answer: the record is restored, and tracking resumes from the stored raw transaction.
- Path S: "Check again" gets "already known" or "nonce too low": the record stays unresolved, and tracking decides the outcome.
- Path S: a replacement with the same nonce is mined before a reload: after the reload, tracking reports `replaced` from the stored nonce and `startBlock`.
- Path S: on restore, the stored raw transaction does not match its hash or the record: no broadcast, and tracking by hash only.
- Path S: neither "Send another transfer anyway" nor a discard action is offered.
- Path S regression: the broadcast answer of transaction A is lost, the RPC shows no trace of A, and A is mined later. New sends stay blocked until A resolves, so the site never signs a second transfer while A can still confirm.
- Storage: a tracking update in one tab races a new intent in another tab: the intent survives. Simultaneous writes for two accounts: both survive. A stale transition after `resolved` is ignored.
- Storage write fails when the hash arrives: the `awaiting-wallet` record stays, and the hash shows on screen.
- Wallet rejection (`4001`) resolves the intent as `rejected`. A transport error leaves it unresolved.

### 8.5 Discovery and connector

`walletDiscovery`:

- A wallet that announces before or after `start()` appears once. A wallet that announces after `load` (Brave timing) appears.
- A repeat announcement with the same `uuid` is ignored. A new provider with a listed `rdns` becomes a second entry and does not replace the first.
- An invalid announcement (no `request`, an empty `rdns`, or a throwing getter) is ignored.
- An icon that is not a `data:image/` URI becomes `null`.
- Announcements with another `rdns` (for example `com.coinbase.wallet`, `io.rabby`, `io.metamask.flask`) are ignored.
- A `window.ethereum` with no announcement adds no entry. The store never reads `window.ethereum`: the Brave fixture, which throws on reads, records zero reads.
- `start()` after `readyState === 'complete'` settles. A second `start()` adds no second listener.

`Eip1193Connector`:

- `activate()` returns the provider and the first account. An empty account list fails.
- Error code `4001` becomes `UserRejectedRequestError`.
- A provider whose `on` throws fails activation with the D4 error and leaves no partial listeners.
- `accountsChanged` with `[]` emits deactivate. `chainChanged` emits an update with the new chain id.
- `deactivate()` survives a `removeListener` that throws.
- `isAuthorized()` returns `false` when `eth_accounts` rejects.
- `supportedChainIds` equals `[EXPECTED_ETHEREUM_CHAIN_ID]` (moved from `injectedConnector.test.js`).

### 8.6 Integration tests (React Testing Library)

- Two announced wallets: the menu lists both names in D8 order. A click on Brave Wallet activates Brave Wallet's connector. While it waits, the row shows "Confirm in Brave Wallet" and the other row is disabled.
- A rejected connection does not store the `rdns` (D14).
- No supported wallet after settling, with Coinbase Wallet announced: the menu shows "No supported wallet found" and does not name Coinbase Wallet.
- MetaMask, Brave Wallet, and Coinbase Wallet announced: the menu lists MetaMask and Brave Wallet only, with the line "Works with MetaMask and Brave Wallet."
- Wrong network after a failed eager connect: Switch calls `wallet_switchEthereumChain` on the attempted wallet's provider, not on `window.ethereum`. The toast says "Brave Wallet switched to Ethereum."
- Eager connect: a remembered wallet that announces before settling reconnects. Two entries with the remembered `rdns`: no connection. No remembered wallet and two authorized wallets: no connection. A manual connect during eager connect wins.
- The card button opens the header menu.
- Brave regression: the Brave fixture is `window.ethereum`, and Brave Wallet is announced. The page renders and Connect succeeds.

### 8.7 Existing tests to update

The copy changes on purpose (section 3, step C4). Update these assertions to the new copy. Do not loosen other assertions.

- `src/components/SiteHeader.test.jsx`: mocks `@web3-react/injected-connector` and `connectors/injectedConnector`. The test at line 303 sets `window.ethereum` and expects "Switch MetaMask …" and "MetaMask switched …".
- `src/hooks/useBridgeController.test.jsx`: line 601 expects "Switch MetaMask". Line 1787 sets `window.ethereum` for signing.
- `src/hooks/useClaimController.test.jsx`: line 355 expects "Switch MetaMask".
- `src/utils/walletNetwork.test.js`: lines 36, 39, and 52 expect MetaMask copy.
- `src/hooks/useEagerConnect.test.jsx`, `src/providers/Web3ConnectionProvider.test.jsx`, `src/hooks/useInactiveListener.test.jsx`: mock `injectedConnector`.
- `src/connectors/injectedConnector.test.js`: delete (step C5).
- `src/components/BridgeCard.test.jsx:750`: passes `reviewConfirmLabel: 'Submitting...'`. The label changes with S2 ("Checking…"). Update the assertion. Add cases for the status card and the notice in 8.8.

If a refactor that should keep behaviour breaks a test, report that the test is coupled to the implementation. Do not quietly rewrite it.

### 8.8 Send screens

Take expected values from the 3.2 tables, never from `sendScreens.js`. Run the false-success and double-send cases through the real guard and tracker code (8.1a, 8.4). A test that supplies a preclassified record checks only the presentation.

Pure model (`sendScreens.test.js`):

- Every screen ID in 3.2 except N2 (not in this release, risk 17): with the wallet MetaMask, Brave Wallet, and a missing name, the title, body, rows, and actions equal the table. "Your wallet" is capitalized at the start of a sentence and "your wallet" inside one.
- Every row of the "Screen selection" order has a case, including the conflicts: a live `awaiting-wallet` shows W1, and a restored one shows T6. A `mismatch` record shows X15, not T1 or T3. `user-cleared` shows no screen. `rejected` with reason `unsupported` gives X9, not N1. A hash-only record that the RPC never returned shows X14 after 240 s or after a restore. A record with a raw transaction shows T3.
- A rerender after T2 first shows keeps T2. An immediate path-S broadcast failure gives T3. A discard because another record holds the nonce gives N9. A resolved record of this document keeps its screen. A record restored unresolved and then resolved by the tracker keeps its result across rerenders and remounts, for a transfer success, a failure, and an approval success (T7). A record restored already resolved stays hidden. `user-cleared` gives no screen.
- Operation type: `transfer` with `success` gives T2. `erc20-approval` with `success` gives T7, and never T2. The approval variants of T1, T3, T4, T5, and T6 use the approval text.
- After a confirmed approval, every stop of the transfer (a rejection, a failed check, a G3 invalidation, a G4 discard, a G5 failure) says "The transfer was not sent. The approval stays in place." None says "Nothing was sent."
- The fee row of T4 equals `gasUsed` times `effectiveGasPrice` for a worked receipt.
- Stored fields: a field with a wrong type or a length over its limit is dropped. A display string with markup renders as text. A resolved record older than 30 days is deleted at load. An unresolved record is not.

Classifier (`guardedSend.test.js`): `4001` and `ACTION_REJECTED` give `rejected` with reason `user`. `4200` and `-32601` give `rejected` with reason `unsupported`. `-32002`, a plain `Error`, a nested `error.error.code`, and `undefined` give `unknown`. The expected result for `-32002` stays `unknown` until a follow-up adds N2. An error from `getTransaction` or a tracking read never resolves a record as rejected.

False success (the real tracker with the scripted RPC of 8.4):

- A receipt with `status === 0` shows T4 and never "Sent". A matching transfer with `status === 1` on the expected chain shows T2.
- Approval success, then an allowance failure (G5), a session invalidation, or a rejection of the transfer: never T2. The notice names the approval.
- A restored approval that was pending and then succeeds: T7. The site does not start the transfer. "Review again" opens a fresh Review. A reload after the approval already confirmed shows no screen. An approval with an edited amount shows the confirmed cap in T7, not the requested cap. A resolved approval that an unresolved transfer references survives the 30 day retention.
- A successful receipt whose fields differ from the record: X16, never T2.
- A pending transaction whose fields differ: X15, still unresolved, new sends blocked.
- Repriced, then mined with `status === 1`: T2, with the link to the transaction that succeeded.
- Cancelled or replaced: T5, with the link to the replacement, also when the replacement itself calls the bridge.

Double send (fake providers that count wallet requests and records):

- Rapid clicks and Enter on Confirm: one `awaiting-wallet` record and one wallet request.
- The gap between the approval receipt and the transfer dispatch: the normal flow sends the transfer once, and a second submit does not start another flow. Hold the allowance read pending: C1 shows. Hold the transfer's G3 checks pending: C1 shows. A failure in either returns the rule 8 notice, the review is `ready` again in an unchanged session, and one approval record exists. W1 shows only when the transfer's own record is written.
- Timeout (fake timers, 240 s): T3 shows and no new request starts. A later receipt changes the screen to T2 in place.
- Browser Back and Forward during W1 and T1, and a reload: no second request. A wallet answer that arrives after the user left the status screen updates the record and sends nothing.
- After T2, a history Back to `?step=review` shows no sendable Confirm. The route goes to the form.
- After a rejection (`4001`): the review is `ready`, Confirm works once, and exactly one new record exists. After a discard in a changed session: the review is closed.

Flows and routing (React Testing Library with a memory router):

- Before dispatch: a failed `getCode` check shows N8 with a "Details" fold, and W1 never renders. After dispatch: a generic provider error shows T6, not N8.
- A Brave fixture network change while the sign request is open shows W3. The account-change and unconfirmed-network variants show their own W3 text. A rejection then shows N1. A returned raw transaction is discarded and shows X17. A returned hash shows T1.
- Token send: W2, T1 (step 1 of 2), W1 (step 2 of 2), T1, T2. Path S: a failed broadcast shows T3 at once.
- Lifecycle: N3, N5, N6, X1, and X17 close the review and show the notice on the form. N4 and N9 keep a review that is not sendable, and N4 clears when the balance recovers. The main button runs `switchNetwork`, `checkAgain`, `openReview`, `signRefundKey`, or `confirm` as the lifecycle table says, and only `confirm` submits the form.
- Inline confirmation for "Clear after checking my wallet" and "Send another transfer anyway": Cancel changes nothing. Brave: no "Send another transfer anyway" for a record with a raw transaction. After Clear, the screen closes and T6 does not return for that record.
- Reload: after `ready`, a record with a hash opens T3 (or X14) at `?step=status` with no wallet connected. A record without a hash opens T6. A reload at `?step=review` with an unresolved record opens `?step=status`, and the form never flashes. A resolved record does not reopen. With two records, the newest opens. A claim or NFT record never opens this screen, and a record of another chain is ignored.
- "Back to bridge" and the browser Back button hide the screen until the next load. A later update of that record does not reopen it. A record that resolves while the user is on the form opens its outcome once, and Back from that outcome does not reopen it.
- Try again opens a fresh review from the current form inputs. After a reload, it opens the form. `enterReview` pushes from the form and replaces from the status step.
- Late-result decision: `rejected`, `discarded`, and `user-cleared` events push nothing. An approval success that a continuing live flow consumes pushes nothing. A dismissed record pushes nothing. An event on `?step=review` pushes nothing. An event on the form pushes `?step=status` once, only for an outcome that has a result screen.
- Dismiss a record, visit `/activity`, return home, then deliver a tracking update: the screen does not reopen. Load `?step=status` directly with a record: the screen shows, and the browser Back button follows normal history.
- Without `navigator.locks`: `ready` still becomes true, routing continues, a restored record shows read-only, and Clear and Send another transfer anyway are disabled.
- Check again with `canMutateRecords === false`: restore a signed raw transaction and press Check again. There are zero `eth_sendRawTransaction` calls and zero storage writes, and no attempt to take a Web Lock. Run this for both a missing Web Lock and unwritable storage.
- Notice return: fail the G5 check during C1 with an unchanged session. The final URL is `?step=review`, X6 is visible, and the retry works. Repeat for a failed transfer preflight check and for a same-session discard. The normalization of Review does not then replace Review with the form. A notice assigned to the form, or a notice without a valid snapshot, lands on the form.
- A `?step=status` URL with no record and no flow goes to the form.
- Explorer link: a valid hash gives `/tx/<hash>` on the build's explorer. An invalid hash gives no link. When the storage update for the hash fails, the screen still shows the hash and the link.
- Accessibility: the title and the body are in the live region. N1 has `role="status"` and the other notices have `role="alert"`. A swapped-out text has `aria-hidden="true"`. Focus moves to the title when W1 appears, to the first notice or the main button when a screen returns, and to the confirmation text when it opens. A result that opens while focus is in a form input moves focus to the card title, and the input keeps its value. A result that opens while focus is elsewhere leaves focus alone. A restored screen shows its actions at once.

Layout, motion, contrast, and themes are manual checks (section 9, checks 12 to 19). Unit tests do not load the CSS.

## 9. Manual checks

The automated tests in 8.1 to 8.3 carry the cross-wallet evidence. The manual checks confirm real wallet behaviour on a small, representative set. Report every other wallet as untested.

Use the ptest or testnet build (Sepolia). Do not use mainnet funds. A person must do the Brave Wallet setup, because it needs a wallet password.

Required setups:

| # | Browser | Wallets | Brave setting "Default Ethereum wallet" |
|---|---|---|---|
| 1 | Brave | Brave Wallet | default ("Brave Wallet (prefer extensions)") |
| 2 | Brave | Brave Wallet + MetaMask | default |
| 3 | Chrome | MetaMask | n/a |

Optional setups, if time allows: Brave with "Extensions (no fallback)", Chrome with MetaMask and Rabby, Firefox with MetaMask, Brave with no wallet, Brave Wallet with a Ledger or Trezor account.

For each required setup:

1. The menu shows the expected wallets, names, and icons.
2. Connect works. The waiting row appears while the wallet waits.
3. A reload reconnects to the same wallet.
4. Wrong network: Switch to Ethereum works. The toast names the wallet.
5. Send three Sepolia transfers: an ETH transfer, an ERC-20 approval plus transfer, and a refund-bearing (bounce-back) transfer if the test build offers that route. Decode each submitted transaction on a Sepolia explorer. Compare `to`, `value`, and input data with the transfer that the site showed.
6. In setup 3, confirm that MetaMask rejects a transaction whose `chainId` differs from its active network (2.6). Do this on test networks, with a direct `ethereum.request` from the browser console.
7. In setups 1 and 2, Brave Wallet shows a sign prompt, not a send prompt. After the site broadcasts, the transaction appears on the Sepolia explorer. Record how Brave's activity list shows it.
8. Change the account in the wallet while the approval waits. The site stops with the G3 message and sends nothing.
9. Disconnect, then connect a different wallet (setup 2).
10. Optional, with Rabby installed: Rabby does not appear in the menu.
11. Optional, with a Brave hardware account: the site gets a hash, broadcasts nothing, and tracks the transaction to success.

Send screens (3.2). Run checks 12 to 17 in each required setup, and checks 18 and 19 once:

12. After Confirm, W1 shows the wallet name and icon. In setup 3, "Total in MetaMask" equals the value in MetaMask's prompt. In setups 1 and 2, write down what Brave's sign prompt shows (D25, risk 18).
13. Reject the request in the wallet. Review returns with N1, and Confirm works. No record stays open.
14. Send a token: W2 shows first, then T1 with "Step 1 of 2", then W1 with "Step 2 of 2", then T1, then T2.
15. Close the wallet window without answering. After 15 s the hint shows. Reject in the wallet from the toolbar: N1 shows.
16. Reload during T1, and again during T3. T3 opens at once, with no flash of the form. After the transaction confirms, the same screen changes to T2.
17. Make a send revert (risk 22 gives a real case on Sepolia). T4 shows the fee paid and never "Sent". "Try again" opens Review.
18. Look at every screen in 3.2 at 1024 px, 375 px, and 320 px, in the light and dark themes, with a keyboard and with reduced motion on. Nothing clips, every action is reachable, the focus outline shows on every action in both themes, and the animation matches 3.2. Report each screen that you could not reach as untested.
19. Token send: reload while the approval is pending (T3 shows), then let it confirm. T7 shows, and the site does not start the transfer. "Review again" opens a fresh Review. Then reload after an approval that already confirmed: no screen shows, the form opens, and nothing is pending.

Record what you saw for each check. A screenshot proves only the state it shows.

## 10. Acceptance criteria

- `pnpm verify` passes.
- The tests in 8.1, 8.1a, and 8.2 to 8.4 pass.
- No `window.ethereum` read remains in `src`.
- The menu lists only wallets with `rdns` `io.metamask` or `com.brave.wallet`.
- `guardedSend.js` is the only code that calls `eth_sendTransaction`, `eth_signTransaction`, or `eth_sendRawTransaction`. Every approval and send goes through it.
- Only a wallet with `rdns` `io.metamask` ever gets `eth_sendTransaction`. Only a wallet with `rdns` `com.brave.wallet` ever gets `eth_signTransaction`. No other wallet gets either.
- Path S never broadcasts a signed transaction that fails a G4 check.
- The site reports a transfer as successful only through G6 tracking on the expected chain.
- `@web3-react/injected-connector` is not in `package.json`.
- Required manual setups 1, 2, and 3 pass every check in section 9.
- The UI matches section 3 at desktop and phone width, in light and dark themes.
- The tests in 8.8 pass. They count wallet requests and records. The old toast text no longer exists in `src`. That is cleanup evidence, not proof.
- The bridge shows "Sent" only on T2: a record of type `transfer` with outcome `success`, found by G6 on the expected chain. An approval never shows it.
- One Confirm gives at most one wallet request for the transfer. Rapid clicks, Back, Forward, a reload, a timeout, and a late wallet answer never start a second flow. After a result, the history does not restore a sendable Confirm.
- A stop after a confirmed approval always says that the approval stays in place.
- Every screen string of 3.2 exists only in `src/utils/sendScreens.js`.
- A reload reopens the newest bridge-send record that is not resolved, once per load, before any route normalization (D22).
- Manual checks 5 and 17 pass on Sepolia. They need a bridge send that can succeed, so they depend on the separate gas fix (risk 22). Do not waive these checks silently.

## 11. Risks and open questions

1. **Hidden wallets (D2).** The menu lists only MetaMask and Brave Wallet. A user with only another wallet, for example Coinbase Wallet or Rabby, sees "No supported wallet found". A MetaMask or Brave Wallet version without EIP-6963 is also hidden.
2. **Other wallets lose access (D18).** Today the "MetaMask" button connects whichever wallet controls `window.ethereum`, also Coinbase Wallet or Rabby. After this work, those users must install MetaMask or Brave Wallet. A follow-up can add a wallet to `SUPPORTED_WALLET_RDNS` after a source review (D18).
3. **`rdns` is self-attested.** A wallet that falsely claims `io.metamask` gets path E, and one that claims `com.brave.wallet` gets path S. On path S, the G4 checks still apply to a returned raw transaction. This is outside the trust boundary (D17).
4. **Brave activity list.** On path S, Brave records the transaction as signed, and the site broadcasts it. Brave's activity list can show it differently from a normal send (section 9, check 7).
5. **Internal ethers API.** G6 uses `_waitForTransaction`, an internal ethers 5 method. ethers is pinned to 5.8.0. An ethers upgrade must rerun the 8.4 tests.
6. **First account rule.** G3 requires the pinned account as the first element of `eth_accounts`. A wallet that returns accounts in another order stops with the G3 message. This fails closed.
7. **Existing users sign again.** G2 treats old cache entries as unverified, so users of bounce-back routes sign the refund message once more.
8. **Settle delay.** 500 ms after `load` is an estimate. A slow wallet can appear after the "No supported wallet found" state. Because the listener stays active (D1), the list then updates.
9. **Brave fix.** If brave-core#40625 ships, `window.ethereum.on` stops throwing. This plan does not depend on that, and it needs no change then.
10. **web3-react 6.** It stays in place. This plan reduces the dependency to `core` and `abstract-connector`.
11. **Trust boundary (D17).** A malicious or broken wallet can still change a transaction after the user confirms it. No site code can prevent that.
12. **Brave iOS and Android.** Not checked.
13. **Toast text.** The listener toasts ("connected to wallet", "Chain changed!", "Account changed!") stay as they are. They are out of scope.
14. **Brave hardware accounts (D20).** Brave broadcasts when a Ledger or Trezor account signs. The network is the one that Brave reads when it receives the request. A wrong network needs a network change in the wallet between the site's last check and that moment. Nobody has measured how long this window is. The site warns when it sees a change, but a user can ignore the warning. A brave-core fix that checks `sign_only` in `ProcessEthHardwareSignature` removes this case.
15. **Brave request order.** The D20 warning expects Brave to process the requests of one page in order. This is an inference from the source, not a test. The warning is best effort: it can appear after the user has confirmed.
16. **Blocked account after path S.** A path-S record with a raw transaction blocks new sends from that account until it resolves (G6). If the transaction cannot be mined, the user must send a transaction with the same nonce from the wallet itself.
17. **N2 is not in this release.** Decision of 2026-10-13, made on the owner's delegation. Provider error `-32002` means that the wallet already holds a request from this site. MetaMask is expected to report it before it queues a new request, so nothing would be sent. Nobody has checked this in the source, and nobody has checked the code that Brave returns in the same case. The plan counts only `4001` and `4200` as proof that nothing was sent (G6), so `-32002` ends in T6. That is safe, and it fails closed (D16). N2 is designed but not built. A follow-up can add it after a source check or a real-wallet check shows that each supported wallet returns `-32002` before it queues a request. The 8.8 classifier test keeps `-32002` as `unknown` until then.
18. **Total in {wallet} on Brave.** D25 says that the row equals the request `value`. Brave's sign prompt may show another number or other wording. Manual check 12 records it. Change the row text if it misleads.
19. **A reopening screen can nag.** A record that cannot resolve reopens its screen on every load (D22). An example is a path-S transaction whose fee is too low. T6 has "Clear after checking my wallet". A record with a hash has no clear action (G6). The user must get the transaction mined, or send one with the same nonce (risk 16).
20. **Path S shows the explorer link early.** The hash exists after signing, before the broadcast. The link can say "not found" for a short time. A failed broadcast shows T3 at once (3.2), so the user can use "Check again".
21. **Claim and NFT keep alerts.** Their result UI differs from the bridge card until a follow-up gives them the 3.2 screens.
22. **Sepolia sends can revert today.** A diagnosis on 2026-10-13 of a failed ptestbridge send found two out-of-gas transactions. Sepolia changed its gas pricing at block 11856337. The fixed `maxGas = 1000000` (`useBridgeController.js:61`) is below the new need (about 1.9 million for `sendTransfer`). The approval limit `maxGas2 = 100000` is also low. This plan does not change gas limits. Until a separate fix lands, ptest sends can end in T4, and manual check 5 can fail. Do not hide T4 to make a check pass. This revision did not repeat the diagnosis. Section 10 makes the gas fix a release dependency for manual checks 5 and 17.
23. **Titles of X14 to X16, and T7, W3, X17.** The preview showed the messages of X14 to X16 only. The titles in 3.2, the screen T7, the two extra W3 texts, and X17 are new in revision 10. The owner has not seen them.
24. **Stored display fields are financial history.** A record keeps amounts, destination addresses, VerusID names, and the wallet name in `localStorage`. Same-origin scripts and every user of the browser profile can read them, and D22 shows them without a connected wallet. The plan bounds the schema, validates it, renders it as text, and deletes resolved records after 30 days (3.2, "Stored fields"). Unresolved records stay, because they are safety records. A person who shares a browser profile can see the last unresolved transfer.
25. **Duplicate form entries.** "New transfer", "Back to bridge", and "Clear" replace `?step=status` with the form. The history can then hold two form entries in a row. This is harmless. Do not use `navigate(-1)`, because the previous entry is not always the form.

## 12. Notes for the implementing agent

- Work on a new branch from `main`, for example `claude/brave-wallet-eip6963`. Do not commit to `main`. A1 can be its own pull request and release. The other steps ship together (section 6).
- In a fresh worktree, run `pnpm install --frozen-lockfile --offline` before `pnpm test`. Without it, pnpm stops with `ERR_PNPM_VERIFY_DEPS_BEFORE_RUN`.
- Commands: `pnpm test`, `pnpm test:testnet`, `pnpm lint`, `pnpm build:ptest`, `pnpm verify`.
- Do not push, open a PR, or deploy without the owner's approval. The three live sites are mainnet, testnet, and ptest. Deploy to ptest first.
- Never print or commit `.env` values.
- For the send screens (phase S), build S1 and S5 with their tests first. S1 fixes the copy. Then S2, S3, S4. Fix the A3 and A5 event interfaces before S2. Compare the result with the [Bridge Send States](https://claude.ai/artifact/3hpu2geTsnxakK8KhHStBD) preview, if it opens for you. The text in 3.2 wins where they differ.
- Phase S needs the A5 records. Do not build a second record store for the screens.
- Reuse existing patterns: CSS modules in `src/styles/ReferenceBridge.module.css`, theme tokens in `src/index.css`, and storage helpers in `src/utils/walletConnection.js`.

## 13. Implementation notes (2026-10-14)

The code on `claude/brave-wallet-eip6963` follows revision 11. These points were decided during the implementation, or they differ from the text above. The owner has not reviewed them yet.

**Decisions inside the plan's scope**

1. **Activity link.** The `/activity` route exists only in testnet builds. T2 shows the quiet action "View bridge activity" only there (`BRIDGE_ACTIVITY_AVAILABLE`). Mainnet T2 shows "New transfer" alone.
2. **W1 without a wallet name.** "Check the your wallet window" does not read well. Without an announced name, W1 says "Check your wallet and confirm the transaction."
3. **X18.** A build without a valid site RPC URL (D19) cannot track or broadcast. Confirm then stops before any wallet request with the blocking notice X18: "This site is not set up to send transactions. Nothing was sent."
4. **Copy direction.** `sendScreens.js` holds every string. `guardedSend.js`, `operationLock.js`, `submittedOperations.js`, and the connector import their messages from it. So `sendScreens.js` does not import the classifier from `guardedSend.js` (S1 says it does), because that import would be circular. The classifier stays the only one (D23).
5. **Gas estimates.** `guardedSend` estimates gas through the site RPC provider, with the 30 % margin and the old fixed limits as floors (the gas fix, risk 22).
6. **Claim and NFT results.** They use one shared guarded operation (`utils/guardedOperation.js`) and show their states in their own status lines, with an explorer link (risk 21). A step without an outcome after 240 s shows the "No confirmation yet" text. NFT sends read the approval back through the site RPC (A4).

**Differences from the text**

7. **New transfer resets the receive currency.** 3.2 says that New transfer keeps the chosen currencies. The form lists receive currencies only after an address is entered, so clearing the address also clears the receive currency. The send currency stays. To keep both, the destination list must stop depending on the address. That is a form change outside this plan.
8. **Notices on the form.** A notice whose main action is `confirm` (N1), or a blocking notice, can reach the form when the review closes. On the form there is no review to confirm, so its main button says "Review" (enabled when the inputs are valid, or disabled for a blocking notice). N6 keeps "Bridge paused".
9. **Edits end notices.** A change of the inputs, the account, or the network ends the notice of the last stop. N3, X1, and X17 stay until the next review, because a session change causes them.

**Behavior found in the browser check**

10. **Router timing.** React Router 7 finishes a navigation asynchronously. One render then showed the old step with the new send state: the form flashed, and focus was lost. The page now renders the step that it navigates to until the router catches up.
11. **Rejected request.** The records store resolves a rejected or discarded request a moment before the flow ends. The wallet screen now stays until the notice replaces it.
12. **StrictMode.** The development build runs effects twice. Route decisions read the pending step from a ref, so a reload at `?step=status` keeps the restored screen.

**Not verified**

- No real wallet was used. The browser check used a test-only EIP-1193 provider and a scripted chain in the page, on the testnet build. It covered W1, T1, T2 with its animation, N1, N8, X1, T4, T3 after a reload, Check again, Back to bridge, New transfer, Try again, 320 px, and both themes.
- Section 9 (manual checks with MetaMask and Brave Wallet) is still open. So are W2, C1, W3, T5, T6, X14 to X16 in a browser. The automated tests cover their selection and copy.

