import type { Request } from "express";
import type { UserJWTToken } from "chums-types";
import type { JwtPayload } from 'jsonwebtoken';
import type { GoogleJWTToken } from "./types.js";
import type { UserProfile } from "b2b-types";
export declare const jwtToken: (req: Request) => string | null;
export declare function getTokenUser(req: Request): Promise<Pick<UserProfile, 'id' | 'email'> | null>;
/**
 * Validates a JTW Token
 */
export declare function validateToken<T = JwtPayload>(token: string): Promise<T>;
/**
 * Validates a token expiration timestamp
 */
export declare const isBeforeExpiry: (payload: JwtPayload | null | string) => boolean;
/**
 * Checks to see if a token is locally issued
 */
export declare const isLocalToken: (payload: UserJWTToken | JwtPayload | null | string) => payload is UserJWTToken;
export declare const isGoogleToken: (payload: GoogleJWTToken | JwtPayload | null | string) => payload is GoogleJWTToken;
