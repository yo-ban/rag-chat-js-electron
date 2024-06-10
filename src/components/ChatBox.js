import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';  
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import ChatInput from './ChatInput';
import Message from './Message';
import ErrorNotification from './ErrorNotification';
import TypingIndicator from './TypingIndicator';
import DocResults from './DocResults';
import api from '../services/api';
import { toast } from 'react-toastify';

const ChatBoxContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.palette.background.paper,
  padding: 0,
  overflowY: 'auto',
  width: '100%',
  boxSizing: 'border-box',
  height: '100%',
  color: theme.palette.text.primary,
}));

const ChatMessages = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  padding: '10px 15px',
}));

function ChatBox({ chatId, chatTitle, k, updateChat, activeDbId }) {
  const { t } = useTranslation();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streamingMessage, setStreamingMessage] = useState('');
  const [error, setError] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [retrying, setRetrying] = useState(false);  
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');  
  const messageEndRef = useRef(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  useEffect(() => {
    let streamFinished = false;
    let docMessageQueue = [];
  
    const handleStreamingMessage = (content) => {
      setMessages((prev) => {
        let updatedMessages = [...prev];
        const lastMessage = updatedMessages[updatedMessages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          updatedMessages[updatedMessages.length - 1].content += content;
        } else {
          updatedMessages.push({ role: 'assistant', content: content });
        }
        return updatedMessages;
      });
      setIsTyping(false);
      setStatusMessage('');
    };
  
    const handleStreamingMessageEnd = () => {
      streamFinished = true;
      // キューにたまったdoc-messageを処理
      while (docMessageQueue.length > 0) {
        const content = docMessageQueue.shift();
        setMessages((prev) => [...prev, { role: 'doc', results: content }]);
      }
    };
  
    const handleDocMessage = (content) => {
      console.log("Receive doc message. streamFinished:", streamFinished);
      if (streamFinished) {
        setMessages((prev) => [...prev, { role: 'doc', results: content }]);
      } else {
        docMessageQueue.push(content);
      }
    };
  
    api.onStreamingMessage(handleStreamingMessage);
    api.onStreamingMessageEnd(handleStreamingMessageEnd);
    api.onDocMessage(handleDocMessage);
  
    return () => {
      api.removeListener('streaming-message', handleStreamingMessage);
      api.removeListener('streaming-message-end', handleStreamingMessageEnd);
      api.removeListener('doc-message', handleDocMessage);
    };
  }, []);
  
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        setError(null);
        setIsSending(false);
        const chatHistory = await api.loadChatHistory(chatId);
        setMessages(chatHistory);
        console.log('Loaded chat history:', chatHistory);
      } catch (error) {
        console.error(t('errorLoadingChatHistory'), error);
        toast.error(t('errorLoadingChatHistory'));
      }
    };

    loadChatHistory();
  }, [chatId, t]);

  const performSearch = async (filteredMessages) => {
    if (!activeDbId) return [];

    try {
      console.log("Search in ", activeDbId);
      setStatusMessage(t('analysisQuery'));
      const analysisResult = await api.analysisQuery(chatId, filteredMessages);
      console.log('Query analysis result:', analysisResult);

      setStatusMessage(t('transformQuery'));
      const transformedQueries = await api.transformQuery(chatId, filteredMessages, analysisResult);
      console.log('Transformed queries:', transformedQueries);

      setStatusMessage(t('searchingInDatabase'));
      const queries = transformedQueries.map(transformedQuery => transformedQuery.query);
      const mergedResults = await api.similaritySearch(activeDbId, queries, k)
      
      console.log('Similarity search result:', mergedResults);

      return { transformedQueries, mergedResults };

    } catch (error) {
      console.error('Error during similarity search:', error);
      toast.error(t('errorSearchingDocument'));
      return { transformedQueries: [], mergedResults: [] };
    }
  };

  const updateChatTitle = async (filteredMessages) => {
    if (filteredMessages.length >= 2 && (chatTitle === "New Chat" || chatTitle === "新しいチャット") && chatId) {
      const generatedChatName = await api.generateChatName(filteredMessages, chatId);
      if (generatedChatName) {
        updateChat({
          id: chatId,
          name: generatedChatName,
        });
      }
    }
  };

  const sendMessage = useCallback(async (input, retry = false) => {
    if (input.trim() === '' && !retry) return;

    let newMessages;
    if (retry) {
      newMessages = [...messages.slice(0, -1), { role: 'user', content: input }];
      setRetrying(true);
    } else {
      newMessages = [...messages, { role: 'user', content: input }];
    }
    setMessages(newMessages);
    setInput('');
    setStreamingMessage('');
    setError(null);
    setLastMessage(input);

    setIsTyping(true);
    setIsSending(true);

    const { transformedQueries, mergedResults } = await performSearch(newMessages);

    try {
      setStatusMessage(t('sendingMessage'));
      await api.sendMessage(newMessages, chatId, mergedResults, transformedQueries);
      console.log('Message sent:', { newMessages, mergedResults });
      updateChat({
        id: chatId,
        name: chatTitle,
        updatedAt: Date.now()
      });

      const filteredMessages = messages.filter(message => message.role !== 'doc');
      await updateChatTitle(filteredMessages);

      setRetrying(false);

    } catch (error) {
      console.error('Error:', error);
      setError(t('failedToSendMessage'));
    }
    setIsTyping(false);
    setIsSending(false);
    setStatusMessage('');    
  }, [input, messages, activeDbId, chatId, chatTitle, updateChat, lastMessage, t]);

  const handleRetry = () => {
    sendMessage(lastMessage, true);
  };
  
  return (
    <ChatBoxContainer>
      <ErrorNotification error={error} onRetry={handleRetry} />
      <ChatMessages>
        {messages.map((msg, index) => {
          const nextMsg = messages[index + 1];
          const isNextDoc = nextMsg && nextMsg.role === 'doc';
          const isAssistantFollowedByDoc = msg.role === 'assistant' && isNextDoc;

          return (
            <div key={index} style={{ marginBottom: isAssistantFollowedByDoc ? '4px' : '12px' }}>
              {msg.role === 'doc' ? (
                <DocResults results={msg.results} />
              ) : (
                <Message message={msg} />
              )}
            </div>
          );
        })}
        {isTyping && <TypingIndicator message={statusMessage || t('typing')} />}
        <div ref={messageEndRef} />
      </ChatMessages>
      <ChatInput
        input={input}
        setInput={setInput}
        isSending={isSending}
        sendMessage={sendMessage}
        t={t}
      />
    </ChatBoxContainer>
  );
}

export default ChatBox;
