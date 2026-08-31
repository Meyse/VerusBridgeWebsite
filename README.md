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

- The command selects an explicit `mainnet` or `testnet` build profile. Network selection is not a runtime toggle.
- The testnet profile is pinned to Sepolia chain ID `11155111`, delegator `0xCaA98A4eC79dAC8A06Cb3BfDcF5351b6576d939f`, and `https://api.verustest.net` for VRSCTEST.
- `REACT_APP_RPC_URL_SEPOLIA` provides read-only Sepolia access for the testnet build. `REACT_APP_RPC_URL_MAINNET` provides read-only Ethereum access for mainnet.
- `REACT_APP_DELEGATOR_CONTRACT` and `REACT_APP_VERUS_RPC_URL` configure only the mainnet profile. Transaction submission fails closed when the wallet is on another chain, the address is invalid, or no contract code exists at that address.
- `REACT_APP_VERUS_END_BLOCK` retains the existing bridge synchronization configuration.
- `REACT_APP_SEARCH_INDEXING_ENABLED` defaults to `false`. Local, Antafri community-review, and testnet builds must keep it disabled.
- `REACT_APP_PUBLIC_SITE_URL` is used only by an explicitly indexable official build. The build rejects indexing for testnet or any origin other than `https://eth.verusbridge.io`.

## Commands

```sh
pnpm start          # mainnet Vite server on http://localhost:5173
pnpm start:testnet  # Sepolia/VRSCTEST Vite server on http://localhost:5173
pnpm test           # complete Vitest suite
pnpm test:watch     # interactive test runner
pnpm lint           # ESLint with zero warnings
pnpm build          # mainnet production output in build/
pnpm build:testnet  # Sepolia/VRSCTEST production output in build/
pnpm preview        # serve the production build locally
pnpm verify         # lint, tests, both production builds, and advisory gate
```

CI uses `pnpm install --frozen-lockfile` and rejects moderate, high, or critical dependency advisories. See `docs/security-modernization-2026-08-27.md` for migration evidence, dependency exceptions, and the remaining low-severity advisory.

## Dependency updates

Dependabot checks npm packages and GitHub Actions weekly. Routine dependencies are delayed by pnpm's 24-hour minimum release age and no-downgrade trust policy. For an urgent security patch, review the exact package and provenance, update with `pnpm install --config.minimum-release-age=0`, then restore the normal policy and run a frozen install plus `pnpm verify` before committing.

Major upgrades to ethers or Web3 React require focused wallet-boundary regression testing; they are documented compatibility exceptions rather than unattended updates.

## Deployment

Deploy the static contents of `build/`. Production security headers belong in the actual hosting configuration; this repository does not assume a specific host.

### Internal and community-review deployments

The ordinary build commands fail closed for search indexing:

```sh
pnpm build
pnpm build:testnet
```

Both builds emit `noindex, nofollow` metadata, a crawlable `robots.txt` without a sitemap, and no `sitemap.xml`. This is the intended configuration for `bridge.antafri.com`, `testbridge.antafri.com`, local previews, and any other non-official host.

Do not add `Disallow: /` to `robots.txt`: crawlers must be able to fetch the HTML to see `noindex`. As a hosting-level defense in depth, non-official HTML responses may also send:

```text
X-Robots-Tag: noindex, nofollow
```

That header is not access control. Use authentication or an access gateway if a review deployment must be private.

### Official-domain release

Only the official mainnet release may opt into search indexing. Build it explicitly:

```sh
REACT_APP_PUBLIC_SITE_URL=https://eth.verusbridge.io \
REACT_APP_SEARCH_INDEXING_ENABLED=true \
pnpm build
```

The opt-in build fails unless it is a mainnet build for the exact official origin. It generates:

- `index.html`, `claim.html`, and `nft.html` with distinct titles, descriptions, canonical URLs, and Open Graph metadata;
- `robots.txt` with the official sitemap location;
- `sitemap.xml` containing `/`, `/claim`, and `/nft`.

Configure the official host to serve the generated route documents without changing the browser-visible URLs:

| Request path | Static file | Status |
| --- | --- | --- |
| `/` | `index.html` | `200` |
| `/claim` | `claim.html` | `200` |
| `/nft` | `nft.html` | `200` |
| Any other application path | A real not-found response | `404` |

Do not use a catch-all `200` fallback on the official host, and make sure no inherited `X-Robots-Tag: noindex` header remains. Before release, inspect all three live pages and confirm their `robots`, canonical, title, and description values; confirm `/robots.txt` and `/sitemap.xml` return their expected content types; and confirm an unknown URL returns `404`. Then verify the official domain in Google Search Console and submit `https://eth.verusbridge.io/sitemap.xml`.

The testnet build is for test assets only. Its final transaction path must be verified by a user-controlled MetaMask wallet on Sepolia; local checks do not prove a cross-chain transfer completed.
