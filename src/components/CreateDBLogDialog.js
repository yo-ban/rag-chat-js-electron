import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Button, 
  List, ListItem, ListItemText, Typography, Paper
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Check, Error } from '@mui/icons-material';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: theme.spacing(1),
    boxShadow: theme.shadows[3],
  },
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  borderBottom: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(2),
  fontFamily: 'inherit',
  fontSize: '1.2rem',
  fontWeight: 'bold',
}));

const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(3),
}));

const StyledMessage = styled(Typography)(({ theme }) => ({
  fontSize: '1rem',
  marginBottom: theme.spacing(2),
  color: theme.palette.text.secondary,
  display: 'flex',
  alignItems: 'center',
  paddingTop: theme.spacing(1),
  gap: theme.spacing(1),
}));

const StyledList = styled(List)(({ theme }) => ({
  maxHeight: '300px',
  overflowY: 'auto',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
}));

const StyledListItem = styled(ListItem)(({ theme }) => ({
  padding: theme.spacing(0.5, 1),
  borderBottom: `1px solid ${theme.palette.divider}`,
  '&:last-child': {
    borderBottom: 'none',
  },
}));

const StyledListItemText = styled(ListItemText)(({ theme }) => ({
  '& .MuiListItemText-primary': {
    fontSize: '0.9rem',
  },
  margin: 0,
}));

const StyledDialogActions = styled(DialogActions)(({ theme }) => ({
  padding: theme.spacing(2),
  justifyContent: 'flex-end',
  borderTop: `1px solid ${theme.palette.divider}`,
}));

const ActionButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  borderRadius: theme.spacing(0.5),
  padding: theme.spacing(0.5, 2),
}));

const CreateDBLogDialog = ({ open, onClose, log, success, message }) => {
  const { t } = useTranslation();

  return (
    <StyledDialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <StyledDialogTitle>
        {t('vectorDBCreationResult')}
      </StyledDialogTitle>
      <StyledDialogContent>
        <StyledMessage>
          {success ? <Check color="primary" /> : <Error color="error" />}
          {message}
        </StyledMessage>
        <Paper elevation={0}>
          <StyledList>
            {log.map((item, index) => (
              <StyledListItem key={index}>
                <StyledListItemText primary={item} />
              </StyledListItem>
            ))}
          </StyledList>
        </Paper>
      </StyledDialogContent>
      <StyledDialogActions>
        <ActionButton onClick={onClose} color="primary">
          {t('close')}
        </ActionButton>
      </StyledDialogActions>
    </StyledDialog>
  );
};

export default CreateDBLogDialog;
