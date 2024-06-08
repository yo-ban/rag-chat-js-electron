import React from 'react';
import { Box, TextField, IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { styled } from '@mui/material/styles';

const ChatInputContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  padding: '10px 15px',
  borderTop: `1px solid ${theme.palette.border.main}`,
  alignItems: 'center',
  backgroundColor: theme.palette.background.paper,
}));

const CustomTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.palette.background.paper,
    borderRadius: '20px',
    '& fieldset': {
      borderColor: theme.palette.divider,
    },
    '&:hover fieldset': {
      borderColor: theme.palette.text.disabled,
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.primary.main,
    },
  },
}));

const SendButton = styled(IconButton)(({ theme }) => ({
  marginLeft: '10px',
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.background.paper,
  '&:hover': {
    backgroundColor: '#0056b3',
  },
  borderRadius: '50%',
  width: '48px',
  height: '48px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
}));

const ChatInput = ({ input, setInput, isSending, sendMessage, t }) => {
  return (
    <ChatInputContainer>
      <CustomTextField
        variant="outlined"
        fullWidth
        multiline
        rows={4}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !isSending) {
            e.preventDefault();
            sendMessage(input, false);
          }
        }}
        placeholder={t('placeholder')}
      />
      <SendButton
        color="primary"
        onClick={() => sendMessage(input, false)}
        disabled={isSending}
      >
        <SendIcon />
      </SendButton>
    </ChatInputContainer>
  );
};

export default ChatInput;
