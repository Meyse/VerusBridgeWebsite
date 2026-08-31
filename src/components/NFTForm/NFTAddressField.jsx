import React from 'react';

import FormHelperText from '@mui/material/FormHelperText';

import InputControlField from 'components/InputControlField';
import { isVerusIdName } from 'utils/verusDestination';
import { validateNFTAddress } from 'utils/rules';

const AddressField = ({
  addressResolutionError = '',
  addressResolutionMessage = '',
  control
}) => {
  const resolutionFeedback = addressResolutionError || addressResolutionMessage;

  return (
    <>
      <InputControlField
        name="address"
        label="Destination"
        fullWidth
        variant="standard"
        defaultValue=""
        control={control}
        helperText={resolutionFeedback ? null : 'VerusID ending in @, i-address, or R-address'}
        rules={{
          required: 'Destination is required',
          validate: (value) => (isVerusIdName(value) ? true : validateNFTAddress(value))
        }}
      />
      {resolutionFeedback ? (
        <FormHelperText
          error={Boolean(addressResolutionError)}
          role={addressResolutionError ? 'alert' : 'status'}
          sx={{ fontSize: 10, mt: 0.5 }}
        >
          {resolutionFeedback}
        </FormHelperText>
      ) : null}
    </>
  );
};

export default AddressField;
