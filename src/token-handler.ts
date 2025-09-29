import type {Request} from "express";
import type {UserJWTToken} from "chums-types";
import type {JwtPayload} from 'jsonwebtoken'
import jwt from 'jsonwebtoken';
import Debug from "debug";
import type {GoogleJWTToken} from "./types.js";
import type {UserProfile} from "b2b-types";
import {loadUserIdFromEmail} from "./db-handlers.js";


const debug = Debug('chums:cookie-consent:token-handler');

export const jwtToken = (req: Request): string | null => {
    const authorization = req.header('authorization')
    if (!authorization) {
        return null;
    }

    const [bearer = '', token = null] = authorization.split(' ');
    if (bearer.trim().toLowerCase() !== 'bearer') {
        return null;
    }

    return token;
};

export async function getTokenUser(req: Request): Promise<Pick<UserProfile, 'id' | 'email'> | null> {
    const token = jwtToken(req);
    if (token) {
        const decoded = await validateToken<UserJWTToken | GoogleJWTToken>(token);
        if (isLocalToken(decoded) && isBeforeExpiry(decoded)) {
            return {
                id: decoded.user.id,
                email: decoded.user.email,
            };
        }
        if (isGoogleToken(decoded) && isBeforeExpiry(decoded)) {
            const id = await loadUserIdFromEmail(decoded.email);
            return {
                id: id ?? 0,
                email: decoded.email,
            }
        }
    }
    return null;
}


const {JWT_ISSUER = 'NOT THE ISSUER', JWT_SECRET = 'NOT THE SECRET'} = process.env;
const ERR_TOKEN_EXPIRED = 'TokenExpiredError';

/**
 * Validates a JTW Token
 */
export async function validateToken<T = JwtPayload>(token: string): Promise<T> {
    try {
        const payload = jwt.decode(token);
        if (!isLocalToken(payload)) {
            if (isBeforeExpiry(token)) {
                return payload as T;
            }
            return Promise.reject(new Error('Invalid Token: token may be invalid or expired'));
        }
        return jwt.verify(token, JWT_SECRET) as T;
    } catch (err: unknown) {
        if (!(err instanceof Error)) {
            return Promise.reject(err);
        }
        if (err.name !== ERR_TOKEN_EXPIRED) {
            debug("validateToken()", err.name, err.message);
        }
        return Promise.reject(err);
    }
}

/**
 * Validates a token expiration timestamp
 */
export const isBeforeExpiry = (payload: JwtPayload | null | string): boolean => {
    if (typeof payload === 'string') {
        payload = jwt.decode(payload);
    }
    if (!payload || typeof payload === 'string') {
        return false;
    }
    const {exp} = payload;
    const now = new Date().valueOf() / 1000;
    return !!exp && exp > now;
}

/**
 * Checks to see if a token is locally issued
 */
export const isLocalToken = (payload: UserJWTToken | JwtPayload | null | string): payload is UserJWTToken => {
    if (typeof payload === 'string') {
        payload = jwt.decode(payload);
    }
    if (!payload || typeof payload === 'string') {
        return false;
    }
    const {iss} = payload;
    return !!iss && iss === JWT_ISSUER;
};

export const isGoogleToken = (payload: GoogleJWTToken | JwtPayload | null | string): payload is GoogleJWTToken => {
    if (typeof payload === 'string') {
        payload = jwt.decode(payload);
    }
    if (!payload || typeof payload === 'string') {
        return false;
    }
    const {iss} = payload;
    return !!iss && iss === 'https://accounts.google.com';
}
