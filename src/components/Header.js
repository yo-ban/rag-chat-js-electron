import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AppBar, Toolbar, Typography, IconButton, TextField, Menu, MenuItem, FormControl, Select, InputLabel } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import SettingsDialog from './SettingsDialog';
import { styled } from '@mui/material/styles';

const HeaderAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: theme.palette.background.appBar,
  boxShadow: 'none',
  color: theme.palette.text.secondary,
}));

const TitleTypography = styled(Typography)(({ theme }) => ({
  flexGrow: 1,
  color: theme.palette.text.primary,
  display: 'flex',
  alignItems: 'center',
}));

const TitleEditInput = styled(TextField)(({ theme }) => ({
  marginLeft: theme.spacing(1),
  flexGrow: 1,
}));

const EditIconButton = styled(IconButton)(({ theme }) => ({
  marginLeft: theme.spacing(1),
}));

function Header({ toggleDrawer, activeChat, updateChat, databases }) {
  const { t } = useTranslation();

  const [anchorEl, setAnchorEl] = useState(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState(activeChat ? activeChat.name : '');
  const [selectedDatabase, setSelectedDatabase] = useState(activeChat ? activeChat.dbName || 'None' : 'None');
  const titleInputRef = useRef(null);

  const handleMenuOpen = useCallback((event) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleSettingsOpen = useCallback(() => {
    setSettingsDialogOpen(true);
    handleMenuClose();
  }, [handleMenuClose]);

  const handleSettingsClose = useCallback(() => {
    setSettingsDialogOpen(false);
  }, []);

  const handleEditTitleClick = useCallback(() => {
    setIsEditingTitle(true);
  }, []);

  const handleTitleChange = useCallback((event) => {
    setNewTitle(event.target.value);
  }, []);

  const handleSaveTitle = useCallback(() => {
    updateChat({ ...activeChat, name: newTitle });
    setIsEditingTitle(false);
  }, [activeChat, newTitle, updateChat]);

  const handleDatabaseChange = useCallback((event) => {
    const newDbName = event.target.value;
    setSelectedDatabase(newDbName);
    updateChat({ ...activeChat, dbName: newDbName === 'None' ? null : newDbName });
  }, [activeChat, updateChat]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    setNewTitle(activeChat ? activeChat.name : '');
    setSelectedDatabase(activeChat ? activeChat.dbName || 'None' : 'None');
  }, [activeChat]);

  console.log("activeChat in Header:", activeChat);

  return (
    <HeaderAppBar position="static">
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        <IconButton
          edge="start"
          color="inherit"
          aria-label="menu"
          onClick={toggleDrawer(true)}
          sx={{ mr: 1, ml: 1 }}
        >
          <MenuIcon />
        </IconButton>
        {isEditingTitle ? (
          <TitleEditInput
            inputRef={titleInputRef}
            value={newTitle}
            onChange={handleTitleChange}
            onBlur={handleSaveTitle}
            variant="standard"
          />
        ) : (
          <TitleTypography variant="h6">
            {activeChat ? activeChat.name : 'Chat Title'}
            <EditIconButton
              color="inherit"
              onClick={handleEditTitleClick}
            >
              <EditIcon />
            </EditIconButton>
          </TitleTypography>
        )}
        <FormControl variant="outlined" size="small" sx={{ minWidth: 190, ml: 2, mr: 2 }}>
          <InputLabel id="db-select-label">{t('selectDatabase')}</InputLabel>
          <Select
            labelId="db-select-label"
            id="db-select"
            value={selectedDatabase}
            onChange={handleDatabaseChange}
            label={t('selectDatabase')}
          >
            {databases.map((dbName) => (
              <MenuItem key={dbName} value={dbName}>
                {dbName}
              </MenuItem>
            ))}
            <MenuItem value="None">{t('none')}</MenuItem>
          </Select>
        </FormControl>
        <IconButton color="inherit">
          <SearchIcon />
        </IconButton>
        <IconButton color="inherit" onClick={handleMenuOpen}>
          <MoreVertIcon />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleSettingsOpen}>{t('chatSettings')}</MenuItem>
        </Menu>
      </Toolbar>
      <SettingsDialog 
        open={settingsDialogOpen} 
        handleClose={handleSettingsClose} 
        activeChat={activeChat} 
        updateChat={updateChat} 
        databases={databases}
      />
    </HeaderAppBar>
  );
}

export default Header;