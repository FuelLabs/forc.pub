import React from "react";
import { Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";
import "./TokensTable.css";

export interface Token {
  id: string;
  name: string;
  createdAt: string;
}

interface TokensTableProps {
  tokens: Token[];
  revokeToken: (id: string) => Promise<void>;
}

const TokensTable: React.FC<TokensTableProps> = ({ tokens, revokeToken }) => (
  <TableContainer component={Paper} className="tokens-table-container">
    <Table className="tokens-table">
      <TableHead>
        <TableRow className="tokens-table-header-row">
          <TableCell className="tokens-table-header tokens-table-header-name">Name</TableCell>
          <TableCell className="tokens-table-header tokens-table-header-date">Created At</TableCell>
          <TableCell className="tokens-table-header tokens-table-header-actions"></TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {tokens.map((token, idx) => (
          <TableRow
            key={token.id}
            className="tokens-table-row"
            style={{ borderBottom: idx === tokens.length - 1 ? "none" : undefined }}
          >
            <TableCell className="tokens-table-cell tokens-table-name">{token.name}</TableCell>
            <TableCell className="tokens-table-cell tokens-table-date">{new Date(token.createdAt).toLocaleString()}</TableCell>
            <TableCell className="tokens-table-cell tokens-table-actions">
              <Button
                variant="contained"
                color="error"
                size="small"
                className="tokens-table-revoke-btn"
                onClick={async () => revokeToken(token.id)}
              >
                Revoke
              </Button>
            </TableCell>
          </TableRow>
        ))}
        {!tokens.length && (
          <TableRow>
            <TableCell colSpan={3} align="center" className="tokens-table-empty">
              {`You haven't generated any API tokens yet.`}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  </TableContainer>
);

export default TokensTable; 