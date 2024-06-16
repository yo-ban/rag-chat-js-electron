import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Accordion, 
  AccordionSummary, 
  AccordionDetails, 
  Typography, 
  Button, 
  IconButton 
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CreateDBDialog from './CreateDBDialog';
import api from '../services/api';

const StyledAccordion = styled(Accordion)(({ theme }) => ({
  marginBottom: '4px',
  borderBottom: 'none',
  borderTop: 'none',
  '&:before': {
    display: 'none',
  },
}));

const StyledAccordionSummary = styled(AccordionSummary)(({ theme }) => ({
  minHeight: '38px',
  height: '38px',
  '&.Mui-expanded': {
    minHeight: '42px',
    height: '42px',
    '&:hover': {
      background: 'transparent',
    },
  },
  '&:hover': {
    background: theme.palette.action.hover,
  },
}));

const StyledDocumentList = styled('div')({
  padding: 0,
  borderBottom: '1px solid #eee',
});

const StyledListItem = styled('div')(({ theme }) => ({
  padding: '0px 4px',
  borderBottom: '1px solid #eee',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center', // 削除ボタンが中央に配置されるようにする
  '&:last-of-type': {
    borderBottom: 'none',
  },
}));

const FileName = styled(Typography)(({ theme }) => ({
  flex: 1, // ファイル名部分が利用可能なスペースを全て使うようにする
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  marginRight: theme.spacing(1), // 削除ボタンとの間に余白を設ける
}));

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  padding: 0.6,
  marginRight: '0px',
  '&:hover': {
    color: theme.palette.error.main,
  },
}));

const DatabaseAccordion = ({ dbName, dbDescription, language, handleOpenDeleteDialog }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [createDBDialogOpen, setCreateDBDialogOpen] = useState(false);

  const loadDocuments = async (dbName) => {
    try {
      const docNames = await api.getDocumentNames(dbName);
      setDocuments(docNames);
    } catch (error) {
      console.error(t('errorLoadingDatabase'), error);
    }
  };

  const handleAccordionToggle = (event, isExpanded) => {
    setExpanded(isExpanded ? dbName : false);
    if (isExpanded) {
      loadDocuments(dbName);
    }
  };

  const handleOpenCreateDBDialog = () => {
    setCreateDBDialogOpen(true);
  };

  const handleCloseCreateDBDialog = () => {
    setCreateDBDialogOpen(false);
  };

  const handleCreateDBDialogComplete = () => {
    loadDocuments(dbName);
    handleCloseCreateDBDialog();
  };

  const handleDeleteDocument = async (docName) => {
    try {
      await api.deleteDocumentFromDatabase(dbName, docName);
      setDocuments(await api.getDocumentNames(dbName));
    } catch (error) {
      console.error(t('errorDeletingDocument'), error);
    }
  };

  return (
    <StyledAccordion
      expanded={expanded === dbName}
      onChange={handleAccordionToggle}
    >
      <StyledAccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls={`${dbName}-content`}
        id={`${dbName}-header`}
      >
        <Typography>{dbName}</Typography>
      </StyledAccordionSummary>
      <AccordionDetails sx={{ paddingTop: 0, paddingBottom: 0 }}>
        <StyledDocumentList>
          {documents.map((docName) => (
            <StyledListItem key={docName}>
              <FileName variant="caption">
                {docName.split('/').pop()}
              </FileName>
              <StyledIconButton edge="end" onClick={() => handleDeleteDocument(docName)}>
                <DeleteIcon sx={{fontSize: '20px'}} />
              </StyledIconButton>
            </StyledListItem>
          ))}
        </StyledDocumentList>
        <Button 
          onClick={handleOpenCreateDBDialog}
          startIcon={<AddIcon />}
          fullWidth
          disabled={!expanded}
        >
          {t('addDocument')}
        </Button>
        <Button
          color="error"
          onClick={() => handleOpenDeleteDialog(dbName)}
          fullWidth
        >
          {t('deleteDatabase')}
        </Button>
      </AccordionDetails>
      <CreateDBDialog
        open={createDBDialogOpen}
        onClose={handleCloseCreateDBDialog}
        onCreate={handleCreateDBDialogComplete}
        language={language}
        dbName={dbName}
        dbDescription={dbDescription}
      />
    </StyledAccordion>
  );
};

export default DatabaseAccordion;
