import React from 'react';
import { Button, Card, CardHeader, IconButton } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Token } from '../hooks/useApiTokens';
import CopyableToken from './CopyableToken';

export interface TokenCardProps {
  token: Token;
  handleRevoke: () => Promise<void>;
}

function TokenCard({ token, handleRevoke }: TokenCardProps) {
  return (
    <div
      key={token.id}
      style={{
        padding: '20px',
        borderBottom: '1px solid lightgrey',
        display: 'flex',
        flexDirection: 'column',
      }}>
      <div style={{ position: 'relative' }}>
        <h3 style={{ float: 'left' }}> {token.name}</h3>

        <Button
          size='small'
          variant='contained'
          color='warning'
          style={{ float: 'right' }}
          aria-label='delete'
          onClick={handleRevoke}>
          {'Revoke'}
        </Button>
      </div>
      <div style={{ fontSize: '12px', alignSelf: 'start' }}>
        {`Created ${token.createdAt.toLocaleString()}`}
      </div>
      {token.token && (
        <>
          <div style={{ margin: '1rem' }}>
            {
              'Make sure to copy your API token now. You won’t be able to see it again!'
            }
          </div>

          <CopyableToken token={token.token} />
        </>
      )}
    </div>
  );
}

export default TokenCard;
