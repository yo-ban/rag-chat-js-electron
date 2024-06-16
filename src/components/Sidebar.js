import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Box, 
  Tabs, 
  Tab, 
  Typography, 
  Button, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import SettingsIcon from '@mui/icons-material/Settings';
import ChatList from './ChatList';
import CreateDBDialog from './CreateDBDialog';
import CreateChatDialog from './CreateChatDialog';
import GlobalSettingsDialog from './GlobalSettingsDialog';
import DatabaseAccordion from './DatabaseAccordion';
import api from '../services/api';

const SidebarContainer = styled(Box)(({ theme }) => ({
  width: '350px',
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  padding: '20px 16px',
  display: 'flex',
  flexDirection: 'column',
  borderRight: `1px solid ${theme.palette.border.main}`,
  height: '100%',
  boxSizing: 'border-box',
}));

const AppTitleContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  marginBottom: '15px',
});

const AppTitle = styled(Typography)({
  fontSize: '18px',
  fontWeight: '500',
});

const ThemeIconButton = styled(IconButton)({
  marginLeft: 'auto', 
  fontSize: '1.2rem' 
});

const SettingsIconButton = styled(IconButton)({
  fontSize: '1.2rem' 
});

const SidebarTabs = styled(Tabs)(({ theme }) => ({
  marginBottom: '16px',
  '.MuiTabs-indicator': {
    backgroundColor: theme.palette.primary.main,
  },
}));

const ChatListContainer = styled(Box)({
  flexGrow: 1,
  overflowY: 'auto',
});

function Sidebar({ chatList, setActiveChat, createNewChat, loadChats, selectedChatId, databases, dbDescriptions, setDatabases, toggleTheme }) {
  const { t } = useTranslation();
  
  const [activeTab, setActiveTab] = useState(0);
  const [createDBDialogOpen, setCreateDBDialogOpen] = useState(false);
  const [createChatDialogOpen, setCreateChatDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  const [defaultVender, setDefaultVender] = useState('openai');
  const [defaultEmbeddingsVender, setDefaultEmbeddingsVender] = useState('openai');
  const [useSeparateVenders, setUseSeparateVenders] = useState(false);
  const [vendors, setVendors] = useState({
    openai: {
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4o',
      embeddingsModelName: 'text-embedding-3-large'
    },
    azure: {
      apiKey: '',
      baseUrl: 'https://<resource name>.openai.azure.com/',
      deploymentName: 'my-deployment',
      embeddingsDeploymentName: 'my-deployment-embeddings'
    },
    cohere: {
      apiKey: '',
      modelName: 'c4ai-aya-23'
    }
  });
  const [embeddingsVendors, setEmbeddingsVendors] = useState({
    openai: {
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      embeddingsModelName: 'text-embedding-3-large'
    },
    azure: {
      apiKey: '',
      baseUrl: 'https://<resource name>.openai.azure.com/',
      embeddingsDeploymentName: 'my-deployment-embeddings'
    }
  });

  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState('You are a helpful assistant.');
  const [defaultTemperature, setDefaultTemperature] = useState(0.5);
  const [defaultMaxTokens, setDefaultMaxTokens] = useState(1024);
  const [defaultSearchResultsLimit, setDefaultSearchResultsLimit] = useState(6);
  const [language, setLanguage] = useState("ja");
  const [vectorDBSavePath, setVectorDBSavePath] = useState("./");
  const [chatDataSavePath, setChatDataSavePath] = useState("./");
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dbToDelete, setDbToDelete] = useState(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await api.loadSettings();
        setDefaultVender(settings.vender || 'openai');
        setDefaultEmbeddingsVender(settings.embeddingsVender || 'openai');
        setUseSeparateVenders(settings.useSeparateVenders || false);
        setVendors(settings.vendors || {
          openai: {
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
            modelName: 'gpt-4o',
            embeddingsModelName: 'text-embedding-3-large'
          },
          azure: {
            apiKey: '',
            baseUrl: 'https://<resource name>.openai.azure.com/',
            deploymentName: 'my-deployment',
            embeddingsDeploymentName: 'my-deployment-embeddings'
          },
          cohere: {
            apiKey: '',
            modelName: 'c4ai-aya-23'
          }
        });
        setEmbeddingsVendors(settings.embeddingsVendors || {
          openai: {
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
            embeddingsModelName: 'text-embedding-3-large'
          },
          azure: {
            apiKey: '',
            baseUrl: 'https://azure.com',
            embeddingsDeploymentName: 'my-deployment-embeddings'
          }
        });
        setDefaultSystemPrompt(settings.systemMessage || 'You are a helpful assistant.');
        setDefaultTemperature(settings.temperature || 0.5);
        setDefaultMaxTokens(settings.maxTokens || 1024);
        setDefaultSearchResultsLimit(settings.searchResultsLimit || 6);
        setLanguage(settings.language || "ja");
        setVectorDBSavePath(settings.vectorDBSavePath || "./");
        setChatDataSavePath(settings.chatDataSavePath || "./");
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []);
  
  const saveSettings = async (vender, embeddingsVender, useSeparateVenders, vendors, embeddingsVendors, systemMessage, temperature, maxTokens, searchResultsLimit, language, vectorDBSavePath, chatDataSavePath) => {
    setDefaultVender(vender);
    setDefaultEmbeddingsVender(embeddingsVender);
    setUseSeparateVenders(useSeparateVenders);
    setVendors(vendors);
    setEmbeddingsVendors(embeddingsVendors);
    setDefaultSystemPrompt(systemMessage);
    setDefaultTemperature(temperature);
    setDefaultMaxTokens(maxTokens);
    setDefaultSearchResultsLimit(searchResultsLimit);
    setLanguage(language);
    setVectorDBSavePath(vectorDBSavePath);
    setChatDataSavePath(chatDataSavePath);
  
    await api.saveSettings({ vender, embeddingsVender, useSeparateVenders, vendors, embeddingsVendors, systemMessage, temperature, maxTokens, searchResultsLimit, language, vectorDBSavePath, chatDataSavePath });
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleOpenCreateDBDialog = () => {
    setCreateDBDialogOpen(true);
  };

  const handleCloseCreateDBDialog = () => {
    setCreateDBDialogOpen(false);
  };

  const handleOpenCreateChatDialog = () => {
    setCreateChatDialogOpen(true);
  };

  const handleCloseCreateChatDialog = () => {
    setCreateChatDialogOpen(false);
  };

  const handleCreateNewChat = (database, chatConfig) => {
    createNewChat(database, { ...chatConfig, systemMessage: defaultSystemPrompt }); 
    handleCloseCreateChatDialog();
  };

  const handleOpenDeleteDialog = (dbName) => {
    setDbToDelete(dbName);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDbToDelete(null);
  };

  const handleDeleteDatabase = async () => {
    try {
      await api.deleteDatabase(dbToDelete);
      setDatabases(databases.filter(db => db !== dbToDelete));
      handleCloseDeleteDialog();
    } catch (error) {
      console.error('Error deleting database:', error);
    }
  };

  const handleDeleteChat = async (chatId) => {
    try {
      await api.deleteChat(chatId);
      loadChats();
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const handleOpenSettingsDialog = () => {
    setSettingsDialogOpen(true);
  };

  const handleCloseSettingsDialog = () => {
    setSettingsDialogOpen(false);
  };

  return (
    <SidebarContainer>
      <AppTitleContainer>
        <AppTitle variant="h6">
          {t('appTitle')}
        </AppTitle>

        <Tooltip title={t('changeTheme')} arrow placement="top">
          <ThemeIconButton onClick={toggleTheme} >
            <Brightness4Icon />
          </ThemeIconButton>
        </Tooltip>

        <Tooltip title={t('openGlobalSettings')} arrow placement="top">
          <SettingsIconButton onClick={handleOpenSettingsDialog} >
            <SettingsIcon />
          </SettingsIconButton>
        </Tooltip>
      </AppTitleContainer>
      
      <SidebarTabs value={activeTab} onChange={handleTabChange}>
        <Tab label={t('history')} />
        <Tab label={t('databases')} />
      </SidebarTabs>

      {activeTab === 0 && (
        <ChatListContainer>
          <Button
            onClick={handleOpenCreateChatDialog}
            startIcon={<AddIcon />}
            fullWidth
            sx={{ mb: 0.5 }}
          >
            {t('newChat')}
          </Button>
          <ChatList 
            chatList={chatList} 
            setActiveChat={setActiveChat} 
            handleDeleteChat={handleDeleteChat} 
            selectedChatId={selectedChatId}
          />
        </ChatListContainer>
      )}

      <CreateChatDialog
        open={createChatDialogOpen}
        onClose={handleCloseCreateChatDialog}
        databases={databases}
        onCreate={handleCreateNewChat}
        defaultTemperature={defaultTemperature}
        defaultMaxTokens={defaultMaxTokens}
        defaultSearchResultsLimit={defaultSearchResultsLimit}
      />

      {activeTab === 1 && (
        <ChatListContainer>
          <Button 
            onClick={handleOpenCreateDBDialog}
            startIcon={<AddIcon />} 
            fullWidth
            sx={{ mb: 0.5 }}
          >
            {t('createDatabase')}
          </Button>

        {databases.map((dbName, index) => (
          <DatabaseAccordion
            key={dbName}
            dbName={dbName}
            dbDescription={dbDescriptions[index]}
            language={language}
            handleOpenDeleteDialog={handleOpenDeleteDialog}
          />
        ))}
        </ChatListContainer>
      )}

      <CreateDBDialog
        open={createDBDialogOpen}
        onClose={handleCloseCreateDBDialog}
        onCreate={(dbName) => setDatabases([...databases, dbName])}
        language={language}
      />

      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>{t('confirmDeleteDatabase')}</DialogTitle>
        <DialogContent>
          <Typography>{t('areYouSureDeleteDatabase', { dbName: dbToDelete })}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>{t('cancel')}</Button>
          <Button onClick={handleDeleteDatabase} color="error">{t('delete')}</Button>
        </DialogActions>
      </Dialog>
      
      <GlobalSettingsDialog
        open={settingsDialogOpen}
        onClose={handleCloseSettingsDialog}
        onSave={saveSettings}
        initialVender={defaultVender}
        initialEmbeddingsVender={defaultEmbeddingsVender}
        initialUseSeparateVenders={useSeparateVenders}
        initialVendors={vendors}
        initialEmbeddingsVendors={embeddingsVendors}
        initialSystemPrompt={defaultSystemPrompt}
        initialTemperature={defaultTemperature}
        initialMaxTokens={defaultMaxTokens}
        initialSearchResultsLimit={defaultSearchResultsLimit}
        initialLanguage={language}
        initialVectorDBSavePath={vectorDBSavePath}
        initialChatDataSavePath={chatDataSavePath}
      />

    </SidebarContainer>
  );
}

export default Sidebar;
