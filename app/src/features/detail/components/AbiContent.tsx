import React, { useState } from "react";
import { useAbiContent } from "../hooks/useAbiContent";
import {
  CircularProgress,
  Alert,
  Box,
  IconButton,
  Tooltip,
  Snackbar,
} from "@mui/material";
import ReactJsonView from "@microlink/react-json-view";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";

interface AbiContentProps {
  abiUrl: string;
}

export const AbiContent: React.FC<AbiContentProps> = ({ abiUrl }) => {
  const { abiContent, loading, error } = useAbiContent(abiUrl);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(abiContent, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load ABI content: {error.message}
      </Alert>
    );
  }

  if (!abiContent) {
    return null;
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ position: "relative" }}>
        <Box
          sx={{
            position: "absolute",
            top: "8px",
            right: "8px",
            zIndex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            borderRadius: "4px",
          }}
        >
          <Tooltip title={copied ? "Copied!" : "Copy ABI to clipboard"}>
            <IconButton
              onClick={handleCopy}
              size="small"
              color={copied ? "success" : "default"}
              sx={{ p: "4px" }}
            >
              {copied ? <CheckIcon /> : <ContentCopyIcon />}
            </IconButton>
          </Tooltip>
        </Box>
        <div
          style={{
            resize: "vertical",
            overflow: "auto",
            minHeight: "400px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "4px",
          }}
        >
          <ReactJsonView
            src={abiContent}
            theme={"shapeshifter"}
            style={{
              width: "100%",
              height: "100%",
              textAlign: "left",
              padding: "16px",
            }}
            displayObjectSize={false}
            displayDataTypes={false}
            enableClipboard={false}
          />
        </div>
      </Box>
      <Snackbar
        open={copied}
        autoHideDuration={2000}
        message="ABI copied to clipboard"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
};
