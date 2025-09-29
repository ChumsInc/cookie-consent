import type {NextFunction, Request, Response} from 'express'
import Debug from "debug";
import {consentCookieName, defaultCookieOptions} from "./settings.js";
import {
    extendCookieConsentExpiry,
    loadCookieConsent, saveCookieConsent,
    saveGPCOptOut,
    shouldExtendCookieConsent
} from "./db-handlers.js";
import type {CookieConsentBody, ValidatedUser} from "chums-types";
import {getTokenUser} from "./token-handler.js";
import type {SaveCookieConsentProps} from "./types.js";

const debug = Debug('chums:src:cookie-consent:express-handlers');

/**
 * cookieConsentHelper handles the following:
 *  - checks for Sec-GPC header and opts the user out of analytics and marketing if it is present
 *  - sets a "cookie_consent" cookie if Sec-GPC is present
 *  - renews a "cookie_consent" cookie if needed (with a new expiration date)
 */
export async function cookieConsentHelper(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const uuid = req.signedCookies[consentCookieName] ?? null;
        const gpcSignal = req.headers['sec-gpc'] ?? null;
        if (!uuid && gpcSignal === '1') {
            const record = await saveGPCOptOut({
                ipAddress: req.ip ?? 'not supplied',
                url: req.get('referrer') ?? req.originalUrl ?? 'not supplied',
            });
            if (record) {
                setConsentCookie(res, record.uuid);
            }
        } else if (uuid) {
            const record = await loadCookieConsent({uuid});
            if (record && shouldExtendCookieConsent(record)) {
                await extendCookieConsentExpiry(record.uuid);
                setConsentCookie(res, record.uuid);
            }
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
 * @param res
 * @param uuid
 */
export function setConsentCookie(res: Response, uuid: string) {
    res.cookie(consentCookieName, uuid, defaultCookieOptions)
}

export const useCookieGPCHelper = () => cookieConsentHelper;

export const postCookieConsent = async (req: Request, res: Response<unknown, ValidatedUser>): Promise<void> => {
    try {
        const user = await getTokenUser(req);
        const body = req.body as CookieConsentBody;
        const uuid = req.signedCookies[consentCookieName] ?? null;
        const props: SaveCookieConsentProps = {
            uuid: uuid,
            userId: user?.id ?? null,
            ack: true,
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
        const user = await getTokenUser(req);
        const consent = await loadCookieConsent({
            uuid: req.cookies.consent_uuid as string ?? null,
            userId: user?.id ?? null
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
