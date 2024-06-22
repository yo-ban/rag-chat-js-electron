import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, 
  List, ListItem, ListItemText, IconButton, LinearProgress, Typography, 
  Menu, MenuItem, Slider, Grid, Stack, Tooltip, FormControl, InputLabel, 
  Select, CircularProgress
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, InsertDriveFile as FileIcon, AutoFixHigh } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import api from '../services/api';
import CreateDBLogDialog from './CreateDBLogDialog';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    width: '65%',
    minWidth: '800px',
    maxWidth: 'none',
  },
}));

const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'row',
  gap: theme.spacing(2),
  padding: theme.spacing(3),
}));

const LeftColumn = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  gap: theme.spacing(2),
}));

const RightColumn = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  gap: theme.spacing(2),
}));

const FileList = styled(List)(({ theme }) => ({
  maxHeight: 400,
  overflowY: 'auto',
  padding: theme.spacing(1),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
}));

const FileListItem = styled(ListItem)(({ theme }) => ({
  padding: theme.spacing(1),
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box',
  overflowX: 'hidden',
}));

const FileName = styled(ListItemText)(({ theme }) => ({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  marginLeft: theme.spacing(1),
  '& .MuiListItemText-primary': {
    fontSize: '0.875rem',
  },
}));

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  marginRight: '0px',
  padding: 0.6,
  '&:hover': {
    color: theme.palette.error.main,
  },
}));

const CustomTextField = styled(TextField)(({ theme }) => ({
  marginTop: theme.spacing(2),
  '& .Mui-disabled': {
    color: theme.palette.text.disabled,
  },
  '& .MuiInputBase-input': {
    padding: "12px 12px",
  }
}));

const CustomTextFieldMutiline = styled(TextField)(({ theme }) => ({
  marginTop: theme.spacing(2),
  '& .Mui-disabled': {
    color: theme.palette.text.disabled,
  },
  '& .MuiInputBase-root': {
    padding: "0px 0px",
  },
  '& .MuiInputBase-input': {
    padding: "12px 12px",
  }
}));

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  marginTop: theme.spacing(2),
}));

const ClearButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
}));

const StyledSliderBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

const StyledGridItem = styled(Grid)(({ theme }) => ({
  paddingRight: theme.spacing(1),
}));

const StyledFormControl = styled(FormControl)(({ theme }) => ({
  marginTop: theme.spacing(2),
  width: '100%',
}));

const CreateDBDialog = ({ open, onClose, onCreate, language, databases, dbName = null, dbDescription = null }) => {
  const { t } = useTranslation();

  const [newDatabaseName, setNewDatabaseName] = useState(dbName || '');
  const [newDatabaseDescription, setNewDatabaseDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [chunkSize, setChunkSize] = useState(512);
  const [overlapPercentage, setOverlapPercentage] = useState(25);
  const [folderDepth, setFolderDepth] = useState(3);
  const [nameError, setNameError] = useState('');
  const [excludePattern, setExcludePattern] = useState('');
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [operationLog, setOperationLog] = useState({ success: false, message: '', log: [] });
  
  const toastId = useRef(null);

  const handleFileSelect = useCallback(async () => {
    setIsLoadingFiles(true);
    try {
      const filePaths = await api.openFileDialog({ properties: ['openFile', 'multiSelections'], folderDepth: folderDepth });
      if (filePaths && filePaths.length > 0) {
        const excludePatterns = excludePattern.split(',').filter(pattern => pattern.trim() !== '');
        const newFiles = filePaths.filter((filePath) => {
          const isNotDuplicate = !selectedFiles.includes(filePath);
          const isNotExcluded = excludePatterns.length === 0 || excludePatterns.every(pattern => !filePath.includes(pattern.trim()));
          return isNotDuplicate && isNotExcluded;
        });
        
        setSelectedFiles(prevFiles => [...prevFiles, ...newFiles]);
        console.log("New files added:", newFiles);
        console.log("Updated selected files:", [...selectedFiles, ...newFiles]);
      }
    } catch (error) {
      console.error(t('fileSelectionFailed'), error);
      toast.error(t('fileSelectionFailedWithMessage', {message: error.message}));
    } finally {
      setIsLoadingFiles(false);
    }
  }, [folderDepth, t, excludePattern, selectedFiles]);

  const handleFolderSelect = useCallback(async () => {
    setIsLoadingFiles(true);
    try {
      const folderPaths = await api.openFileDialog({ properties: ['openDirectory', 'multiSelections'], folderDepth: folderDepth });
      if (folderPaths && folderPaths.length > 0) {
        const excludePatterns = excludePattern.split(',').filter(pattern => pattern.trim() !== '');
        const newFolders = folderPaths.filter((folderPath) => {
          const isNotDuplicate = !selectedFiles.includes(folderPath);
          const isNotExcluded = excludePatterns.length === 0 || excludePatterns.every(pattern => !folderPath.includes(pattern.trim()));
          return isNotDuplicate && isNotExcluded;
        });
        
        setSelectedFiles(prevFiles => [...prevFiles, ...newFolders]);
        console.log("New folders added:", newFolders);
        console.log("Updated selected files:", [...selectedFiles, ...newFolders]);
      }
    } catch (error) {
      console.error(t('folderSelectionFailed'), error);
      toast.error(t('folderSelectionFailedWithMessage', {message: error.message}));
    } finally {
      setIsLoadingFiles(false);
    }
  }, [folderDepth, t, excludePattern, selectedFiles]);

  useEffect(() => {
    console.log("Current selected files:", selectedFiles);
  }, [selectedFiles]);

  const handleClearFiles = useCallback(() => {
    setSelectedFiles([]);
  }, []);

  const handleRemoveFile = useCallback((index) => {
    setSelectedFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  }, []);

  const handleGenerateDbInfo = useCallback(async () => {
    const { dbName: generatedDbName, dbDescription: generatedDbDescription } = await api.generateDbInfo(selectedFiles, language);
    setNewDatabaseName(generatedDbName || '');
    setNewDatabaseDescription(generatedDbDescription || '');  
  }, [selectedFiles, language]);

  const handleCreateDatabase = useCallback(async () => {
    if (newDatabaseName && selectedFiles.length > 0 && !nameError) {
      try {
        setIsCreating(true);
        setProgressMessage(t('startingDatabaseCreation'));
        const result = await api.createDatabase(newDatabaseName, selectedFiles, chunkSize, overlapPercentage, newDatabaseDescription);
        setOperationLog(result);
        setLogDialogOpen(true);
        if (result.success) {
          onCreate(newDatabaseName);
          setNewDatabaseName('');
          setNewDatabaseDescription('');
          setSelectedFiles([]);
        }
      } catch (error) {
        console.error(t('databaseCreationFailed'), error);
        setOperationLog({
          success: false,
          message: t('databaseCreationFailedWithMessage', {message: error.message || 'Unknown error'}),
          log: [error.toString()]
        });
        setLogDialogOpen(true);
      } finally {
        setIsCreating(false);
        setProgressMessage('');
      }
    }
  }, [newDatabaseName, selectedFiles, t, onCreate, chunkSize, overlapPercentage, newDatabaseDescription, nameError]);

  const handleAddDocuments = useCallback(async () => {
    if (dbName && selectedFiles.length > 0) {
      try {
        setIsCreating(true);
        setProgressMessage(t('startingDocumentAddition'));
        const result = await api.addDocumentsToDatabase(dbName, selectedFiles, chunkSize, overlapPercentage, newDatabaseDescription);
        setOperationLog(result);
        setLogDialogOpen(true);
        onCreate(dbName);
        setSelectedFiles([]);
        setIsCreating(false);
      } catch (error) {
        console.error(t('documentAdditionFailed'), error);
        setProgressMessage(t('documentAdditionFailedWithMessage', {message: error}));
        setOperationLog({
          success: false,
          message: t('documentAdditionFailedWithMessage', {message: error}),
          log: [error.toString()]
        });
        setLogDialogOpen(true);
        setIsCreating(false);
      }
    }
  }, [dbName, selectedFiles, t, onCreate, chunkSize, overlapPercentage, newDatabaseDescription]);

  const handleCloseLogDialog = useCallback(() => {
    setLogDialogOpen(false);
    if (operationLog.success) {
      onClose();
    }
  }, [onClose, operationLog.success]);

  const handleNameChange = useCallback((e) => {
    const newName = e.target.value;
    setNewDatabaseName(newName);
    if (!dbName && databases.includes(newName)) {
      setNameError(t('databaseNameAlreadyExists', {dbName: newName}));
    } else {
      setNameError('');
    }
  }, [databases, t, dbName]);

  const handleDescriptionChange = useCallback((e) => {
    setNewDatabaseDescription(e.target.value);
  }, []);

  const handleExcludePatternChange = useCallback((e) => {
    setExcludePattern(e.target.value);
  }, []);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleFolderDepthChange = (event) => {
    setFolderDepth(event.target.value);
  };
  
  const handleChunkSizeSliderChange = (event, newValue) => {
    setChunkSize(newValue);
  };

  const handleChunkSizeInputChange = (event) => {
    setChunkSize(event.target.value === '' ? '' : Number(event.target.value));
  };

  const handleOverlapPercentageSliderChange = (event, newValue) => {
    setOverlapPercentage(newValue);
  };

  const handleOverlapPercentageInputChange = (event) => {
    setOverlapPercentage(event.target.value === '' ? '' : Number(event.target.value));
  };

  const truncateFileName = (fileName) => {
    const maxLength = 50;
    if (fileName.length <= maxLength) return fileName;

    const extension = fileName.split('.').pop();
    const name = fileName.slice(0, fileName.length - extension.length - 1);
    return name.slice(0, 20) + '...' + name.slice(-20) + '.' + extension;
  };

  useEffect(() => {
    if (!open) {
      setNewDatabaseName(dbName || '');
      setNewDatabaseDescription(dbDescription || '');
      setSelectedFiles([]);
      setProgressMessage('');
      setChunkSize(512);
      setOverlapPercentage(25);
      setNameError('');
      setExcludePattern('');
      if (toastId.current) {
        toast.dismiss(toastId.current);
        toastId.current = null;
      }
    }
  }, [open, dbName, dbDescription]);

  useEffect(() => {
    const handleProgress = (message) => {
      setProgressMessage(message);
    };
    
    api.onDatabaseProgress(handleProgress);

    return () => {
      api.removeListener('database-progress', handleProgress);
    };
  }, []);
    
  return (
    <>
      <StyledDialog open={open} onClose={!isCreating && !isLoadingFiles ? onClose : null}>
        <DialogTitle>{dbName ? t('addDocuments') : t('createNewDatabase')}</DialogTitle>
        <StyledDialogContent>
          <LeftColumn>
            {!dbName && (
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <StyledButton
                  variant="outlined"
                  startIcon={<AutoFixHigh />}
                  onClick={handleGenerateDbInfo}
                  disabled={selectedFiles.length === 0}
                >
                  {t('generateDbInfo')}
                </StyledButton>
              </Box>
            )}
            <CustomTextField
              label={t('databaseName')}
              value={newDatabaseName}
              onChange={handleNameChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
              InputProps={{
                readOnly: Boolean(dbName),
                tabIndex: Boolean(dbName) ? -1 : 0,
              }}
              error={!dbName && Boolean(nameError)}
              helperText={!dbName && nameError}
              disabled={Boolean(dbName)}
            />
            <CustomTextFieldMutiline
              label={t('databaseDescription')}
              value={newDatabaseDescription}
              onChange={handleDescriptionChange}
              fullWidth
              multiline
              rows={2}
              placeholder={t('databaseDescriptionPlaceholder')}
              InputLabelProps={{ shrink: true }}
            />
            <StyledFormControl>
              <Tooltip title={t('folderDepthTooltip')} arrow placement="top">
                <InputLabel id="folder-depth-select-label">{t('folderDepth')}</InputLabel>
              </Tooltip>
              <Select
                labelId="folder-depth-select-label"
                value={folderDepth}
                onChange={handleFolderDepthChange}
                label={t('folderDepth')}
              >
                {[...Array(11).keys()].map((depth) => (
                  <MenuItem key={depth} value={depth}>
                    {depth}
                  </MenuItem>
                ))}
              </Select>
            </StyledFormControl>
            <CustomTextField
                label={t('excludePattern')}
                value={excludePattern}
                onChange={handleExcludePatternChange}
                placeholder={t('excludePatternPlaceholder')}
                InputLabelProps={{ shrink: true }}
            />
            <StyledSliderBox>
              <Typography id="chunk-size-slider" gutterBottom>
                <Tooltip title={t('chunkSizeTooltip')} arrow placement="top">
                  <span>{t('chunkSize')}</span>
                </Tooltip>
              </Typography>
              <Grid container alignItems="center">
                <StyledGridItem item xs={9}>
                  <Slider
                    value={chunkSize}
                    min={128}
                    max={1024}
                    step={128}
                    onChange={handleChunkSizeSliderChange}
                    aria-labelledby="chunk-size-slider"
                    valueLabelDisplay="auto"
                  />
                </StyledGridItem>
                <Grid item xs={3}>
                  <Stack direction="row" alignItems="center" justifyContent="flex-end">
                    <CustomTextField
                      value={chunkSize}
                      onChange={handleChunkSizeInputChange}
                      type="number"
                      inputProps={{
                        min: 128,
                        max: 1024,
                        step: 128,
                      }}
                      sx={{ width: '80px' }}
                    />
                  </Stack>
                </Grid>
              </Grid>
            </StyledSliderBox>
            <StyledSliderBox>
              <Typography id="overlap-percentage-slider" gutterBottom>
                <Tooltip title={t('overlapPercentageTooltip')} arrow placement="top">
                  <span>{t('overlapPercentage')}</span>
                </Tooltip>
              </Typography>
              <Grid container alignItems="center">
                <StyledGridItem item xs={9}>
                  <Slider
                    value={overlapPercentage}
                    min={0}
                    max={50}
                    step={5}
                    onChange={handleOverlapPercentageSliderChange}
                    aria-labelledby="overlap-percentage-slider"
                    valueLabelDisplay="auto"
                  />
                </StyledGridItem>
                <Grid item xs={3}>
                  <Stack direction="row" alignItems="center" justifyContent="flex-end">
                    <CustomTextField
                      value={overlapPercentage}
                      onChange={handleOverlapPercentageInputChange}
                      type="number"
                      inputProps={{
                        min: 0,
                        max: 50,
                        step: 5,
                      }}
                      sx={{ width: '80px' }}
                    />
                  </Stack>
                </Grid>
              </Grid>
            </StyledSliderBox>
          </LeftColumn>
          <RightColumn>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <StyledButton
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleMenuOpen}
                disabled={isCreating || isLoadingFiles}
              >
                {t('addFiles')}
              </StyledButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
              >
                <MenuItem onClick={handleFileSelect}>{t('selectFiles')}</MenuItem>
                <MenuItem onClick={handleFolderSelect}>{t('selectFolders')}</MenuItem>
              </Menu>
              {selectedFiles.length > 0 && (
                <ClearButton
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleClearFiles}
                  disabled={isCreating || isLoadingFiles}
                >
                  {t('clear')}
                </ClearButton>
              )}
            </Box>
            {isLoadingFiles ? (
              <Box display="flex" justifyContent="center" alignItems="center" mt={2}>
                <CircularProgress />
                <Typography variant="body2" ml={2}>{t('loadingFiles')}</Typography>
              </Box>
            ) : (
              <FileList>
                {selectedFiles.map((file, index) => (
                  <FileListItem key={index}>
                    <FileIcon />
                    <FileName primary={truncateFileName(file)} />
                    <StyledIconButton edge="end" aria-label="delete" onClick={() => handleRemoveFile(index)}>
                      <DeleteIcon />
                    </StyledIconButton>
                  </FileListItem>
                ))}
              </FileList>
            )}
            {isCreating && (
              <Box marginTop={2}>
                <LinearProgress />
                <Typography variant="body2">{progressMessage}</Typography>
              </Box>
            )}
          </RightColumn>
        </StyledDialogContent>
        <DialogActions>
          <Button onClick={onClose} color="primary" disabled={isCreating || isLoadingFiles}>
            {t('cancel')}
          </Button>
          <Button onClick={dbName ? handleAddDocuments : handleCreateDatabase} color="primary" disabled={isCreating || (!dbName && (!newDatabaseName || nameError)) || selectedFiles.length === 0}>
            {dbName ? t('add') : t('create')}
          </Button>
        </DialogActions>
      </StyledDialog>
      <CreateDBLogDialog
        open={logDialogOpen}
        onClose={handleCloseLogDialog}
        log={operationLog.log}
        success={operationLog.success}
        message={operationLog.message}
      />
    </>
  );
};

export default CreateDBDialog;
