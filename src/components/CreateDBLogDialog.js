import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Button, 
  List, ListItem, ListItemText, Typography
} from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledLogDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialogTitle-root': {
    fontSize: '1.2rem',
    fontWeight: 'bold',
  },
  '& .MuiDialogContent-root': {
    padding: theme.spacing(2),
  },
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  fontSize: '1.2rem',
  fontWeight: 'bold',
}));

const StyledMessage = styled(Typography)(({ theme }) => ({
  fontSize: '0.9rem',
  marginBottom: theme.spacing(2),
}));

const StyledList = styled(List)(({ theme }) => ({
  maxHeight: '300px',
  overflowY: 'auto',
}));

const StyledListItem = styled(ListItem)(({ theme }) => ({
  padding: theme.spacing(0.5, 1),
}));

const StyledListItemText = styled(ListItemText)(({ theme }) => ({
  '& .MuiListItemText-primary': {
    fontSize: '0.8rem',
  },
}));

const CreateDBLogDialog = ({ open, onClose, log, success, message }) => {
  const { t } = useTranslation();

  return (
    <StyledLogDialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <StyledDialogTitle>{success ? t('operationSuccessful') : t('operationFailed')}</StyledDialogTitle>
      <DialogContent>
        <StyledMessage variant="body1" gutterBottom>{message}</StyledMessage>
        <StyledList>
          {log.map((item, index) => (
            <StyledListItem key={index}>
              <StyledListItemText primary={item} />
            </StyledListItem>
          ))}
        </StyledList>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          {t('close')}
        </Button>
      </DialogActions>
    </StyledLogDialog>
  );
};

export default CreateDBLogDialog;
