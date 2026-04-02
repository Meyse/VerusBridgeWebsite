import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import ReferenceInfoBar from './ReferenceInfoBar';

describe('ReferenceInfoBar', () => {
  test('renders fiat before ETH without parentheses', () => {
    render(
      <ReferenceInfoBar
        baseBridgeFee={0.003}
        bounceBackFee={0.013}
        ethUsdPrice={2100}
        notarizationHeight={123456}
        notarizationLagSeconds={7260}
        verusTipHeight={123460}
      />
    );

    const feeValue = screen.getByText('$6.30').parentElement;

    expect(screen.queryByText('($6.30)')).not.toBeInTheDocument();
    expect(feeValue).not.toBeNull();
    expect(feeValue.textContent.indexOf('$6.30')).toBeLessThan(feeValue.textContent.indexOf('0.0030 ETH'));
  });

  test('opens notarization details from the info button instead of hover metadata', () => {
    render(
      <ReferenceInfoBar
        baseBridgeFee={0.003}
        bounceBackFee={0.013}
        ethUsdPrice={2100}
        notarizationHeight={123456}
        notarizationLagSeconds={7260}
        verusTipHeight={123460}
      />
    );

    expect(screen.getByText('~2h 1m ago')).toBeInTheDocument();

    const activityChip = screen.getByText(/last confirmed bridge notarization:/i).closest('div');
    const toggleButton = screen.getByRole('button', {
      name: /show bridge notarization details/i
    });

    expect(activityChip).not.toHaveAttribute('data-tooltip');
    expect(screen.queryByRole('dialog', { name: /bridge notarization details/i })).not.toBeInTheDocument();

    fireEvent.click(toggleButton);

    const dialog = screen.getByRole('dialog', { name: /bridge notarization details/i });

    expect(dialog).toHaveTextContent('Notarization block');
    expect(dialog).toHaveTextContent('123,456');
    expect(dialog).toHaveTextContent('Verus tip');
    expect(dialog).toHaveTextContent('123,460');
    expect(dialog).not.toHaveTextContent(/blocks behind/i);
    expect(dialog).toHaveTextContent(
      'You can see your funds on the Verus side after two confirmed bridge notarizations. If it includes a conversion it might take a few minutes longer.'
    );

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('dialog', { name: /bridge notarization details/i })).not.toBeInTheDocument();
  });
});
