import type { Request, Response } from "express";
import type { UserJWTToken, ValidatedUser } from "chums-types";
import type { JwtPayload } from 'jsonwebtoken';
import type { GoogleJWTToken } from "./types.js";
export declare const jwtToken: (req: Request) => string | null;
export declare function getUserId(req: Request, res: Response<unknown, ValidatedUser>): Promise<number | null>;
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
