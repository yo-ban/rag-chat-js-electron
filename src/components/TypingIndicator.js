import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const TypingIndicatorContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '5px 15px',
  color: theme.palette.text.typingIndicator,
}));

const Dot = styled(Box)(({ theme }) => ({
  height: '8px',
  width: '8px',
  margin: '0 2px',
  backgroundColor: theme.palette.primary.main,
  borderRadius: '50%',
  display: 'inline-block',
  animation: 'blink 1.4s infinite both',
  '&:nth-of-type(2)': {
    animationDelay: '0.2s',
  },
  '&:nth-of-type(3)': {
    animationDelay: '0.4s',
  },
}));

function TypingIndicator({ message }) {
  return (
    <TypingIndicatorContainer>
      <Dot className="typing-dot" />
      <Dot className="typing-dot" />
      <Dot className="typing-dot" />
      <Typography variant="body2" sx={{ marginLeft: '10px' }}>{message}</Typography>
    </TypingIndicatorContainer>
  );
}

export default TypingIndicator;
