# Verus Bridge Website

Client-rendered Verus-Ethereum bridge website. The application prepares bridge requests and delegates every private-key operation to the connected browser wallet.

## Requirements

- Node.js 24.19.0
- pnpm 11.24.0 through Corepack

Both versions are pinned in `.nvmrc` and `package.json`. Yarn and npm lockfiles are intentionally unsupported.

```sh
nvm use
corepack enable pnpm
pnpm --version
pnpm install --frozen-lockfile
```

## Environment

Copy `.env.example` to `.env` and replace the placeholder RPC project identifier. Vite deliberately preserves the existing `REACT_APP_*` names so deployment environments do not need to rename variables during this migration.

The values are embedded in the browser bundle. Never put secrets in these variables.

- `REACT_APP_TESTNET_ACTIVE=true` selects Sepolia (chain ID 11155111); `false` selects Ethereum mainnet (chain ID 1).
- `REACT_APP_DELEGATOR_CONTRACT` must be the bridge delegator deployed on the selected chain. Transaction submission fails closed when the wallet is on another chain, the address is invalid, or no contract code exists at that address.
- `REACT_APP_RPC_URL_SEPOLIA` and `REACT_APP_RPC_URL_MAINNET` provide read-only Ethereum RPC access.
- `REACT_APP_VERUS_RPC_URL` provides read-only Verus RPC access.
- `REACT_APP_VERUS_END_BLOCK` retains the existing bridge synchronization configuration.

## Commands

```sh
pnpm start       # local Vite server on http://localhost:5173
pnpm test        # complete Vitest suite
pnpm test:watch  # interactive test runner
pnpm lint        # ESLint with zero warnings
pnpm build       # production output in build/
pnpm preview     # serve the production build locally
pnpm verify      # lint, tests, production build, and advisory gate
```

CI uses `pnpm install --frozen-lockfile` and rejects moderate, high, or critical dependency advisories. See `docs/security-modernization-2026-08-27.md` for migration evidence, dependency exceptions, and the remaining low-severity advisory.

## Dependency updates

Dependabot checks npm packages and GitHub Actions weekly. Routine dependencies are delayed by pnpm's 24-hour minimum release age and no-downgrade trust policy. For an urgent security patch, review the exact package and provenance, update with `pnpm install --config.minimum-release-age=0`, then restore the normal policy and run a frozen install plus `pnpm verify` before committing.

Major upgrades to ethers or Web3 React require focused wallet-boundary regression testing; they are documented compatibility exceptions rather than unattended updates.

## Deployment

Deploy the static contents of `build/` and configure the host to fall back to `index.html` for client-side routes such as `/claim` and `/nft`. Production security headers belong in the actual hosting configuration; this repository does not assume a specific host.

The live bridge and MetaMask transaction flow are currently unavailable and must not be tested with production calls or real funds. Use the unit/integration fixtures and local browser smoke test described in the migration report.
