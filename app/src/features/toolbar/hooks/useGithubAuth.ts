import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLocalSession } from '../../../utils/localStorage';
import { SERVER_URI } from '../../../constants';
import axios from 'axios';
import HTTP, {
  AuthenticatedUser,
  LoginResponse,
  UserResponse,
} from '../../../utils/http';

export function useGithubAuth(): [
  AuthenticatedUser | null,
  () => Promise<void>
] {
  const [githubUser, setGithubUser] = useState<AuthenticatedUser | null>(null);
  const { githubCode, saveGithubCode, clearGithubCode } = useLocalSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const logout = useCallback(async () => {
    setGithubUser(null);
    HTTP.post(`/logout`);
  }, [setGithubUser]);

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

    HTTP.post(`/login`, { code: githubCode }).then(({ data }) => {
      clearGithubCode();
      if (data.user) {
        setGithubUser(data.user);
      }
    });
  }, [githubCode, setGithubUser, clearGithubCode]);

  // Attempt to fetch the logged in user info.
  useEffect(() => {
    if (!!githubUser) {
      return;
    }

    HTTP.get(`/user`).then(({ data }) => {
      if (data.user) {
        setGithubUser(data.user);
      }
    });
  }, [githubUser, setGithubUser]);

  return [githubUser, logout];
}
