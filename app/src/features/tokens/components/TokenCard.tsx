import React from "react";
import { Button } from "@mui/material";
import { Token } from "../hooks/useApiTokens";
import CopyableToken from "./CopyableToken";
import "./TokenCard.css";

export interface TokenCardProps {
  token: Token;
  handleRevoke: () => Promise<void>;
}

function TokenCard({ token, handleRevoke }: TokenCardProps) {
  return (
    <div key={token.id} className="token-card">
      <div className="token-header">
        <h3 className="token-name">{token.name}</h3>

        <Button
          size="small"
          variant="contained"
          color="warning"
          className="revoke-button"
          aria-label="delete"
          onClick={handleRevoke}
        >
          {"Revoke"}
        </Button>
      </div>
      <div className="token-date">
        {`Created ${token.createdAt.toLocaleString()}`}
      </div>
      {token.token && (
        <>
          <div className="token-warning">
            {
              "Make sure to copy your API token now. You won't be able to see it again!"
            }
          </div>

          <CopyableToken token={token.token} />
        </>
      )}
    </div>
  );
}

export default TokenCard;
