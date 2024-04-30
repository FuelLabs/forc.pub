import React from 'react';
import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

export interface CopyableProps {
  token: string;
}

async function handleCopy(value: string) {
  await navigator.clipboard.writeText(value);
}

function CopyableToken({ token }: CopyableProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        fontSize: '16px',
        background: '#383838',
        color: 'white',
        borderRadius: '4px',
        textAlign: 'left',
        position: 'relative',
      }}>
      <div
        style={{
          flex: '1 1 auto',
          overflow: 'auto',
          padding: '0 1rem',
        }}>
        <pre>{token}</pre>
      </div>
      <div style={{ flex: '0 0 auto', margin: '5px 5px 0 0' }}>
        <IconButton onClick={() => handleCopy(token)} aria-label='copy'>
          <ContentCopyIcon style={{ color: 'white' }} />
        </IconButton>
      </div>
    </div>
  );
}

export default CopyableToken;
