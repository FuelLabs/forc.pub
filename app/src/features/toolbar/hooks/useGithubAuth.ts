import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLocalSession } from '../../../utils/localStorage';
import { SERVER_URI } from '../../../constants';

interface AuthenticatedUser {
  fullName: string;
  email?: string;
  githubUrl: string;
  githubLogin: string;
  isAdmin: boolean;
  avatarUrl?: string;
}

interface LoginResponse {
  sessionId?: string;
  user?: AuthenticatedUser;
  error?: string;
}

interface SessionResponse {
  user?: AuthenticatedUser;
  error?: string;
}

export function useGithubAuth(): [AuthenticatedUser | null, () => void] {
  const [githubUser, setGithubUser] = useState<AuthenticatedUser | null>(null);
  const {
    githubCode,
    saveGithubCode,
    clearGithubCode,
    sessionId,
    saveSessionId,
    clearSessionId,
  } = useLocalSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const logout = useCallback(() => {
    setGithubUser(null);
    clearSessionId();
  }, [setGithubUser, clearSessionId]);

  // If this was a redirect from Github, we have a code to log in with.
  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam) {
      searchParams.delete('code');
      setSearchParams(searchParams);
      saveGithubCode(codeParam);
      window.close();
    }
  }, [searchParams, saveGithubCode, setSearchParams]);

  useEffect(() => {
    if (!githubCode) {
      return;
    }
    const params = {
      code: githubCode,
    };
    const request = new Request(`${SERVER_URI}/login`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    fetch(request)
      .then((response) => {
        if (response.status < 400) {
          clearGithubCode();
          return response.json();
        } else {
          console.log('Error: ', response.status);
        }
      })
      .then((response: LoginResponse) => {
        response.sessionId
          ? saveSessionId(response.sessionId)
          : clearSessionId();
        response.user && setGithubUser(response.user);
        if (response.error) {
          console.log('login error: ', response.error);
        }
      })
      .catch((error) => {
        console.log('Unexpected error: ', error);
      });
  }, [
    githubCode,
    setGithubUser,
    clearGithubCode,
    clearSessionId,
    saveSessionId,
  ]);

  // If there's a session id, attempt to fetch the user info from the session.
  useEffect(() => {
    if (!!githubUser || !sessionId) {
      return;
    }

    const request = new Request(`${SERVER_URI}/session?id=${sessionId}`, {
      method: 'GET',
    });
    fetch(request)
      .then((response) => {
        if (response.status < 400) {
          return response.json();
        } else {
          console.log('Error: ', response.status);
        }
      })
      .then((response: SessionResponse) => {
        response.user && setGithubUser(response.user);
        if (response.error) {
          console.log('session error: ', response.error);
        }
      })
      .catch((error) => {
        console.log('Unexpected error: ', error);
      });
  }, [githubUser, sessionId, setGithubUser]);

  return [githubUser, logout];
}
