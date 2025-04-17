import React from "react";
import { useAbiContent } from "../hooks/useAbiContent";
import { CircularProgress, Alert, Box } from "@mui/material";
import ReactJsonView from "@microlink/react-json-view";

interface AbiContentProps {
  abiUrl: string;
}

export const AbiContent: React.FC<AbiContentProps> = ({ abiUrl }) => {
  const { abiContent, loading, error } = useAbiContent(abiUrl);

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
          theme={"chalk"}
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
  );
};
