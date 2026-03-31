import React from 'react';

import { render, screen } from '@testing-library/react';

import ReferenceInfoBar from './ReferenceInfoBar';

describe('ReferenceInfoBar', () => {
  test('renders fiat before ETH without parentheses', () => {
    render(
      <ReferenceInfoBar
        baseBridgeFee={0.003}
        bounceBackFee={0.013}
        ethUsdPrice={2100}
        notarizationHeight={123456}
        notarizationLagBlocks={4}
        notarizationLagSeconds={7260}
        verusTipHeight={123460}
      />
    );

    const feeValue = screen.getByText('$6.30').parentElement;

    expect(screen.queryByText('($6.30)')).not.toBeInTheDocument();
    expect(feeValue).not.toBeNull();
    expect(feeValue.textContent.indexOf('$6.30')).toBeLessThan(feeValue.textContent.indexOf('0.0030 ETH'));
  });

  test('stores notarization tooltip content on the activity chip', () => {
    render(
      <ReferenceInfoBar
        baseBridgeFee={0.003}
        bounceBackFee={0.013}
        ethUsdPrice={2100}
        notarizationHeight={123456}
        notarizationLagBlocks={4}
        notarizationLagSeconds={7260}
        verusTipHeight={123460}
      />
    );

    expect(screen.getByText(/last confirmed bridge notarization:/i).closest('div')).toHaveAttribute(
      'data-tooltip',
      'Notarization block: 123,456\nVerus tip: 123,460\n4 blocks behind'
    );
  });
});
