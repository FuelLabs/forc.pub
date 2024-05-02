import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLocalSession } from '../../../utils/localStorage';
import useCookie from 'react-use-cookie';
import HTTP, { AuthenticatedUser } from '../../../utils/http';

export function useGithubAuth(): [
  AuthenticatedUser | null,
  () => Promise<void>
] {
  const [sessionId, setSessionId] = useCookie('session');
  const [githubUser, setGithubUser] = useState<AuthenticatedUser | null>(null);
  const { githubCode, saveGithubCode, clearGithubCode } = useLocalSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const logout = useCallback(async () => {
    await HTTP.post(`/logout`);
    setSessionId('');
    setGithubUser(null);
  }, [setGithubUser, setSessionId]);

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

    HTTP.post(`/login`, { code: githubCode })
      .then(({ data }) => {
        clearGithubCode();
        if (data.user) {
          setGithubUser(data.user);
        }
      })
      .catch(() => clearGithubCode());
  }, [githubCode, setGithubUser, clearGithubCode]);

  useEffect(() => {
    // Attempt to fetch the logged in user info if the session cookie is set and the user hasn't been fetched.
    if (!!githubUser || !sessionId) {
      return;
    }

    HTTP.get(`/user`).then(({ data }) => {
      setGithubUser(data.user);
    });
  }, [githubUser, setGithubUser, sessionId]);

  return [githubUser, logout];
}
