import type {NextFunction, Request, Response} from 'express'
import Debug from "debug";
import {consentCookieName, defaultCookieOptions} from "./settings.js";
import {
    extendCookieConsentExpiry,
    loadCookieConsent, saveCookieConsent,
    saveGPCOptOut,
    shouldExtendCookieConsent, updateUserId
} from "./db-handlers.js";
import type {CookieConsentBody, ValidatedUser} from "chums-types";
import {getUserId, isAPIAuth} from "./token-handler.js";
import type {HasUUID, SaveCookieConsentProps} from "./types.js";

const debug = Debug('chums:cookie-consent:express-handlers');

const hasGPCSignal = (req: Request): boolean => {
    return req.headers['sec-gpc'] === '1';
}


/**
 * cookieConsentHelper handles the following:
 *  - checks for Sec-GPC header and opts the user out of analytics and marketing if it is present
 *  - sets a "cookie_consent" cookie if Sec-GPC is present
 *  - renews a "cookie_consent" cookie if needed (with a new expiration date)
 */
export async function cookieConsentHelper(req: Request, res: Response<unknown, HasUUID & ValidatedUser>, next: NextFunction): Promise<void> {
    try {
        if (isAPIAuth(req)) {
            next();
            return;
        }
        const uuid = req.signedCookies[consentCookieName] ?? req.cookies[consentCookieName] ?? null;
        if (!uuid) {
            if (!hasGPCSignal(req)) {
                next();
                return;
            }
            const record = await saveGPCOptOut({
                ipAddress: req.ip ?? 'not supplied',
                userId: res.locals.auth?.profile?.user?.id ?? null,
                url: req.get('referrer') ?? req.originalUrl ?? 'not supplied',
            });
            if (record) {
                // set res.locals.uuid so that the next handler can use it to load the cookie consent record if needed
                res.locals.uuid = record.uuid;
                setConsentCookie(res, record.uuid);
            }
            next();
            return;
        }
        const record = await loadCookieConsent({uuid});
        if (record && hasGPCSignal(req) && !record.gpc) {
            await saveGPCOptOut({
                uuid: uuid,
                ipAddress: req.ip ?? 'not supplied',
                userId: record.userId ?? res.locals.auth?.profile?.user?.id ?? null,
                url: req.get('referrer') ?? req.originalUrl ?? 'not supplied',
            });
        }

        if (record && !record.userId) {
            const userId = await getUserId(req, res);
            if (userId) {
                await updateUserId(record.uuid, userId);
            }
        }

        if (record && shouldExtendCookieConsent(record)) {
            await extendCookieConsentExpiry(record.uuid);
            setConsentCookie(res, record.uuid);
            next();
            return;
        }
        next();
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("cookieConsentHelper()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in cookieConsentHelper'});
    }
}

/**
 * Sets the "cookie_consent" cookie with an age of 400 days (400 days is the max allowed by Google Chrome)
 */
export function setConsentCookie(res: Response, uuid: string):void {
    res.cookie(consentCookieName, uuid, defaultCookieOptions)
}

export const useCookieGPCHelper = () => cookieConsentHelper;

export const postCookieConsent = async (req: Request, res: Response<unknown, ValidatedUser>): Promise<void> => {
    try {
        const userId = await getUserId(req, res);
        const body = req.body as CookieConsentBody;
        const uuid = req.signedCookies[consentCookieName] ?? req.cookies[consentCookieName] ?? null;
        const props: SaveCookieConsentProps = {
            uuid: uuid,
            userId: userId,
            ack: true,
            gpc: hasGPCSignal(req),
            ipAddress: req.ip ?? 'not supplied',
            url: req.get('referrer') ?? req.originalUrl ?? 'not supplied',
            action: {
                ...body,
                method: 'POST'
            }
        }
        const result = await saveCookieConsent(props);
        if (!result) {
            res.json({error: 'Error saving cookie consent'});
            return;
        }
        setConsentCookie(res, result.uuid);
        res.json(result);
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("postCookieConsent()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in postCookieConsent'});
    }
}


export const getCookieConsent = async (req: Request, res: Response<unknown, ValidatedUser>): Promise<void> => {
    try {
        const userId = await getUserId(req, res);
        const consent = await loadCookieConsent({
            uuid: req.signedCookies[consentCookieName] as string ?? null,
            userId: userId
        });
        res.json(consent)
    } catch (err: unknown) {
        if (err instanceof Error) {
            debug("getCookieConsent()", err.message);
            res.json({error: err.message, name: err.name});
            return;
        }
        res.json({error: 'unknown error in getCookieConsent'});
    }
}
