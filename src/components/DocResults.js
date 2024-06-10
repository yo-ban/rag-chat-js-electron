import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, styled, Link, Typography, Tooltip, Card, CardContent, Modal, Backdrop, Fade, Tabs, Tab } from '@mui/material';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import api from '../services/api';

const ResultsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  fontFamily: "inherit",
  marginBottom: '15px',
}));

const DocCard = styled(Card)(({ theme }) => ({
  flex: '1 1 calc(33.333% - 16px)',
  minWidth: 110,
  maxWidth: 200,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.border.main}`,
  boxShadow: theme.shadows[1],
}));

const CustomCardContent = styled(CardContent)(({ theme }) => ({
  padding: '10px',
  '&:last-child': {
    paddingBottom: '10px',
  },
}));

const DocLink = styled(Link)(({ theme }) => ({
  textDecoration: 'none',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  color: theme.palette.primary.main,
  display: 'inline-block',
  maxWidth: '100%',
  '&:hover': {
    textDecoration: 'underline',
  },
}));

const IconContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(2),
  marginTop: theme.spacing(1),
}));

const StyledIcon = styled(Box)(({ theme }) => ({
  cursor: 'pointer',
  transition: 'color 0.3s',
  '&:hover': {
    color: theme.palette.primary.main,
  },
}));

const ModalContent = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '70%',
  maxHeight: '85%',
  minHeight: '65%',
  overflowY: 'auto',
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[5],
  padding: theme.spacing(2, 4, 3),
  outline: 'none',
  borderRadius: '8px',
}));

const FileTitle = styled(Typography)(({ theme }) => ({
  fontSize: '0.775rem',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
}));

const ModalTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  fontWeight: 'bold',
  fontFamily: "inherit",
  color: theme.palette.text.primary,
}));

const ModalText = styled(Typography)(({ theme }) => ({
  whiteSpace: 'pre-wrap',
  color: theme.palette.text.secondary,
  fontSize: '14px',
}));

function DocResults({ results }) {
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const [modalContent, setModalContent] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [modalFileName, setModalFileName] = useState('');

  const excludedFields = ['chunkId', 'source']; 

  const handleOpen = (data, fileName) => {
    setModalContent(data);
    setModalFileName(fileName);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setTabValue(0);
    setModalContent([]);
    setModalFileName("");
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const groupedResults = results.reduce((acc, result, index) => {
    const { metadata = {} } = result;
    const { source = t('unknownSource') } = metadata;

    const fileName = source.split('\\').pop().split('/').pop();
    if (!acc[fileName]) {
      acc[fileName] = [];
    }
    acc[fileName].push({ ...result, originalIndex: index });
    return acc;
  }, {});

  return (
    <>
      <ResultsContainer>
        {Object.keys(groupedResults).map((fileName, index) => {
          const fileResults = groupedResults[fileName];
          const { source = t('unknownSource') } = fileResults[0].metadata;

          const handleClickFile = (event) => {
            event.preventDefault();
            if (source !== t('unknownSource')) {
              api.openLocalFile(source);
            }
          };

          const handleClickFolder = (event) => {
            event.preventDefault();
            if (source !== t('unknownSource')) {
              const folderPath = source.lastIndexOf('\\') > -1 
                ? source.substring(0, source.lastIndexOf('\\')) 
                : source.substring(0, source.lastIndexOf('/'));
              api.openLocalFile(folderPath);
            }
          };

          const modalData = fileResults.map((result) => {
            const { pageContent, combinedScore, metadata = {}, originalIndex } = result;
            const filteredMetadata = Object.keys(metadata)
              .filter(key => !excludedFields.includes(key))
              .reduce((obj, key) => {
                obj[key] = metadata[key];
                return obj;
              }, {});
  
            return {
              pageContent,
              combinedScore,
              metadata: filteredMetadata,
              originalIndex
            };
          });

          return (
            <DocCard key={index}>
              <CustomCardContent>
                <Tooltip title={source} placement="top">
                  <DocLink href="#" onClick={handleClickFile}>
                    <FileTitle variant="body2" noWrap>{fileName}</FileTitle>
                  </DocLink>
                </Tooltip>
                <IconContainer>
                  <Tooltip title={t('openSourceFile')}>
                    <StyledIcon>
                      <FileOpenIcon fontSize="medium" onClick={handleClickFile} />
                    </StyledIcon>
                  </Tooltip>
                  <Tooltip title={t('openSourceFolder')}>
                    <StyledIcon>
                      <FolderOpenIcon fontSize="medium" onClick={handleClickFolder} />
                    </StyledIcon>
                  </Tooltip>
                  <Tooltip title={t('viewSearchResults')}>
                    <StyledIcon>
                      <ZoomInIcon fontSize="medium" onClick={() => handleOpen(modalData, fileName)} />
                    </StyledIcon>
                  </Tooltip>
                </IconContainer>
              </CustomCardContent>
            </DocCard>
          );
        })}
      </ResultsContainer>
      <Modal
        aria-labelledby="transition-modal-title"
        aria-describedby="transition-modal-description"
        open={open}
        onClose={handleClose}
        closeAfterTransition
        slots={{ backdrop: Backdrop }}
        slotProps={{
          backdrop: {
            timeout: 500,
          },
        }}
      >
        <Fade in={open}>
          <ModalContent>
            <ModalTitle id="transition-modal-title">{t('documentContent')}: {modalFileName}</ModalTitle>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              aria-label="doc results tabs"
              variant="scrollable"
              scrollButtons="auto"
            >
              {modalContent.map((content, index) => (
                <Tab label={`${t('result')} ${content.originalIndex + 1}`} key={index} />
              ))}
            </Tabs>
            {modalContent.map((content, index) => (
              <TabPanel value={tabValue} index={index} key={index}>
                <ModalText id="transition-modal-description">
                  <strong>{t('score')}:</strong> {content.combinedScore ? content.combinedScore.toFixed(2) : 'N/A'}
                </ModalText>
                <ModalText id="transition-modal-description">-------------</ModalText>
                {Object.keys(content.metadata).map((key) => (
                  <ModalText key={key} id="transition-modal-description">
                    <strong>{key}:</strong> 
                    {typeof content.metadata[key] === 'object' ? JSON.stringify(content.metadata[key]) : content.metadata[key]}
                  </ModalText>
                ))}
                <ModalText id="transition-modal-description">-------------</ModalText>
                <ModalText id="transition-modal-description">{content.pageContent}</ModalText>
              </TabPanel>
            ))}
          </ModalContent>
        </Fade>
      </Modal>
    </>
  );
};

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box p={3}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default DocResults;
