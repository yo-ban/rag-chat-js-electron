import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';  
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  TextField, 
  Collapse, 
  Typography, 
  Slider, 
  Grid, 
  Box, 
  Stack,
  Tooltip 
} from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    width: '65%',
    minWidth: '400px',
    maxWidth: 'none',
  },
}));

const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
  minWidth: '100%',
}));

const StyledFormControl = styled(FormControl)(({ theme }) => ({
  margin: theme.spacing(2, 0),
}));

const StyledInputLabel = styled(InputLabel)(({ theme }) => ({
  zIndex: 1,
  backgroundColor: theme.palette.mode === 'dark' ? '#424242' : '#fff',
  padding: '0 4px',
}));

const StyledSliderBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

const StyledGridItem = styled(Grid)(({ theme }) => ({
  paddingRight: theme.spacing(1),
}));

const CreateChatDialog = ({ open, onClose, databases, onCreate, defaultTemperature, defaultMaxTokens, defaultSearchResultsLimit, defaultMaxHistoryLength }) => {
  const { t } = useTranslation();

  const [selectedDatabase, setSelectedDatabase] = useState('None');
  const [chatName, setChatName] = useState(t('newChat'));
  const [temperature, setTemperature] = useState(0.5);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [maxHistoryLength, setMaxHistoryLength] = useState(6);
  const [searchResultsLimit, setSearchResultsLimit] = useState(6);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (open) {
      setTemperature(defaultTemperature);
      setMaxTokens(defaultMaxTokens);
      setSearchResultsLimit(defaultSearchResultsLimit);
      setMaxHistoryLength(defaultMaxHistoryLength);
    }
  }, [open, defaultTemperature, defaultMaxTokens, defaultSearchResultsLimit, defaultMaxHistoryLength]);

  const handleDatabaseSelect = useCallback((event) => {
    setSelectedDatabase(event.target.value);
  }, []);

  const handleCreateNewChat = useCallback(() => {
    const chatConfig = {
      name: chatName,
      temperature: parseFloat(temperature),
      maxTokens: parseInt(maxTokens, 10),
      searchResultsLimit: parseInt(searchResultsLimit, 10),
      maxHistoryLength: parseInt(maxHistoryLength, 10)
    };
    onCreate(selectedDatabase === 'None' ? null : selectedDatabase, chatConfig);
    onClose();
  }, [selectedDatabase, chatName, temperature, maxTokens, searchResultsLimit, maxHistoryLength, onCreate, onClose]);

  const toggleAdvancedSettings = () => {
    setShowAdvanced(!showAdvanced);
  };

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

  return (
    <StyledDialog open={open} onClose={onClose}>
      <DialogTitle>{t('newChat')}</DialogTitle>
      <StyledDialogContent>
        <TextField
          label={t('chatNameInput')}
          value={chatName}
          onChange={(e) => setChatName(e.target.value)}
          fullWidth
          margin="normal"
        />
        <StyledFormControl fullWidth>
          <StyledInputLabel id="db-select-label">{t('selectDatabase')}</StyledInputLabel>
          <Select
            labelId="db-select-label"
            id="db-select"
            value={selectedDatabase}
            onChange={handleDatabaseSelect}
          >
            {databases.map((dbName) => (
              <MenuItem key={dbName} value={dbName}>
                {dbName}
              </MenuItem>
            ))}
            <MenuItem value="None">{t('none')}</MenuItem>
          </Select>
        </StyledFormControl>
        <Button onClick={toggleAdvancedSettings}>
          {showAdvanced ? t('hideAdvancedSettings') : t('showAdvancedSettings')}
        </Button>
        <Collapse in={showAdvanced}>
          <StyledSliderBox>
            <Typography id="temperature-slider" gutterBottom>
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
                  <TextField
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
          <StyledSliderBox>
            <Typography id="max-tokens-slider" gutterBottom>
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
                  <TextField
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
          </StyledSliderBox>
        </Collapse>
      </StyledDialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={handleCreateNewChat}>{t('create')}</Button>
      </DialogActions>
    </StyledDialog>
  );
};

export default CreateChatDialog;
