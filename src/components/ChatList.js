import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';  
import {
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  ListItemButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { styled } from '@mui/material/styles';

const StyledListItemButton = styled(ListItemButton)(({ theme, selected }) => ({
  backgroundColor: selected ? theme.palette.action.selected : 'transparent',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  '&:hover': {
    color: theme.palette.error.main,
  },
}));

const StyledListItemText = styled(ListItemText)({
  display: 'block',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontSize: '0.9rem',
  '& .MuiListItemText-secondary': {
    display: 'block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize: '0.7rem',
  },
});

function ChatList({ chatList, setActiveChat, handleDeleteChat, selectedChatId }) {
  const { t } = useTranslation();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState(null);
  const [chatToDeleteName, setChatToDeleteName] = useState(null);

  const onChatClick = useCallback((chat) => {
    setActiveChat(chat);
  }, [setActiveChat]);

  const onDeleteClick = useCallback((chatId, chatName) => {
    setChatToDelete(chatId);
    setChatToDeleteName(chatName);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (chatToDelete) {
      handleDeleteChat(chatToDelete);
      setDeleteDialogOpen(false);
      setChatToDelete(null);
    }
  }, [chatToDelete, handleDeleteChat]);

  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setChatToDelete(null);
  }, []);

  return (
    <>
      <List>
        {chatList.map((chat) => (
          <ListItem key={chat.id} disablePadding>
            <StyledListItemButton
              onClick={() => onChatClick(chat)}
              selected={chat.id === selectedChatId}
            >
              <StyledListItemText primary={chat.name} secondary={chat.preview} />
            </StyledListItemButton>
            <ListItemSecondaryAction>
              <StyledIconButton edge="end" aria-label="delete" onClick={() => onDeleteClick(chat.id, chat.name)}>
                <DeleteIcon />
              </StyledIconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>{t('confirmDeleteChat')}</DialogTitle>
        <DialogContent>
          <Typography>{t('areYouSureDeleteChat', { chatName: chatToDeleteName })}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>{t('cancel')}</Button>
          <Button onClick={handleConfirmDelete} color="error">{t('delete')}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default ChatList;
