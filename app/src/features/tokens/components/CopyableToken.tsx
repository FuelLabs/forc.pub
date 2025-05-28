import React from "react";
import IconButton from "@mui/material/IconButton";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import "./CopyableToken.css";

export interface CopyableProps {
  token: string;
}

async function handleCopy(value: string) {
  await navigator.clipboard.writeText(value);
}

function CopyableToken({ token }: CopyableProps) {
  return (
    <div className="copyable-token-container">
      <div className="token-text">
        <pre>{token}</pre>
      </div>
      <div className="copy-button-container">
        <IconButton
          onClick={() => handleCopy(token)}
          aria-label="copy"
          className="copy-button"
        >
          <ContentCopyIcon />
        </IconButton>
      </div>
    </div>
  );
}

export default CopyableToken;
