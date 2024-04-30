import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SERVER_URI } from '../../../constants';
import { useGithubAuth } from '../../toolbar/hooks/useGithubAuth';
import axios from 'axios';
import HTTP, {
  CreateTokenResponse,
  DeleteTokenResponse,
  RawToken,
  TokensResponse,
} from '../../../utils/http';

export interface Token {
  id: string;
  name: string;
  token?: string;
  createdAt: Date;
}

function rawTokenToToken(rawToken: RawToken): Token {
  return {
    id: rawToken.id,
    name: rawToken.name,
    token: rawToken.token,
    createdAt: new Date(rawToken.createdAt),
  };
}

export function useApiTokens(): {
  newToken: Token | null;
  tokens: Token[];
  createToken: (name: string) => Promise<CreateTokenResponse>;
  revokeToken: (id: string) => Promise<void>;
} {
  const [githubUser] = useGithubAuth();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [newToken, setNewToken] = useState<Token | null>(null);

  const createToken = useCallback(
    async (name: string) => {
      const { data } = await HTTP.post(`/new_token`, { name });
      if (data.token) {
        setNewToken(rawTokenToToken(data.token));
      }
      return data;
    },
    [setNewToken]
  );

  const revokeToken = useCallback(
    async (id: string) => {
      HTTP.delete(`/token/${id}`).then(() => {
        setTokens([...tokens.filter((token) => token.id !== id)]);
        if (newToken?.id === id) {
          setNewToken(null);
        }
      });
    },
    [setTokens, tokens, newToken, setNewToken]
  );

  useEffect(() => {
    if (!githubUser) {
      return;
    }

    HTTP.get(`/tokens`).then(({data}) => {
      setTokens([
        ...data.tokens
          .filter((token) => token.id !== newToken?.id)
          .map(rawTokenToToken),
      ]);
    });
  }, [setTokens, githubUser, newToken]);

  return { newToken, tokens, createToken, revokeToken };
}
