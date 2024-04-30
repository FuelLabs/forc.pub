import React, { useEffect } from 'react';
import { Token, useApiTokens } from '../features/tokens/hooks/useApiTokens';
import { useIsMobile } from '../features/toolbar/hooks/useIsMobile';
import { Button, TextField } from '@mui/material';
import TokenCard from '../features/tokens/components/TokenCard';

function ApiTokens() {
  const [tokenName, setTokenName] = React.useState('');
  const [showTokenForm, setShowTokenForm] = React.useState(false);
  const { newToken, tokens, createToken, revokeToken } = useApiTokens();
  const isMobile = useIsMobile();

  if (showTokenForm) {
    return (
      <div
        style={{
          margin: isMobile ? '15px' : '0 25% 2rem',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
        }}>
        <h1>{'New API Token'}</h1>
        <div style={{ position: 'relative' }}>
          <TextField
            label='Name'
            size='small'
            variant='filled'
            style={{ minWidth: '50%', background: 'white' }}
            onChange={(event) => setTokenName(event.target.value)}
          />

          <Button
            variant='contained'
            size='large'
            style={{ float: 'right' }}
            onClick={async () => {
              let { token } = await createToken(tokenName);
              setTokenName('');
              setShowTokenForm(false);
            }}>
            {'Generate Token'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        margin: isMobile ? '15px' : '0 25% 2rem',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}>
      <h1>{'API Tokens'}</h1>
      <div style={{ position: 'relative' }}>
        <h2 style={{ float: 'left' }}>API Tokens</h2>

        <Button
          variant='contained'
          size='medium'
          style={{ marginTop: '15px', float: 'right' }}
          onClick={() => setShowTokenForm(true)}>
          {'New Token'}
        </Button>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'white',
          borderRadius: '4px',
          boxShadow: '4px',
        }}>
        {newToken && (
          <TokenCard
            key={newToken.id}
            token={newToken}
            handleRevoke={async () => {
              await revokeToken(newToken.id);
            }}
          />
        )}
        {tokens.map((token) => (
          <TokenCard
            key={token.id}
            token={token}
            handleRevoke={async () => revokeToken(token.id)}
          />
        ))}
        {!tokens.length && !newToken && (
          <div
            style={{
              padding: '20px',
              borderBottom: '1px solid lightgrey',
              display: 'flex',
              flexDirection: 'column',
            }}>
            {`You haven't generated any API tokens yet.`}
          </div>
        )}
      </div>
    </div>
  );
}

export default ApiTokens;
