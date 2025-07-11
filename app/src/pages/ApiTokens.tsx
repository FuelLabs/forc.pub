import React from "react";
import { useApiTokens } from "../features/tokens/hooks/useApiTokens";
import { Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import "./ApiTokens.css";
import TokenCard from "../features/tokens/components/TokenCard";
import TokensTable from "../features/tokens/components/TokensTable";

function ApiTokens() {
  const [tokenName, setTokenName] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [showNewToken, setShowNewToken] = React.useState(true);
  const [copied, setCopied] = React.useState(false);
  const { newToken, tokens, createToken, revokeToken } = useApiTokens();

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setTokenName("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tokenName.trim() !== "") {
      await createToken(tokenName);
      setTokenName("");
      setOpen(false);
      setShowNewToken(true);
    }
  };
  const handleCopy = (tokenValue: string) => {
    navigator.clipboard.writeText(tokenValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="api-tokens-container">
      <div className="api-tokens-content">
        <h1 className="page-title">API Tokens</h1>
        <p className="page-description">
          Manage your API tokens for publishing libraries. Keep your tokens
          secure!
        </p>
        <div className="tokens-header-row">
          <div className="section-title">Your Tokens</div>
          <Button
            variant="contained"
            size="large"
            className="create-token-btn"
            onClick={handleOpen}
          >
            + Create
          </Button>
        </div>
        {/* New token section (not in table) */}
        {newToken && showNewToken && (
          <TokenCard
            token={newToken}
            copied={copied}
            onCopy={() => handleCopy(newToken.token!)}
            revokeToken={revokeToken}
          />
        )}
        {/* Table for existing tokens only */}
        {tokens.length > 0 ? (
          <TokensTable
            tokens={tokens.map((t) => ({
              ...t,
              createdAt: t.createdAt.toString(),
            }))}
            revokeToken={revokeToken}
          />
        ) : null}
        {tokens.length === 0 && (!newToken || !showNewToken) && (
          <div
            className="empty-state"
            style={{
              color: "#b0b0b0",
              padding: 32,
              background: "#2a2a2a",
              borderRadius: 18,
              marginTop: 16,
              textAlign: "center",
            }}
          >
            {`You haven't generated any API tokens yet.`}
          </div>
        )}
        <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth
          PaperProps={{
            style: { background: '#2a2a2a' }
          }}
        >
          <DialogTitle>Create New Token</DialogTitle>
          <form onSubmit={handleCreate} autoComplete="off">
            <DialogContent>
              <TextField
                label="Name"
                size="small"
                variant="filled"
                className="token-name-field"
                value={tokenName}
                onChange={(event) => setTokenName(event.target.value)}
                autoFocus
                fullWidth
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose} color="inherit">
                Cancel
              </Button>
              <Button
                disabled={tokenName.trim() === ""}
                variant="contained"
                type="submit"
                className="generate-button"
              >
                Generate Token
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </div>
    </div>
  );
}

export default ApiTokens;
