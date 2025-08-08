import React, { useEffect, useState } from "react";
import { createHighlighter, type Highlighter } from "shiki";
import swayGrammar from "../../../syntaxes/sway.tmlanguage.json";

let highlighterPromise: Promise<Highlighter> | null = null;

async function getSingletonHighlighter(theme: string) {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [theme],
      langs: ["js"],
    }).then(async (highlighter) => {
      try {
        // Load the Sway grammar - cast to unknown first to bypass type checking
        await highlighter.loadLanguage(swayGrammar as unknown as Parameters<typeof highlighter.loadLanguage>[0]);
      } catch (error) {
        console.error("Error loading Sway grammar:", error);
      }
      return highlighter;
    });
  }
  return highlighterPromise;
}

const CodeBlock: React.FC<{
  className?: string;
  children: React.ReactNode;
}> = ({ children }) => {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const code = String(children).trim();
  const language = "Sway";
  const theme = "nord";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSingletonHighlighter(theme)
      .then((highlighter) => {
        if (!cancelled) {
          try {
            setHtml(
              highlighter.codeToHtml(code, {
                lang: language,
                theme,
              })
            );
          } catch (langError) {
            console.warn(`Language ${language} not found, falling back to text`);
            setHtml(
              highlighter.codeToHtml(code, {
                lang: "text",
                theme,
              })
            );
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Shiki highlight error:", err);
        if (!cancelled) {
          setHtml(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (loading) {
    return (
      <pre style={{ borderRadius: 8, fontSize: 16, margin: "1em 0", background: "#181a20", color: "#e0e0e0" }}>
        Loading...
      </pre>
    );
  }
  if (html) {
    // Render Shiki's HTML output as-is (includes .shiki class)
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return (
    <pre style={{ borderRadius: 8, fontSize: 16, margin: "1em 0", background: "#181a20", color: "#e0e0e0" }}>
      {code}
    </pre>
  );
};

export default CodeBlock;
