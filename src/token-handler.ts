import type {Request, Response} from "express";
import type {UserJWTToken, ValidatedUser} from "chums-types";
import type {JwtPayload} from 'jsonwebtoken'
import jwt from 'jsonwebtoken';
import Debug from "debug";
import type {GoogleJWTToken} from "./types.js";
import {loadUserIdFromEmail} from "./db-handlers.js";
import {verbose} from "./settings.js";

const debug = Debug('chums:cookie-consent:token-handler');
const JWT_SECRET = process.env.JWT_SECRET ?? 'NOT THE SECRET';
const JWT_ISSUER = process.env.JWT_ISSUER ?? 'NOT THE ISSUER';
const ERR_TOKEN_EXPIRED = 'TokenExpiredError';

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

export function isAPIAuth(req: Request):boolean {
    const authorization = req.get('authorization');

    if (!authorization) {
        return false;
    }

    const [basic = ''] = authorization.split(' ');
    return basic.trim().toLowerCase() === 'basic';
}

export async function getUserId(req: Request, res: Response<unknown, ValidatedUser>): Promise<number | null> {

    if (res.locals.auth?.profile?.user) {
        if (verbose) debug("getUserId() - using res.locals.auth.profile.user.id", res.locals.auth.profile.user.id);
        return res.locals.auth.profile.user.id;
    }

    const token = jwtToken(req);
    if (token) {
        if (verbose) debug("getUserId() - using token", token.slice(0, 10), '...');
        const decoded = await validateToken<UserJWTToken | GoogleJWTToken>(token);
        if (isLocalToken(decoded) && isBeforeExpiry(decoded)) {
            if (verbose) debug("getUserId() - using decoded.user.id", decoded.user.id);
            return decoded.user.id;
        }
        if (isGoogleToken(decoded) && isBeforeExpiry(decoded)) {
            const id = await loadUserIdFromEmail(decoded.email);
            if (verbose) debug('getUserId() - using google id', id ?? 'not found');
            return id ?? null;
        }
    }
    return null;
}


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
    if (verbose) debug("isLocalToken()", typeof payload);
    if (typeof payload === 'string') {
        payload = jwt.decode(payload);
    }
    if (!payload || typeof payload === 'string') {
        return false;
    }
    if (verbose) debug("isLocalToken()", payload?.iss, JWT_ISSUER);
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
