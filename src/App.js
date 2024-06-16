import React, { useState, useEffect, useCallback } from 'react';
import ChatBox from './components/ChatBox';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { CssBaseline, Drawer, Box, CircularProgress, Backdrop } from '@mui/material';
import { ThemeProvider as MuiThemeProvider, createTheme, styled } from '@mui/material/styles';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import api from './services/api';
import { toast } from 'react-toastify';

const lightTheme = createTheme({
  spacing: 4,
  palette: {
    action: {
      hover: '#f5f5f5',
      selected: '#e0e0e0',
    },
    error: {
      main: '#f44336',
    },
    primary: {
      main: '#007bff',
    },
    border: {
      main: '#ddd'
    },
    background: {
      default: '#f0f2f5',
      paper: '#ffffff', 
      appBar: '#f8f8f8', 
      userMessage: '#ffffff',
      assistantMessage: '#f2f2f2'
    },
    text: {
      primary: '#000000', 
      secondary: '#333333', 
      disabled: '#999999',
      typingIndicator: '#888888',
    },
    divider: '#ccc',
  },
});

const darkTheme = createTheme({
  spacing: 4,
  palette: {
    mode: 'dark',
    action: {
      hover: '#333',
      selected: '#555', 
    },
    error: {
      main: '#f44336',
    },
    primary: {
      main: '#90caf9', 
    },
    border: {
      main: '#444444'
    },
    background: {
      default: '#121212', 
      paper: '#1e1e1e',  
      appBar: '#2c2c2c',
      userMessage: '#1e1e1e',
      assistantMessage: '#333333'
    },
    text: {
      primary: '#E0E0E0', 
      secondary: '#bbbbbb', 
      typingIndicator: '#888888',
    },
    divider: '#555',
  },
});

const AppContainer = styled(Box)({
  display: 'flex',
  height: '100vh',
  width: '100vw',
  margin: 0,
  padding: 0,
});

const MainContainer = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
});

const ContentContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.palette.background.default,
  width: '100%',
  margin: 0,
  padding: 0,
  overflow: 'hidden',
}));

function App() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [chatList, setChatList] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [activeDbId, setActiveDbId] = useState(null);
  const [databases, setDatabases] = useState([]);
  const [dbDescriptions, setDbDescriptions] = useState([]);
  const [theme, setTheme] = useState(lightTheme);
  const [defaultSettings, setDefaultSettings] = useState({
    systemMessage: 'You are a helpful assistant.',
    temperature: 0.5,
    maxTokens: 1024,
    maxHistoryLength: 6,
    searchResultsLimit: 6
  });

  const [isLoading, setIsLoading] = useState(false);
  
  // テーマの状態をローカルストレージに保存
  const saveThemeToLocalStorage = (themeMode) => {
    localStorage.setItem('themeMode', themeMode);
  };

  // テーマ切り替え関数
  const toggleTheme = () => {
    setTheme((prevTheme) => {
      const newTheme = prevTheme.palette.mode === 'light' ? darkTheme : lightTheme;
      saveThemeToLocalStorage(newTheme.palette.mode);
      return newTheme;
    });
  };

  // アプリ起動時にテーマの状態を読み込む
  useEffect(() => {
    const savedThemeMode = localStorage.getItem('themeMode');
    if (savedThemeMode) {
      setTheme(savedThemeMode === 'light' ? lightTheme : darkTheme);
    }
  }, []);

  const toggleDrawer = useCallback((open) => (event) => {
    if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setIsDrawerOpen(open);
    console.log(`Drawer ${open ? 'opened' : 'closed'}`);
  }, []);

  const handleActiveChatChange = useCallback(async (chat) => {
    setActiveChat(chat);
    console.log('Active chat changed:', chat);
  
    if (chat && chat.dbName) {
      let loadingTimeout;
      try {
        loadingTimeout = setTimeout(() => {
          setIsLoading(true); // 1秒後にローディング表示を開始
        }, 500);
  
        const dbId = await api.loadDatabase(chat.dbName);
        clearTimeout(loadingTimeout);
        setIsLoading(false); // ローディング表示を終了
        setActiveDbId(dbId);
        console.log('Loaded database ID:', dbId);
      } catch (error) {
        clearTimeout(loadingTimeout);
        setIsLoading(false); // ローディング表示を終了
        console.error('Error loading database:', error);
        toast.error('Failed to load database.');
        setActiveDbId(null);
  
        // 該当のチャットのdbNameを空にする
        const updatedChat = { ...chat, dbName: null };
        const updateData = await api.updateChat(updatedChat);
        setActiveChat(updateData);
      }
    } else {
      setActiveDbId(null);
      console.log('No database associated with the chat');
    }
  }, []);

  const loadChats = useCallback(async () => {
    try {
      const chats = await api.loadChats();
      setChatList(chats);
      console.log('Loaded chats:', chats);
      if (chats.length === 0) {
        console.log('No chats found, creating a new chat');
        const settings = await api.loadSettings();
        createNewChat(null, {
          systemMessage: settings.systemMessage,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          maxHistoryLength: settings.maxHistoryLength,
          searchResultsLimit: settings.searchResultsLimit
        });
        setDefaultSettings({
          systemMessage: settings.systemMessage,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          maxHistoryLength: settings.maxHistoryLength,
          searchResultsLimit: settings.searchResultsLimit
        });
      } else {
        handleActiveChatChange(chats[0]);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
      toast.error('Failed to load chats.');
    }
  }, [handleActiveChatChange]);

  const createNewChat = useCallback(async (dbName = null, chatConfig = defaultSettings) => {
    try {
      const newChat = await api.createNewChat(dbName, chatConfig);
      setChatList((prev) => [newChat, ...prev]);
      handleActiveChatChange(newChat);
      console.log('Created new chat:', newChat);
    } catch (error) {
      console.error('Error creating new chat:', error);
      toast.error('Failed to create new chat.');
    }
  }, [handleActiveChatChange, defaultSettings]);

  const updateChat = useCallback(async (updatedChat) => {
    try {
      const updatedChatList = chatList.map((chat) =>
        chat.id === updatedChat.id ? { ...chat, ...updatedChat } : chat
      );
      setChatList(updatedChatList);
      const updatedData = await api.updateChat(updatedChat);
      handleActiveChatChange({
        ...updatedData,
        preview: updatedData.preview || activeChat.preview
      });
      console.log('Updated chat:', updatedChat);
    } catch (error) {
      console.error('Error updating chat:', error);
      toast.error('Failed to update chat.');
    }
  }, [chatList, handleActiveChatChange, activeChat]);
  
  useEffect(() => {
    const loadDatabases = async () => {
      const { databases: dbList, descriptions } = await api.loadDatabases();
      setDatabases(Object.values(dbList));
      setDbDescriptions(Object.values(descriptions))
    };
    loadDatabases();
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  console.log("App rendered with activeChat:", activeChat, "and activeDbId:", activeDbId);

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <AppContainer>
        <ToastContainer />
        <Drawer anchor="left" open={isDrawerOpen} onClose={toggleDrawer(false)}>
          <Sidebar
            chatList={chatList}
            setActiveChat={handleActiveChatChange}
            createNewChat={createNewChat}
            loadChats={loadChats}
            selectedChatId={activeChat ? activeChat.id : null}
            databases={databases}
            dbDescriptions={dbDescriptions}
            setDatabases={setDatabases}
            toggleTheme={toggleTheme}
          />
        </Drawer>
        <MainContainer>
          <Header
            key={activeChat ? activeChat.id : 'new'}
            updateChat={updateChat}
            toggleDrawer={toggleDrawer}
            activeChat={activeChat}
            databases={databases}
          />
          <ContentContainer>
            {activeChat && (
              <ChatBox
                chatId={activeChat.id}
                chatTitle={activeChat.name}
                k={activeChat.searchResultsLimit}
                updateChat={updateChat}
                activeDbId={activeDbId}
              />
            )}
          </ContentContainer>
        </MainContainer>
      </AppContainer>
      <Backdrop open={isLoading} style={{ zIndex: 1300, color: '#fff' }}>
        <CircularProgress color="inherit" />
      </Backdrop>
    </MuiThemeProvider>
  );
}

export default App;
