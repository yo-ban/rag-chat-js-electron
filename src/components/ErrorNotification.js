import React from 'react';
import { useTranslation } from 'react-i18next';  
import { Alert, AlertTitle, Button } from '@mui/material';

function ErrorNotification({ error, onRetry }) {
  const { t } = useTranslation();

  return (
    error && (
      <Alert severity="error" action={
        <Button color="inherit" size="small" onClick={onRetry}>
          {t('retry')}
        </Button>
      }>
        <AlertTitle>{t('error')}</AlertTitle>
        {error}
      </Alert>
    )
  );
}

export default ErrorNotification;
