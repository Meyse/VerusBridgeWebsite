# Dependency and Security Modernization Report

Date: 2026-08-27

Branch: `codex/pnpm-security-modernization`

Base: `redesign` at `97a7a90993e2e45a96dc9c203a006577f62da5a6`

## Outcome

The website now uses one reproducible toolchain: Node.js 24.19.0, pnpm 11.24.0, Vite 8, Vitest 4, React 19, and ESLint 10. Yarn, Create React App 4, `react-app-rewired`, webpack 4, and the OpenSSL legacy-provider workaround have been removed. A clean frozen install, lint, 166 tests, production build, dependency audit gate, and local browser smoke test passed.

The original audit lead contained 189 unique advisories: 15 critical, 85 high, 65 moderate, and 24 low. Those figures described the old dependency graph, not 189 proven runtime vulnerabilities. The final graph has no known critical, high, or moderate advisories. One unpatched low-severity `elliptic` advisory remains transitively through ethers 5; its reachability and exception are documented below.

No live bridge request, production RPC call, MetaMask transaction, or real-funds flow was tested. The bridge was down, so live-wallet compatibility remains explicitly unverified.

## Commits

- `8ef96ba` — `build: migrate dependency stack to pnpm and Vite`
- `3af8c15` — `security: bind wallet actions to configured deployment`
- `6b47ba8` — `build: harden clean installs and verification`
- The report is committed separately so the implementation commits remain reviewable.

## Reproducible runtime and package management

- Node.js is pinned exactly to 24.19.0 in `.nvmrc` and `package.json`.
- pnpm is pinned exactly to 11.24.0 in `packageManager` and `engines.pnpm`.
- `pnpm-lock.yaml` is committed and CI installs it with `--frozen-lockfile`.
- pnpm uses its normal isolated dependency layout. No hoisting compatibility escape hatch is enabled.
- The Yarn v1 lockfile, vendored Yarn Classic executable, Yarn install state, and `.yarnrc.yml` have been removed.
- Unsupported Yarn PnP files and alternate lockfiles are not ignored, so introducing them is visible in Git review.
- `package.json`, documentation, CI, and ignore files no longer provide a Yarn workflow.

The legacy baseline was captured before migration: the frozen Yarn graph installed under Node 18, all 14 suites and 132 tests passed, and the production build succeeded only with the OpenSSL legacy-provider workaround. The old build emitted roughly 1.25 MB of gzipped JavaScript across its principal vendor and application bundles.

## Build and test stack

The client-rendered static application now builds with Vite and writes to the existing `build/` deployment directory. Vite preserves the repository's existing `REACT_APP_*` environment-variable names and the HTML entry preserves public asset behavior. Client-side routes continue to require the production host to fall back to `index.html`.

Vitest and Testing Library replace the CRA test runner. ESLint uses the maintained flat configuration. The browser `Buffer` and `events` compatibility requirements are explicit dependencies and Vite aliases rather than hidden transitive or webpack-provided globals.

The final production build emitted:

- `index.html`: 0.72 kB, 0.37 kB gzip
- CSS: 47.59 kB, 9.51 kB gzip
- bootstrap JavaScript: 29.53 kB, 9.40 kB gzip
- application JavaScript: 1,094.77 kB, 346.90 kB gzip

Vite reports the application chunk as large. This is a performance warning, not a correctness or security failure; route-level splitting was not introduced because that would be unrelated product refactoring.

## Dependency disposition

Direct runtime and development dependencies are exact-version pins. Registry-backed direct dependencies were checked against the registry after migration. All are on the current stable release except these deliberate compatibility exceptions:

| Package | Pinned | Newer major | Reason and control |
| --- | ---: | ---: | --- |
| `@web3-react/core` | 6.1.9 | 8.2.3 | Version 8 is a different connector and provider architecture. A piecemeal upgrade would change the wallet boundary. Major updates are excluded from unattended Dependabot updates and require focused wallet regression testing. |
| `ethers` | 5.8.0 | 6.17.0 | The current Web3 React v6 integrations and contract call sites use the ethers v5 API. Version 6 requires a coordinated wallet/API migration. Major updates are excluded from unattended Dependabot updates and the remaining low advisory is tracked below. |

The following unnecessary or superseded direct declarations were removed: `@bitgo/utxo-lib`, `@ethersproject/constants`, `@ethersproject/contracts`, `@ethersproject/providers`, `@metamask/eth-sig-util`, `@mui/icons-material`, `@mui/lab`, `@testing-library/user-event`, `bitcoin-ops`, CRA-specific ESLint packages, `react-app-rewired`, `react-scripts`, `swr`, `verusd-rpc-ts-client`, `web-vitals`, `web3`, and `web3-eth-abi`.

Phantom imports were resolved rather than masked by hoisting. The remaining code no longer imports `@mui/system` or `@ethersproject/address` directly. All Git dependencies have been eliminated, so there are no mutable Git branch references or unreviewed Git package build steps in the final graph.

## Vendored and dormant code

The checked-in 1.29 MB Browserify bundle at `src/utils/bitUTXO.js` was removed. Its reachable responsibility was Verus address Base58Check encoding and validation; that behavior now uses the managed `bs58check` and `buffer` modules through a small `verusAddress` utility with golden tests. The old bundled elliptic 6.5.4 implementation is no longer shipped.

The dormant `src/utils/sign.js` was proven unused and removed. It had undeclared legacy crypto imports, logged signature material, and referenced an undefined public key. Private-key signing remains delegated to the connected wallet.

Unused legacy form, statistics, checkout, and test files that depended on the retired stack were removed only after caller tracing showed they were unreachable from the current routed product.

The Verus RPC wrapper is now a small local module that preserves the expected JSON-RPC request and response shape. It rejects a missing or invalid configured URL before `fetch`, preventing an accidental same-origin RPC request.

## Security remediation

### Wallet and deployment binding

- The expected Ethereum chain is derived from the selected build: chain ID 1 for mainnet or 11155111 for Sepolia.
- The injected wallet connector advertises only that chain.
- Immediately before each approval, bridge transfer, fee payment, and refund claim, the application re-reads `eth_chainId`, validates the configured delegator address, and verifies that deployed bytecode exists at that address.
- ERC-20, ERC-721, and ERC-1155 approval targets now consistently use the configured delegator. The prior ERC-1155 indexed-contract target mismatch is gone.
- Explorer links and the trust/reference UI use the same configured deployment address rather than an unrelated hard-coded contract.

These checks prevent the application from silently constructing a transaction for the wrong configured chain or an empty/non-contract target. They do not replace the wallet confirmation screen; users must still verify the chain, address, asset, amount, and fee shown by the wallet.

### Input and RPC hardening

- The exclusion list is statically bundled, schema-checked, entry-validated, normalized, and fails closed when malformed.
- Verus address encoding and validation are covered by managed-code golden tests.
- Ethereum quantity conversion and bridge fee/value calculations use focused tests, including tiny and large values.
- The read-only network connector accepts only the selected build chain and valid HTTP(S) RPC URLs. A missing RPC URL disables the connector rather than falling back to the page origin.

### Development-server disclosure

Replacing CRA 4's vulnerable webpack development server with Vite removes the confirmed legacy source-disclosure path from the dependency graph. The development server is bound to `localhost` by default. It remains a developer tool and must not be exposed as a production server.

## Durable dependency controls

- CI has read-only repository permissions and uses immutable commit SHAs for GitHub Actions.
- CI runs a frozen install, lint, the complete test suite, production build, and an audit gate.
- `pnpm audit --audit-level=moderate` blocks moderate, high, and critical advisories.
- pnpm enforces a 24-hour minimum package release age, strict release-time handling, a no-downgrade trust policy, exotic-subdependency blocking, dependency verification before scripts run, and strict dependency-build declarations.
- Only `esbuild` is approved to run its install build. Optional native `bufferutil` and `utf-8-validate` builds are explicitly denied.
- The lockfile overrides `ws` to 8.21.3.
- Dependabot checks npm dependencies and GitHub Actions weekly. Only the two coordinated wallet-boundary major migrations are excluded from unattended updates.
- The README documents an explicit, reviewed way to bypass the release-age delay for an urgent security fix, followed by a normal frozen install and complete verification.

Production response headers are outside this static source repository. The deployment owner should configure and verify a host-appropriate Content Security Policy, clickjacking protection, MIME sniffing protection, referrer policy, permissions policy, and HTTPS/HSTS without blocking the selected RPC origins or wallet integration.

## Verification evidence

All final commands used the pinned Node.js 24.19.0 and pnpm 11.24.0 runtimes.

| Check | Result |
| --- | --- |
| Clean `pnpm install --frozen-lockfile` | Passed from a removed/recreated `node_modules`; dependency build policy was enforced. |
| `pnpm lint` | Passed with zero warnings. |
| `pnpm test` | Passed: 19 files, 166 tests. |
| Focused bridge/codec suite | Passed: 110 tests. |
| Repeated timing-sensitive bridge quote test | Passed 20 consecutive runs after correcting the test harness ordering. |
| `pnpm build` | Passed; output written to `build/`. |
| `pnpm run audit:ci` | Passed: no moderate, high, or critical advisories. |
| Local production-preview smoke | `/`, `/claim`, and `/nft` rendered while disconnected, with no browser console errors or warnings. No wallet or transaction was invoked. |
| Final implementation diff security scan | Complete coverage, 68 review items closed, zero reportable findings, no deferred items. |
| Independent focused reviews | Dependency/build, wallet-boundary, and bridge/codec reviews reported no remaining candidates. |

The final Codex Security diff scan covered `97a7a90993e2e45a96dc9c203a006577f62da5a6` through `6b47ba8bd9d61c6858a54876a8ef2e97c4a8f540` under scan ID `63014c5f-9277-4ec4-a758-ca9e4e348899`. Its explicit exclusions were live bridge/MetaMask transaction execution and host-specific production response headers.

## Residual advisory and limitations

`pnpm audit` reports one low-severity advisory: GHSA-848j-6mx2-7j84 affects `elliptic` versions through 6.6.1, and no patched `elliptic` release is available in the audited registry graph. It is reachable through ethers 5 signing-key modules. This application uses the affected path for public-key and signature recovery, not local private-key signing; private keys remain in the wallet. Removing the advisory requires the coordinated ethers/Web3 React wallet migration described above. The moderate audit gate deliberately does not conceal this result, and this report records it until a compatible patched graph exists.

Remaining operational limitations:

- Live MetaMask and bridge compatibility was not tested because the bridge was down. No production transaction or real-funds test was attempted.
- Production host headers, TLS behavior, route fallback, and final environment values must be verified in the actual deployment environment.
- A user can change wallet state between any browser-side preflight and wallet confirmation. The code performs the preflight immediately before submission, while the wallet remains the final authority.
- The configured contract is checked for deployed bytecode, not cryptographic identity with a known bytecode hash. Deployment configuration and the wallet confirmation address remain security-sensitive.
- A repository `SECURITY.md` should be added only after the owner supplies or approves disclosure contacts, response expectations, and authorized testing boundaries.

## Handoff checklist

- [x] pnpm-only repository with exact Node and pnpm pins and committed lockfile
- [x] CRA 4, `react-app-rewired`, webpack 4, and OpenSSL legacy flag removed
- [x] Direct dependencies current, removed, replaced, or precisely excepted
- [x] Git dependencies eliminated and vendored executable/crypto bundle removed
- [x] No known actionable critical or high dependency vulnerabilities
- [x] Frozen clean install, lint, complete tests, production build, audit gate, and local browser smoke passed
- [x] Regression coverage at bridge calculation, address-codec, RPC, exclusion-list, chain, contract, approval, transfer, fee, and refund boundaries
- [x] Live-wallet limitation and residual low advisory documented
