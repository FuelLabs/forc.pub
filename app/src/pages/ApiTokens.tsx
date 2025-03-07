import React from "react";
import { useApiTokens } from "../features/tokens/hooks/useApiTokens";
import { Button, TextField } from "@mui/material";
import TokenCard from "../features/tokens/components/TokenCard";
import "./ApiTokens.css";

function ApiTokens() {
  const [tokenName, setTokenName] = React.useState("");
  const [showTokenForm, setShowTokenForm] = React.useState(false);
  const { newToken, tokens, createToken, revokeToken } = useApiTokens();

  if (showTokenForm) {
    return (
      <div className="api-tokens-container">
        <div className="api-tokens-content">
          <h1 className="page-title">{"New API Token"}</h1>
          <div className="form-container">
            <TextField
              label="Name"
              size="small"
              variant="filled"
              className="token-name-field"
              onChange={(event) => setTokenName(event.target.value)}
            />

            <Button
              variant="contained"
              size="large"
              className="generate-button"
              onClick={async () => {
                await createToken(tokenName);
                setTokenName("");
                setShowTokenForm(false);
              }}
            >
              {"Generate Token"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="api-tokens-container">
      <div className="api-tokens-content">
        <h1 className="page-title">{"API Tokens"}</h1>
        <div className="header-container">
          <h2 className="section-title">API Tokens</h2>

          <Button
            variant="contained"
            size="medium"
            className="new-token-button"
            onClick={() => setShowTokenForm(true)}
          >
            {"New Token"}
          </Button>
        </div>

        <div className="tokens-list-container">
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
            <div className="empty-state">
              {`You haven't generated any API tokens yet.`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ApiTokens;
