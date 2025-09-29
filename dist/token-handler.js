import jwt from 'jsonwebtoken';
import Debug from "debug";
import { loadUserIdFromEmail } from "./db-handlers.js";
const debug = Debug('chums:cookie-consent:token-handler');
export const jwtToken = (req) => {
    const authorization = req.header('authorization');
    if (!authorization) {
        return null;
    }
    const [bearer = '', token = null] = authorization.split(' ');
    if (bearer.trim().toLowerCase() !== 'bearer') {
        return null;
    }
    return token;
};
export async function getTokenUser(req) {
    const token = jwtToken(req);
    if (token) {
        const decoded = await validateToken(token);
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
            };
        }
    }
    return null;
}
const { JWT_ISSUER = 'NOT THE ISSUER', JWT_SECRET = 'NOT THE SECRET' } = process.env;
const ERR_TOKEN_EXPIRED = 'TokenExpiredError';
/**
 * Validates a JTW Token
 */
export async function validateToken(token) {
    try {
        const payload = jwt.decode(token);
        if (!isLocalToken(payload)) {
            if (isBeforeExpiry(token)) {
                return payload;
            }
            return Promise.reject(new Error('Invalid Token: token may be invalid or expired'));
        }
        return jwt.verify(token, JWT_SECRET);
    }
    catch (err) {
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
export const isBeforeExpiry = (payload) => {
    if (typeof payload === 'string') {
        payload = jwt.decode(payload);
    }
    if (!payload || typeof payload === 'string') {
        return false;
    }
    const { exp } = payload;
    const now = new Date().valueOf() / 1000;
    return !!exp && exp > now;
};
/**
 * Checks to see if a token is locally issued
 */
export const isLocalToken = (payload) => {
    if (typeof payload === 'string') {
        payload = jwt.decode(payload);
    }
    if (!payload || typeof payload === 'string') {
        return false;
    }
    const { iss } = payload;
    return !!iss && iss === JWT_ISSUER;
};
export const isGoogleToken = (payload) => {
    if (typeof payload === 'string') {
        payload = jwt.decode(payload);
    }
    if (!payload || typeof payload === 'string') {
        return false;
    }
    const { iss } = payload;
    return !!iss && iss === 'https://accounts.google.com';
};
