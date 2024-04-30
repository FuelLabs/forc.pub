import type { TypedAxios } from 'typed-axios-instance';
import axios from 'axios';
import { SERVER_URI } from '../constants';

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
  sessionId?: string;
  user?: AuthenticatedUser;
  error?: string;
}

export interface UserResponse {
  user?: AuthenticatedUser;
  error?: string;
}

export interface GenericResponse {
    error?: string;
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

  export interface DeleteTokenResponse {
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
    jsonResponse: GenericResponse;
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
    jsonResponse: DeleteTokenResponse;
  }
];

const HTTP: TypedAxios<Routes> = axios.create({
  withCredentials: true,
  baseURL: SERVER_URI,
});

// Intercept the response and log any errors.
HTTP.interceptors.response.use(function (response) {
    // Any status code that lie within the range of 2xx cause this function to trigger
    if (response.data.error) {
      console.log(`[${response.config.method}] API error: `, response.data.error);
    }
    return response;
  }, function (error) {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    return Promise.reject(error);
  });
export default HTTP;
