import React, { useState, useEffect } from 'react';
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
  Typography,
  Tabs,
  Tab,
  Box,
  Checkbox,
  FormControlLabel,
  Tooltip,
  Divider,
  Grid,
  IconButton
} from '@mui/material';
import { styled } from '@mui/material/styles';
import AddBoxIcon from '@mui/icons-material/AddBox';
import ParametersSection from './ParametersSection';

const DialogRoot = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    width: '65%',
    maxWidth: 'none',
  },
}));

const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
  width: '100%',
}));

const StyledInputLabel = styled(InputLabel)(({ theme }) => ({
  zIndex: 1,
  backgroundColor: theme.palette.mode === 'dark' ? '#424242' : '#fff',
  padding: '0 4px',
}));

const PlaceholderButton = styled(Button)(({ theme }) => ({
  display: 'inline-flex',
  margin: theme.spacing(0.5, 1),
  padding: theme.spacing(0.5, 1.5),
  fontSize: '0.875rem',
}));

const PreviewBox = styled(Box)(({theme}) => ({
  border: `1px solid ${theme.palette.border.main}`,
  borderRadius: '4px',
  padding: theme.spacing(2),
  whiteSpace: 'pre-wrap'
}));

const StyledPlaceholderContainer = styled(Grid)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'flex-start',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
}));

const CustomTextField = styled(TextField)(({ theme }) => ({
  // marginTop: theme.spacing(2),
  '& .Mui-disabled': {
    color: theme.palette.text.disabled,
  },
  '& .MuiInputBase-input': {
    padding: "12px 12px",
  }
}));

const CustomSelect = styled(Select)(({ theme}) => ({
  '& .MuiInputBase-input': {
    padding: "12px 12px",
  }
}));

const GlobalSettingsDialog = ({
  open,
  onClose,
  onSave,
  initialVender,
  initialEmbeddingsVender,
  initialUseSeparateVenders,
  initialVendors,
  initialEmbeddingsVendors,
  initialSystemPrompt,
  initialTemperature,
  initialMaxTokens,
  initialMaxHistoryLength,
  initialSearchResultsLimit,
  initialLanguage,
  initialVectorDBSavePath,
  initialChatDataSavePath,
}) => {
  const { t, i18n } = useTranslation();

  const [activeTab, setActiveTab] = useState(0);
  const [vender, setVender] = useState(initialVender);
  const [embeddingsVender, setEmbeddingsVender] = useState(initialEmbeddingsVender);
  const [useSeparateVenders, setUseSeparateVenders] = useState(initialUseSeparateVenders);
  const [vendors, setVendors] = useState(initialVendors);
  const [embeddingsVendors, setEmbeddingsVendors] = useState(initialEmbeddingsVendors);
  const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt);
  const [temperature, setTemperature] = useState(initialTemperature);
  const [maxTokens, setMaxTokens] = useState(initialMaxTokens);
  const [maxHistoryLength, setMaxHistoryLength] = useState(initialMaxHistoryLength);
  const [searchResultsLimit, setSearchResultsLimit] = useState(initialSearchResultsLimit);
  const [language, setLanguage] = useState(initialLanguage);
  const [vectorDBSavePath, setVectorDBSavePath] = useState(initialVectorDBSavePath);
  const [chatDataSavePath, setChatDataSavePath] = useState(initialChatDataSavePath);
  const [preview, setPreview] = useState('');

  useEffect(() => {
    setVender(initialVender);
    setEmbeddingsVender(initialEmbeddingsVender);
    setUseSeparateVenders(initialUseSeparateVenders);
    setVendors(initialVendors);
    setEmbeddingsVendors(initialEmbeddingsVendors);
    setSystemPrompt(initialSystemPrompt);
    setTemperature(initialTemperature);
    setMaxTokens(initialMaxTokens);
    setMaxHistoryLength(initialMaxHistoryLength);
    setSearchResultsLimit(initialSearchResultsLimit);
    setLanguage(initialLanguage);
    setVectorDBSavePath(initialVectorDBSavePath);
    setChatDataSavePath(initialChatDataSavePath);
  }, [
    initialVender,
    initialEmbeddingsVender,
    initialUseSeparateVenders,
    initialVendors,
    initialEmbeddingsVendors,
    initialSystemPrompt,
    initialTemperature,
    initialMaxTokens,
    initialMaxHistoryLength,
    initialSearchResultsLimit,
    initialLanguage,
    initialVectorDBSavePath,
    initialChatDataSavePath,
  ]);

  useEffect(() => {
    setPreview(systemPrompt
      .replace('{{DOCUMENTS}}', `${t('systemMessagePlaceholderDummy')}`)
      .replace('{{TOPIC}}', `${t('topicPlaceholderDummy')}`));
  }, [systemPrompt]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleSave = () => {
    onSave(vender, embeddingsVender, useSeparateVenders, vendors, embeddingsVendors, systemPrompt, temperature, maxTokens, maxHistoryLength, searchResultsLimit, language, vectorDBSavePath, chatDataSavePath);
    onClose();
  };

  const handleLanguageChange = (event) => {
    const selectedLanguage = event.target.value;
    setLanguage(selectedLanguage);
    i18n.changeLanguage(selectedLanguage);
  };

  const insertPlaceholder = (placeholder) => {
    setSystemPrompt(systemPrompt + `\n${placeholder}`);
  };

  const handleVenderChange = (event) => {
    setVender(event.target.value);
  };

  const handleEmbeddingsVenderChange = (event) => {
    setEmbeddingsVender(event.target.value);
  };

  const getCurrentVenderSettings = () => vendors[vender] || {};
  const getCurrentEmbeddingsVenderSettings = () => embeddingsVendors[embeddingsVender] || {};

  const currentVenderSettings = getCurrentVenderSettings();
  const currentEmbeddingsVenderSettings = getCurrentEmbeddingsVenderSettings();

  const handleVendorSettingChange = (key, value) => {
    setVendors((prev) => ({
      ...prev,
      [vender]: {
        ...prev[vender],
        [key]: value,
      }
    }));
  };

  const handleEmbeddingsVendorSettingChange = (key, value) => {
    setEmbeddingsVendors((prev) => ({
      ...prev,
      [embeddingsVender]: {
        ...prev[embeddingsVender],
        [key]: value,
      }
    }));
  };

  return (
    <DialogRoot open={open} onClose={onClose}>
      <DialogTitle>{t('settings')}</DialogTitle>
      <DialogContent>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label={t('generalSettings')} />
          <Tab label={t('defaultSystemPromptSettings')} />
          <Tab label={t('defaultParameterSettings')} />
        </Tabs>
        <Box hidden={activeTab !== 0}>
          <StyledDialogContent>
            <Typography variant="subtitle1">{t('applicationSettings')}</Typography>
            <FormControl fullWidth margin="normal">
              <Tooltip title={t('vectorDBSavePathTooltip')} arrow placement="top">
                <StyledInputLabel id="vector-db-save-path-label" shrink>{t('vectorDBSavePath')}</StyledInputLabel>
              </Tooltip>
              <CustomTextField
                fullWidth
                value={vectorDBSavePath}
                onChange={(e) => setVectorDBSavePath(e.target.value)}
              />
            </FormControl>

            <FormControl fullWidth margin="normal">
              <Tooltip title={t('chatDataSavePathTooltip')} arrow placement="top">
                <StyledInputLabel id="chat-data-save-path-label" shrink>{t('chatDataSavePath')}</StyledInputLabel>
              </Tooltip>
              <CustomTextField
                fullWidth
                value={chatDataSavePath}
                onChange={(e) => setChatDataSavePath(e.target.value)}
              />
            </FormControl>

            <FormControl fullWidth margin="normal">
              <StyledInputLabel id="language-label" shrink>{t('language')}</StyledInputLabel>
              <CustomSelect
                labelId="language-label"
                value={language}
                onChange={handleLanguageChange}
              >
                <MenuItem value="ja">日本語</MenuItem>
                <MenuItem value="en">English</MenuItem>
              </CustomSelect>
            </FormControl>

            <Divider style={{ margin: '20px 0' }} />
            
            <Typography variant="subtitle1">{t('apiSettings')}</Typography>
            <FormControl fullWidth margin="normal">
              <StyledInputLabel id="vender-label" shrink>{t('vender')}</StyledInputLabel>
              <CustomSelect
                labelId="vender-label"
                value={vender}
                onChange={handleVenderChange}
              >
                {Object.keys(vendors).map((key) => (
                  <MenuItem value={key} key={key}>{key}</MenuItem>
                ))}
              </CustomSelect>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <StyledInputLabel id="api-key-label" shrink>{t('apiKey')}</StyledInputLabel>
              <CustomTextField
                fullWidth
                type="password"
                value={currentVenderSettings.apiKey || ''}
                onChange={(e) => handleVendorSettingChange('apiKey', e.target.value)}
              />
            </FormControl>

            {(vender === 'azure' || vender === 'openai') && (

            <FormControl fullWidth margin="normal">
              <StyledInputLabel id="base-url-label" shrink>{t('baseUrl')}</StyledInputLabel>
              <CustomTextField
                fullWidth
                value={currentVenderSettings.baseUrl || ''}
                onChange={(e) => handleVendorSettingChange('baseUrl', e.target.value)}
              />
            </FormControl>
            )}

            {vender === 'azure' && (
              <>
                <FormControl fullWidth margin="normal">
                  <StyledInputLabel id="deployment-name-label" shrink>{t('deploymentName')}</StyledInputLabel>
                  <CustomTextField
                    fullWidth
                    value={currentVenderSettings.deploymentName || ''}
                    onChange={(e) => handleVendorSettingChange('deploymentName', e.target.value)}
                  />
                </FormControl>
                <FormControl fullWidth margin="normal">
                  <StyledInputLabel id="embeddings-deployment-name-label" shrink>{t('embeddingsDeploymentName')}</StyledInputLabel>
                  <CustomTextField
                    fullWidth
                    value={currentVenderSettings.embeddingsDeploymentName || ''}
                    onChange={(e) => handleVendorSettingChange('embeddingsDeploymentName', e.target.value)}
                  />
                </FormControl>
              </>
            )}

            {vender !== 'azure' && (
              <FormControl fullWidth margin="normal">
                <StyledInputLabel id="model-name-label" shrink>{t('modelNameOptional')}</StyledInputLabel>
                <CustomTextField
                  fullWidth
                  value={currentVenderSettings.modelName || ''}
                  onChange={(e) => handleVendorSettingChange('modelName', e.target.value)}
                />
              </FormControl>
            )}

            {vender === 'openai' && (
              <FormControl fullWidth margin="normal">
                <StyledInputLabel id="model-name-label" shrink>{t('embeddingsModelNameOptional')}</StyledInputLabel>
                <CustomTextField
                  fullWidth
                  value={currentVenderSettings.embeddingsModelName || ''}
                  onChange={(e) => handleVendorSettingChange('embeddingsModelName', e.target.value)}
                />
              </FormControl>
            )}

            <FormControlLabel
              control={
                <Checkbox
                  checked={useSeparateVenders}
                  onChange={(e) => setUseSeparateVenders(e.target.checked)}
                />
              }
              label={t('useSeparateVenders')}
            />

            {useSeparateVenders && (
              <>
                <FormControl fullWidth margin="normal">
                  <StyledInputLabel id="embeddings-vender-label" shrink>{t('embeddingsVender')}</StyledInputLabel>
                  <CustomSelect
                    labelId="embeddings-vender-label"
                    value={embeddingsVender}
                    onChange={handleEmbeddingsVenderChange}
                  >
                    {Object.keys(embeddingsVendors).map((key) => (
                      <MenuItem value={key} key={key}>{key}</MenuItem>
                    ))}
                  </CustomSelect>
                </FormControl>

                <FormControl fullWidth margin="normal">
                  <StyledInputLabel id="embeddings-api-key-label" shrink>{t('embeddingsApiKey')}</StyledInputLabel>
                  <CustomTextField
                    fullWidth
                    type="password"
                    value={currentEmbeddingsVenderSettings.apiKey || ''}
                    onChange={(e) => handleEmbeddingsVendorSettingChange('apiKey', e.target.value)}
                  />
                </FormControl>

                <FormControl fullWidth margin="normal">
                  <StyledInputLabel id="embeddings-base-url-label" shrink>{t('baseUrl')}</StyledInputLabel>
                  <CustomTextField
                    fullWidth
                    value={currentEmbeddingsVenderSettings.baseUrl || ''}
                    onChange={(e) => handleEmbeddingsVendorSettingChange('baseUrl', e.target.value)}
                  />
                </FormControl>

                {embeddingsVender === 'azure' && (
                  <FormControl fullWidth margin="normal">
                    <StyledInputLabel id="embeddings-deployment-name-label" shrink>{t('embeddingsDeploymentName')}</StyledInputLabel>
                    <CustomTextField
                      fullWidth
                      value={currentEmbeddingsVenderSettings.embeddingsDeploymentName || ''}
                      onChange={(e) => handleEmbeddingsVendorSettingChange('embeddingsDeploymentName', e.target.value)}
                    />
                  </FormControl>
                )}

                {embeddingsVender !== 'azure' && (
                  <FormControl fullWidth margin="normal">
                    <StyledInputLabel id="embeddings-model-name-label" shrink>{t('modelNameOptional')}</StyledInputLabel>
                    <CustomTextField
                      fullWidth
                      value={currentEmbeddingsVenderSettings.embeddingsModelName || ''}
                      onChange={(e) => handleEmbeddingsVendorSettingChange('embeddingsModelName', e.target.value)}
                    />
                  </FormControl>
                )}
              </>
            )}
          </StyledDialogContent>
        </Box>
        <Box hidden={activeTab !== 1}>
          <StyledDialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  {t('systemMessage')}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {t('systemMessagePlaceholderDescription')}
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={8}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder={t('systemMessagePlaceholderExample')}
                />
              </Grid>
              <Grid item xs={12}>
                <StyledPlaceholderContainer>
                  <PlaceholderButton
                    variant="outlined"
                    startIcon={<AddBoxIcon />}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', '{{DOCUMENTS}}')}
                    onClick={() => insertPlaceholder('{{DOCUMENTS}}')}
                  >
                    {t('insertDocumentsPlaceholder')}
                  </PlaceholderButton>
                  <PlaceholderButton
                    variant="outlined"
                    startIcon={<AddBoxIcon />}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', '{{TOPIC}}')}
                    onClick={() => insertPlaceholder('{{TOPIC}}')}
                  >
                    {t('insertTopicPlaceholder')}
                  </PlaceholderButton>
                </StyledPlaceholderContainer>
              </Grid>
              <Grid item xs={12}>
                <Divider />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  {t('preview')}
                </Typography>
                <PreviewBox>
                  {preview}
                </PreviewBox>
              </Grid>
            </Grid>
          </StyledDialogContent>
        </Box>
        <Box hidden={activeTab !== 2}>
          <StyledDialogContent>
            <ParametersSection
              temperature={temperature}
              setTemperature={setTemperature}
              maxTokens={maxTokens}
              setMaxTokens={setMaxTokens}
              maxHistoryLength={maxHistoryLength}
              setMaxHistoryLength={setMaxHistoryLength}
              searchResultsLimit={searchResultsLimit}
              setSearchResultsLimit={setSearchResultsLimit}
            />
          </StyledDialogContent>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('close')}</Button>
        <Button onClick={handleSave} color="primary">{t('save')}</Button>
      </DialogActions>
    </DialogRoot>
  );
};

export default GlobalSettingsDialog;
