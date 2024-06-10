import React, { useEffect, useRef } from 'react';
import { Box, styled, IconButton, Tooltip } from '@mui/material';
import CopyIcon from '@mui/icons-material/FileCopyOutlined';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import hljs from 'highlight.js';
import '../assets/code-theme.css';
import DOMPurify from 'dompurify';
import { Remarkable } from 'remarkable'; 
import parse, { domToReact } from 'html-react-parser';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';
import api from '../services/api';

const escapeHtml = (unsafe) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// スタイルの設定はそのまま
const MessageContainer = styled(Box)(({ theme, role }) => ({
  padding: '10px',
  borderRadius: '8px',
  maxWidth: '100%',
  fontSize: '14px',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  lineHeight: '1',
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
  width: '100%',
});

const UserIcon = styled(Box)(({ theme }) => ({
  display: 'flex',
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  marginRight: '8px',
  flexDirection: 'column',
  flexShrink: 0,
  lineHeight: '1',
  backgroundColor: theme.palette.divider,
}));

const BotIcon = styled(Box)(({ theme }) => ({
  display: 'flex',
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  marginRight: '8px',
  flexDirection: 'column',
  flexShrink: 0,
  lineHeight: '1',
  backgroundColor: theme.palette.primary.main,
}));

const MessageContent = styled(Box)(({ theme }) => ({
  display: 'inline-block',
  wordBreak: 'break-all',
  color: theme.palette.text.primary,
  marginBottom: "0px",
  lineHeight: '0',
  maxWidth: '95%',
  whiteSpace: 'pre-wrap',
  '& code': {
    fontFamily: 'Consolas, "BIZ UDGothic", Monaco, "Andale Mono", "Ubuntu Mono", monospace',
    fontSize: "0.95em"
  },
  '& p': {
    display: 'inline-block',
    marginBlockStart: '0.1em',
    marginBlockEnd: '0.5em',
    lineHeight: '1.5'
  },
  '& ul': {
    margin: '0px', 
    marginBlockEnd: '0.5em',
    padding: '0px 0px 0px 20px',
    listStylePosition: 'outside', 
    lineHeight: '0',
  },
  '& ol': {
    margin: '3px',
    marginBlockEnd: '0.5em',
    padding: '0px 20px 0px 20px',
    listStylePosition: 'outside',
    lineHeight: '0'
  },
  '& li': {
    margin: '0px',
    padding: '0px',
    lineHeight: '1.5',
    marginBlockEnd: '0.5em',
    '& > *': {
      verticalAlign: 'top',
    }
  },
  '& li > p': {
    marginBlockStart: '0em',
    marginBlockEnd: '0.2em',
  },
  '& pre': {
    marginBlockStart: '0.5em',
    marginBlockEnd: '0.5em',
  },
  '& li > code, & p > code': {
    backgroundColor: theme.palette.mode === 'dark' ? '#2e2e2e' : '#f5f5f5',
    color: theme.palette.mode === 'dark' ? '#f5f5f5' : '#b71c1c',
    borderRadius: '3px',
    padding: '0.2em 0.4em',
    fontFamily: 'Consolas, "BIZ UDGothic", Monaco, "Andale Mono", "Ubuntu Mono", monospace',
    fontSize: '0.9em',
  },
  '& blockquote, & li > blockquote': {
    borderLeft: `4px solid ${theme.palette.mode === 'dark' ? '#2e2e2e' : '#ddd'}`,
    paddingLeft: '1em',
    margin: '0 0 1em 0',
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#f9f9f9',
  }
}));

const CopyButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: '4px',
  right: '4px',
  padding: '2px',
  color: theme.palette.text.secondary,
  display: 'none',
  '&:hover': {
    color: theme.palette.mode === 'dark' ? '#ffffff' : '#000000',
  },
}));

function Message({ message }) {
  const { role, content } = message;
  const messageContentRef = useRef(null);

  const md = new Remarkable({
    html: true,
    highlight: function (str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          const code = hljs.highlight(str, { language: lang }).value;
          return `<pre class="hljs"><div class="code-header"><span class="language">${lang}</span><button class="copy-button">Copy</button></div><code>${code}</code></pre>`;
        } catch (error) {
          console.error('Error highlighting code:', error);
        }
      }
      return `<pre class="hljs"><div class="code-header"><span class="language">Code</span><button class="copy-button">Copy</button></div><code>${escapeHtml(str)}</code></pre>`;
    },
  });

  const sanitizedContent = DOMPurify.sanitize(md.render(content));

  const handleCopyClick = (event) => {
    event.stopPropagation();
    const codeElement = event.target.parentNode.nextElementSibling;
    const code = codeElement.textContent;
    navigator.clipboard.writeText(code);
    event.target.textContent = 'Copied!';
    setTimeout(() => {
      event.target.textContent = 'Copy';
    }, 1000);
  };

  const handleClickLink = (event, url) => {
    event.preventDefault();
    console.log("click link", url);
    api.openLink(url);
  };

  const replace = (node) => {
    if (node.name === 'a' && node.attribs.href) {
      return (
        <a
          {...node.attribs}
          onClick={(event) => handleClickLink(event, node.attribs.href)}
        >
          {domToReact(node.children)}
        </a>
      );
    }
  };

  const parsedContent = parse(sanitizedContent, { replace });
  
  useEffect(() => {
    const messageContentElement = messageContentRef.current;
    renderMathInElement(messageContentElement, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\(', right: '\\)', display: false},
        {left: '\\[', right: '\\]', display: true}
      ],
      throwOnError: false
    });

    const copyButtons = messageContentElement.querySelectorAll('.copy-button');
    copyButtons.forEach((button) => {
      button.addEventListener('click', handleCopyClick);
    });

    return () => {
      copyButtons.forEach((button) => {
        button.removeEventListener('click', handleCopyClick);
      });
    };
  }, [sanitizedContent]);

  return (
    <MessageContainer role={role}>
      <MessageHeader>
        {role === 'user' && <UserIcon />}
        {role === 'assistant' && <BotIcon />}
        <MessageContent ref={messageContentRef}>
          {parsedContent}
        </MessageContent>
      </MessageHeader>
      {role === 'assistant' && (
        <CopyToClipboard text={content}>
          <Tooltip title="Copy to Clipboard" placement="top">
            <CopyButton className="copy-button" aria-label="copy">
              <CopyIcon fontSize="small" />
            </CopyButton>
          </Tooltip>
        </CopyToClipboard>
      )}
    </MessageContainer>
  );
}

export default Message;
