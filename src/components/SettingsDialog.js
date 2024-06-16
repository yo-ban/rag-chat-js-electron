import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';  
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  TextField,
  Typography,
  Grid,
  Divider,
  Tooltip,
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

const PlaceholderButton = styled(Button)(({ theme }) => ({
  display: 'inline-flex',
  margin: theme.spacing(0.5, 1),
  padding: theme.spacing(0.5, 1.5),
  fontSize: '0.875rem',
}));

const StyledPlaceholderContainer = styled(Grid)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'flex-start',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
}));

const SettingsDialog = ({ open, handleClose, activeChat, updateChat, databases }) => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState(0);
  const [systemMessage, setSystemMessage] = useState('');
  const [temperature, setTemperature] = useState(1);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [maxHistoryLength, setMaxHistoryLength] = useState(6);
  const [searchResultsLimit, setSearchResultsLimit] = useState(6);
  const [preview, setPreview] = useState('');
  const [topic, setTopic] = useState('');

  useEffect(() => {
    setSystemMessage(activeChat ? activeChat.systemMessage || '' : '');
    setTemperature(activeChat ? activeChat.temperature || 1 : 1);
    setMaxTokens(activeChat ? activeChat.maxTokens || 1024 : 1024);
    setMaxHistoryLength(activeChat ? activeChat.maxHistoryLength || 6 : 6);
    setSearchResultsLimit(activeChat ? activeChat.searchResultsLimit || 6 : 6);
    setTopic(activeChat ? activeChat.topic || '' : '');
  }, [activeChat]);

  useEffect(() => {
    setPreview(systemMessage
      .replace('{{DOCUMENTS}}', `${t('systemMessagePlaceholderDummy')}`)
      .replace('{{TOPIC}}', topic || `${t('topicPlaceholderDummy')}`));
  }, [systemMessage, topic]);

  const handleSave = () => {

    updateChat({ 
      ...activeChat, 
      systemMessage,
      temperature: parseFloat(temperature),
      maxTokens: parseInt(maxTokens, 10),
      maxHistoryLength: parseInt(maxHistoryLength, 10),
      searchResultsLimit: parseInt(searchResultsLimit, 10),
      topic: topic,
    });
    handleClose();
  };

  const insertPlaceholder = (placeholder) => {
    setSystemMessage(systemMessage + `\n${placeholder}`);
  };
  
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  return (
    <DialogRoot open={open} onClose={handleClose}>
      <DialogTitle>{t('chatSettings')}</DialogTitle>
      <DialogContent>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label={t('parameterSettings')} />
          <Tab label={t('systemPromptSettings')} />
          <Tab label={t('topicSettings')} />
        </Tabs>
        <Box hidden={activeTab !== 0}>
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
                value={systemMessage}
                onChange={(e) => setSystemMessage(e.target.value)}
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
              <Box
                border={1}
                borderColor="grey.300"
                borderRadius={4}
                p={2}
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {preview}
              </Box>
            </Grid>
          </Grid>
          </StyledDialogContent>
        </Box>
        <Box hidden={activeTab !== 2}>
          <StyledDialogContent>
            <Typography variant="subtitle1" gutterBottom>
              {t('topic')}
            </Typography>
            <Typography variant="caption" color="textSecondary">
                {t('topicDescription')}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={8}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t('topicPlaceholderExample')}
            />
          </StyledDialogContent>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('cancel')}</Button>
        <Button onClick={handleSave}>{t('save')}</Button>
      </DialogActions>
    </DialogRoot>
  );
};

export default SettingsDialog;
