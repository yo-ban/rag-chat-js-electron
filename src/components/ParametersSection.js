import React from 'react';
import { useTranslation } from 'react-i18next';  
import {
  Typography,
  Slider,
  Box,
  Grid,
  TextField,
  Stack,
  Tooltip
} from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

const StyledSliderBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

const StyledGridItem = styled(Grid)(({ theme }) => ({
  paddingRight: theme.spacing(1),
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiInputBase-input': {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
  },
}));

const ParametersSection = ({
  temperature,
  setTemperature,
  maxTokens,
  setMaxTokens,
  searchResultsLimit,
  setSearchResultsLimit
}) => {

  const { t } = useTranslation();

  const handleTemperatureSliderChange = (event, newValue) => {
    setTemperature(newValue);
  };

  const handleTemperatureInputChange = (event) => {
    setTemperature(event.target.value === '' ? '' : Number(event.target.value));
  };

  const handleMaxTokensSliderChange = (event, newValue) => {
    setMaxTokens(newValue);
  };

  const handleMaxTokensInputChange = (event) => {
    setMaxTokens(event.target.value === '' ? '' : Number(event.target.value));
  };

  const handleSearchResultsLimitSliderChange = (event, newValue) => {
    setSearchResultsLimit(newValue);
  };

  const handleSearchResultsLimitInputChange = (event) => {
    setSearchResultsLimit(event.target.value === '' ? '' : Number(event.target.value));
  };

  return (
    <div>
      <Typography variant="subtitle1" gutterBottom>
        {t('parameters')}
      </Typography>

      <StyledSliderBox>
        <Typography variant="body2" id="temperature-slider" gutterBottom>
          <Tooltip title={t('temperatureTooltip')} arrow placement="top">
            <span>{t('temperature')}</span>
          </Tooltip>
        </Typography>
        <Grid container alignItems="center">
          <StyledGridItem item xs={9}>
            <Slider
              value={temperature}
              min={0}
              max={1}
              step={0.1}
              onChange={handleTemperatureSliderChange}
              aria-labelledby="temperature-slider"
              valueLabelDisplay="auto"
            />
          </StyledGridItem>
          <Grid item xs={3}>
            <Stack direction="row" alignItems="center" justifyContent="flex-end">
              <StyledTextField
                value={temperature}
                onChange={handleTemperatureInputChange}
                type="number"
                inputProps={{
                  min: 0,
                  max: 1,
                  step: 0.1,
                }}
                sx={{ width: '80px' }}
              />
            </Stack>
          </Grid>
        </Grid>
      </StyledSliderBox>

      <StyledBox>
        <Typography variant="body2" id="max-tokens-slider" gutterBottom>
          <Tooltip title={t('maxTokensTooltip')} arrow placement="top">
            <span>{t('maxTokens')}</span>
          </Tooltip>
        </Typography>
        <Grid container alignItems="center">
          <StyledGridItem item xs={9}>
            <Slider
              value={maxTokens}
              min={256}
              max={4096}
              step={256}
              onChange={handleMaxTokensSliderChange}
              aria-labelledby="max-tokens-slider"
              valueLabelDisplay="auto"
            />
          </StyledGridItem>
          <Grid item xs={3}>
            <Stack direction="row" alignItems="center" justifyContent="flex-end">
              <StyledTextField
                value={maxTokens}
                onChange={handleMaxTokensInputChange}
                type="number"
                inputProps={{
                  min: 256,
                  max: 4096,
                  step: 256,
                }}
                sx={{ width: '80px' }}
              />
            </Stack>
          </Grid>
        </Grid>
      </StyledBox>

      <StyledBox>
        <Typography variant="body2" id="search-results-limit-slider" gutterBottom>
          <Tooltip title={t('searchResultsLimitTooltip')} arrow placement="top">
            <span>{t('searchResultsLimit')}</span>
          </Tooltip>
        </Typography>
        <Grid container alignItems="center">
          <StyledGridItem item xs={9}>
            <Slider
              value={searchResultsLimit}
              min={1}
              max={10}
              step={1}
              onChange={handleSearchResultsLimitSliderChange}
              aria-labelledby="search-results-limit-slider"
              valueLabelDisplay="auto"
            />
          </StyledGridItem>
          <Grid item xs={3}>
            <Stack direction="row" alignItems="center" justifyContent="flex-end">
              <StyledTextField
                value={searchResultsLimit}
                onChange={handleSearchResultsLimitInputChange}
                type="number"
                inputProps={{
                  min: 1,
                  max: 10,
                  step: 1,
                }}
                sx={{ width: '80px' }}
              />
            </Stack>
          </Grid>
        </Grid>
      </StyledBox>
    </div>
  );
};

export default ParametersSection;
