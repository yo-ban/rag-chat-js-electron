import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Box, styled, IconButton, Tooltip } from '@mui/material';
import CopyIcon from '@mui/icons-material/FileCopyOutlined';
import { CopyToClipboard } from 'react-copy-to-clipboard';

const MessageContainer = styled(Box)(({ theme, role }) => ({
  padding: '10px',
  borderRadius: '8px',
  maxWidth: '100%',
  fontSize: '14px',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  clear: 'both',
  display: 'flex',
  position: 'relative',
  backgroundColor: role === 'user' ? theme.palette.background.assistantMessage : theme.palette.background.userMessage,
  color: 'black',
  border: role === 'user' ? 'none' : `1px solid ${theme.palette.border.main}`,
  '&:hover .copy-button': {
    display: 'inline-flex',
  },
}));

const MessageHeader = styled(Box)({
  display: 'flex',
  alignItems: 'flex-start',
  flexDirection: 'row',
  width: '100%',
});

const UserIcon = styled(Box)(({ theme }) => ({
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  marginRight: '8px',
  flexShrink: 0,
  backgroundColor: theme.palette.divider,
}));

const BotIcon = styled(Box)(({ theme }) => ({
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  marginRight: '8px',
  flexShrink: 0,
  backgroundColor: theme.palette.primary.main,
}));

const MessageContent = styled(Box)(({ theme }) => ({
  wordBreak: 'break-all',
  color: theme.palette.text.primary,
  whiteSpace: 'pre-wrap',
}));

const CopyButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: '4px',
  right: '4px',
  padding: '2px',
  color: theme.palette.text.secondary,
  display: 'none',
}));

function Message({ message }) {
  const { role, content } = message;

  const codeBlockRegex = /```([\s\S]*?)```/g;
  const messageParts = content.split(codeBlockRegex);

  return (
    <MessageContainer role={role}>
      <MessageHeader>
        {role === 'user' && <UserIcon />}
        {role === 'assistant' && <BotIcon />}
        <MessageContent>
          {messageParts.map((part, index) => {
            if (index % 2 === 1) {
              return (
                <SyntaxHighlighter
                  language="javascript"
                  style={atomDark}
                  key={index}
                  lineProps={{ style: { wordBreak: 'break-all', whiteSpace: 'pre-wrap' } }}
                  wrapLines={true}
                >
                  {part.trim()}
                </SyntaxHighlighter>
              );
            }
            return <span key={index}>{part}</span>;
          })}
        </MessageContent>
      </MessageHeader>
      {role === 'assistant' && (
        <CopyToClipboard text={content}>
          <Tooltip title="Copy to Clipboard" placement="top">
            <CopyButton className="copy-button" aria-label="copy">
              <CopyIcon fontSize="small"/>
            </CopyButton>
          </Tooltip>
        </CopyToClipboard>
      )}
    </MessageContainer>
  );
}

export default Message;