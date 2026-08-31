import React from 'react';

import { render, screen } from '@testing-library/react';

import AddressField from './NFTAddressField';

let capturedFieldProps;

vi.mock('components/InputControlField', () => ({
  default: (props) => {
    capturedFieldProps = props;
    return <input aria-label={props.label} />;
  }
}));

describe('NFTAddressField', () => {
  test('accepts a VerusID name for asynchronous resolution', () => {
    render(<AddressField control={{}} />);

    expect(capturedFieldProps.rules.validate('Max@')).toBe(true);
    expect(capturedFieldProps.rules.validate('not-an-address')).toBe('Address is not valid');
    expect(capturedFieldProps.helperText).toContain('VerusID ending in @');
  });

  test('shows resolution feedback with the appropriate accessible role', () => {
    const { rerender } = render(
      <AddressField
        addressResolutionMessage="Max.VRSC@ resolves to iEqZ9A9bbsPkP7yJMSqJdqa2BdpxxngzKX."
        control={{}}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Max.VRSC@ resolves to');

    rerender(
      <AddressField
        addressResolutionError="VerusID not found on VRSC."
        control={{}}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('VerusID not found on VRSC.');
  });
});
