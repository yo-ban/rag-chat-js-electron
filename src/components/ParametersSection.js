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
  marginTop: theme.spacing(3),
}));

const StyledSliderBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(3),
}));

const StyledGridSlider = styled(Grid)(({ theme }) => ({
  paddingRight: theme.spacing(1),
}));

const StyledGridText = styled(Grid)(({ theme }) => ({
  paddingLeft: theme.spacing(4),
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiInputBase-input': {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
  },
}));

const StyledLabel = styled(Grid)(({ theme }) => ({
  width: '160px',
}));

const StyledSlider = styled(Slider)(({ theme }) =>({
  marginRight: theme.spacing(2)
}));

const ParametersSection = ({
  temperature,
  setTemperature,
  maxTokens,
  setMaxTokens,
  maxHistoryLength,
  setMaxHistoryLength,
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

  const handleMaxHistoryLengthSliderChange = (event, newValue) => {
    setMaxHistoryLength(newValue);
  };

  const handleMaxHistoryLengthInputChange = (event) => {
    setMaxHistoryLength(event.target.value === '' ? '' : Number(event.target.value));
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
        <Grid container alignItems="center" spacing={2}>
          <StyledLabel item>
            <Tooltip title={t('temperatureTooltip')} arrow placement="top">
              <Typography variant="body2" id="temperature-slider">
                {t('temperature')}
              </Typography>
            </Tooltip>
          </StyledLabel>
          <StyledGridSlider item xs>
            <StyledSlider
              value={temperature}
              min={0}
              max={1}
              step={0.1}
              onChange={handleTemperatureSliderChange}
              aria-labelledby="temperature-slider"
              valueLabelDisplay="auto"
            />
          </StyledGridSlider>
          <StyledGridText item>
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
          </StyledGridText>
        </Grid>
      </StyledSliderBox>

      <StyledBox>
        <Grid container alignItems="center" spacing={2}>
          <StyledLabel item>
            <Tooltip title={t('maxTokensTooltip')} arrow placement="top">
              <Typography variant="body2" id="max-tokens-slider">
                {t('maxTokens')}
              </Typography>
            </Tooltip>
          </StyledLabel>
          <StyledGridSlider item xs>
            <StyledSlider
              value={maxTokens}
              min={256}
              max={4096}
              step={256}
              onChange={handleMaxTokensSliderChange}
              aria-labelledby="max-tokens-slider"
              valueLabelDisplay="auto"
            />
          </StyledGridSlider>
          <StyledGridText item>
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
          </StyledGridText>
        </Grid>
      </StyledBox>

      <StyledBox>
        <Grid container alignItems="center" spacing={2}>
          <StyledLabel item>
            <Tooltip title={t('historyLengthTooltip')} arrow placement="top">
              <Typography variant="body2" id="history-length-slider">
                {t('historyLength')}
              </Typography>
            </Tooltip>
          </StyledLabel>
          <StyledGridSlider item xs>
            <StyledSlider
              value={maxHistoryLength}
              min={0}
              max={20}
              step={1}
              onChange={handleMaxHistoryLengthSliderChange}
              aria-labelledby="history-length-slider"
              valueLabelDisplay="auto"
            />
          </StyledGridSlider>
          <StyledGridText item>
            <Stack direction="row" alignItems="center" justifyContent="flex-end">
              <StyledTextField
                value={maxHistoryLength}
                onChange={handleMaxHistoryLengthInputChange}
                type="number"
                inputProps={{
                  min: 0,
                  max: 20,
                  step: 1,
                }}
                sx={{ width: '80px' }}
              />
            </Stack>
          </StyledGridText>
        </Grid>
      </StyledBox>

      <StyledBox>
        <Grid container alignItems="center" spacing={2}>
          <StyledLabel item>
            <Tooltip title={t('searchResultsLimitTooltip')} arrow placement="top">
              <Typography variant="body2" id="search-results-limit-slider">
                {t('searchResultsLimit')}
              </Typography>
            </Tooltip>
          </StyledLabel>
          <StyledGridSlider item xs>
            <StyledSlider
              value={searchResultsLimit}
              min={1}
              max={10}
              step={1}
              onChange={handleSearchResultsLimitSliderChange}
              aria-labelledby="search-results-limit-slider"
              valueLabelDisplay="auto"
            />
          </StyledGridSlider>
          <StyledGridText item>
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
          </StyledGridText>
        </Grid>
      </StyledBox>
    </div>
  );
};

export default ParametersSection;
