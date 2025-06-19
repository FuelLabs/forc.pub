import React from "react";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import "./TokenCard.css";

export interface TokenCardProps {
  token: {
    name: string;
    createdAt: Date | string;
    token?: string;
    id: string;
  };
  copied?: boolean;
  onCopy?: () => void;
  revokeToken: (id: string) => Promise<void>;
}

const TokenCard: React.FC<TokenCardProps> = ({ token, copied, onCopy, revokeToken }) => {
  return (
    <div className="token-card new-token-card">
      <div className="token-card-header">
        <span className="token-card-name">{token.name}</span>
        <span className="token-card-date">{new Date(token.createdAt).toLocaleString()}</span>
      </div>
      <div className="token-card-warning">
        <WarningAmberIcon className="token-card-warning-icon" />
        <span style={{ textAlign: "left", fontSize: "16px" }}>Make sure to copy your API token now. You won&apos;t be able to see it again!</span>
      </div>
      <div className="token-card-value-row">
        <span className="token-card-value">{token.token}</span>
        <Tooltip title={copied ? "Copied!" : "Copy"}>
          <IconButton
            size="small"
            onClick={onCopy}
            className="token-card-copy-btn"
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </div>
      <div className="token-card-revoke-bottom-row">
        <button className="token-card-revoke-btn" onClick={() => revokeToken(token.id)}>Revoke</button>
      </div>
    </div>
  );
};

export default TokenCard;
