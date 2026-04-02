import React from 'react';

import { LoadingButton } from '@mui/lab';
import { Alert, Switch } from '@mui/material';
import { Link } from 'react-router-dom';

import SiteFooter from 'components/SiteFooter';
import SiteHeader from 'components/SiteHeader';
import useClaimController from 'hooks/useClaimController';
import formStyles from 'styles/Forms.module.css';

import styles from '../styles/ReferenceBridge.module.css';

const Claim = () => {
  const controller = useClaimController();

  return (
    <div className={styles.page}>
      <SiteHeader />

      <main className={styles.secondaryMain}>
        <div className={styles.secondaryContent}>
          <div className={styles.titleWrap}>
            <h1 className={styles.title}>Claim / Refunds</h1>
            <p className={styles.supportingText}>
              Recover claimable bridge fees or refund balances without leaving the bridge interface.
            </p>
          </div>

          <div className={styles.secondaryCard}>
            {controller.alert ? <Alert severity={controller.alert.severity}>{controller.alert.message}</Alert> : null}

            <div className={formStyles.stack} style={{ marginTop: controller.alert ? 20 : 0 }}>
              <div className={formStyles.panel}>
                <div className={formStyles.panelHeader}>
                  <span className={formStyles.panelLabel}>Destination</span>
                </div>
                <input
                  className={formStyles.textInput}
                  disabled={controller.usePublicKey}
                  onChange={(event) => controller.setAddress(event.target.value)}
                  placeholder="Your R-address or i-address"
                  type="text"
                  value={controller.address}
                />
                {controller.addressError ? (
                  <p className={formStyles.errorText}>{controller.addressError}</p>
                ) : (
                  <p className={formStyles.helperText}>
                    Standard claim and refund flows accept Verus R-addresses and i-addresses.
                  </p>
                )}
              </div>

              {controller.claimRefund ? (
                <div className={formStyles.panel}>
                  <div className={formStyles.panelHeader}>
                    <span className={formStyles.panelLabel}>Refund currency</span>
                  </div>
                  <select
                    className={formStyles.selectInput}
                    onChange={(event) => controller.selectRefundCurrency(event.target.value)}
                    value={controller.refundCurrency}
                  >
                    <option value="">Select refund currency</option>
                    {controller.tokenOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className={formStyles.toggleGrid}>
                <div className={formStyles.toggleCard}>
                  <div>
                    <span className={formStyles.toggleTitle}>Use your public key to claim</span>
                    <span className={formStyles.toggleDescription}>
                      Best when the private key behind the refund address is already imported into MetaMask.
                    </span>
                  </div>
                  <Switch
                    checked={controller.usePublicKey}
                    onChange={(event) => controller.setUsePublicKey(event.target.checked)}
                  />
                </div>

                <div className={formStyles.toggleCard}>
                  <div>
                    <span className={formStyles.toggleTitle}>Claim a refund balance</span>
                    <span className={formStyles.toggleDescription}>
                      Toggle this on to inspect refund balances instead of claimable fee reimbursements.
                    </span>
                  </div>
                  <Switch
                    checked={controller.claimRefund}
                    onChange={(event) => controller.setClaimRefund(event.target.checked)}
                  />
                </div>
              </div>

              {controller.feeToClaim ? (
                <div className={formStyles.noticeRow}>
                  Claimable amount: <strong>{controller.feeToClaim}</strong>
                </div>
              ) : null}

              <LoadingButton
                disableElevation
                fullWidth
                loading={controller.isTxPending}
                onClick={controller.handleSubmit}
                size="large"
                sx={{
                  borderRadius: '20px',
                  minHeight: '58px',
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: 700
                }}
                variant="contained"
                disabled={!controller.canSubmit}
              >
                {controller.submitLabel}
              </LoadingButton>
            </div>

            <div className={styles.secondaryActions}>
              <Link className={styles.secondaryLink} to="/">
                Back to bridge
              </Link>
              <Link className={styles.secondaryLink} to="/nft">
                NFT bridge
              </Link>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Claim;
