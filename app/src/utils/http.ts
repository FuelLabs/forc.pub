import type { TypedAxios } from 'typed-axios-instance';
import axios from 'axios';
import { SERVER_URI } from '../constants';
import { RecentPackagesResponse } from '../features/dahboard/hooks/useFetchRecentPackages';

export interface AuthenticatedUser {
  fullName: string;
  email?: string;
  githubUrl: string;
  githubLogin: string;
  isAdmin: boolean;
  avatarUrl?: string;
}

export interface LoginRequest {
    code: string;
  }

export interface LoginResponse {
  sessionId: string;
  user: AuthenticatedUser;
}

export interface UserResponse {
  user: AuthenticatedUser;
}

  export interface RawToken {
    id: string,
    name: string,
    token?: string,
    createdAt: Date,
  }
  
  export interface CreateTokenRequest {
    name: string;
  }
  export interface CreateTokenResponse {
    token?: RawToken;
    error?: string;
  }

  export interface TokensResponse {
    tokens: RawToken[];
    error?: string;
  }

type Routes = [
  {
    route: '/user';
    method: 'GET';
    jsonResponse: UserResponse;
  },
  {
    route: '/login';
    method: 'POST';
    jsonBody: LoginRequest;
    jsonResponse: LoginResponse;
  },
  {
    route: '/logout';
    method: 'POST';
  },
  {
    route: '/new_token';
    method: 'POST';
    jsonBody: CreateTokenRequest;
    jsonResponse: CreateTokenResponse;
  },
  {
    route: '/tokens';
    method: 'GET';
    jsonResponse: TokensResponse;
  },
  {
    route: '/token/[id]';
    method: 'DELETE';
  },
  {
    route: "/recent_packages",
    method: "GET",
    jsonResponse: RecentPackagesResponse;
  }
];

const HTTP: TypedAxios<Routes> = axios.create({
  withCredentials: true,
  baseURL: SERVER_URI,
});

// Intercept the response and log any errors.
HTTP.interceptors.response.use(function (response) {
    // Any status code that lie within the range of 2xx cause this function to trigger
    return response;
  }, function (error) {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    console.error('HTTP Error:', error);
    return Promise.reject(error);
  });
export default HTTP;
