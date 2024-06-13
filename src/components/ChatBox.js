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
  const [resendMessage, setResendMessage] = useState(null);
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

      console.log("Start retrieval-augmented in ", activeDbId);
      const { requiresFollowUp, reason, queries, mergedResults } = await api.retrievalAugmented(chatId, filteredMessages, activeDbId, k)

      return { requiresFollowUp, reason, queries, mergedResults };

    } catch (error) {
      console.error('Error during similarity search:', error);
      toast.error(t('errorSearchingDocument'));
      return { requiresFollowUp: false, reason: "", queries: [], mergedResults: [] };
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

    try {
      const { requiresFollowUp, reason, queries, mergedResults } = await performSearch(newMessages);
      setStatusMessage(t('generateResponse'));
      
      if (requiresFollowUp) {
        await api.sendMessageFollowup(newMessages, chatId, reason);
        console.log('Message sent (followup):', { newMessages, reason });  
      } else { 
        await api.sendMessage(newMessages, chatId, mergedResults, queries);
        console.log('Message sent:', { newMessages, mergedResults });  
      }

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

  const handleRetry = useCallback(async () => {
    try {
      await sendMessage(lastMessage, true);
    } catch (error) {
      console.error('Error retrying message:', error);
      toast.error(t('errorRetryingMessage'));
    }
  }, [lastMessage, sendMessage, t]);
    
  const handleDelete = useCallback(async (index) => {
    try {
      const updatedMessages = await api.deleteMessages(chatId, index);
      setMessages(updatedMessages);
    } catch (error) {
      console.error('Error deleting messages:', error);
      toast.error(t('errorDeletingMessages'));
    }
  }, [chatId, t]);
  
  const handleResendMessage = useCallback(async (index) => {
    try {
      const resendMessage = messages[index];
      const updatedMessages = messages.slice(0, index);
      setMessages(updatedMessages);
      setResendMessage(resendMessage.content);
    } catch (error) {
      console.error('Error resend message:', error);
      toast.error(t('errorResendMessage'));
    }
  }, [messages, setMessages, setResendMessage, t]);

    // メッセージの変更を監視
  useEffect(() => {
    if (resendMessage !== null) {
      setResendMessage(null);
      sendMessage(resendMessage);
    }
  }, [messages, resendMessage, sendMessage]);

  useEffect(() => {
    const handleStatus = (message) => {
      console.log(message);
      setStatusMessage(t(message));
    };
    
    api.onMessageProgress(handleStatus);

    return () => {
      api.removeListener('message-progress', handleStatus);
    };
  }, [t]);

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
                <Message 
                  message={msg} 
                  onDelete={() => handleDelete(index)} 
                  onResend={() => handleResendMessage(index)} 
                />
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
