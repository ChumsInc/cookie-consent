import Debug from "debug";
import { consentCookieName, defaultCookieOptions } from "./settings.js";
import { extendCookieConsentExpiry, loadCookieConsent, saveCookieConsent, saveGPCOptOut, shouldExtendCookieConsent } from "./db-handlers.js";
import { getTokenUser } from "./token-handler.js";
const debug = Debug('chums:cookie-consent:express-handlers');
const hasGPCSignal = (req) => {
    const gpcSignal = req.headers['sec-gpc'] ?? null;
    return gpcSignal === '1';
};
/**
 * cookieConsentHelper handles the following:
 *  - checks for Sec-GPC header and opts the user out of analytics and marketing if it is present
 *  - sets a "cookie_consent" cookie if Sec-GPC is present
 *  - renews a "cookie_consent" cookie if needed (with a new expiration date)
 */
export async function cookieConsentHelper(req, res, next) {
    try {
        const uuid = req.signedCookies[consentCookieName] ?? req.cookies[consentCookieName] ?? null;
        if (!uuid && hasGPCSignal(req)) {
            const record = await saveGPCOptOut({
                ipAddress: req.ip ?? 'not supplied',
                url: req.get('referrer') ?? req.originalUrl ?? 'not supplied',
            });
            if (record) {
                setConsentCookie(res, record.uuid);
            }
        }
        else if (uuid) {
            const record = await loadCookieConsent({ uuid });
            if (record && shouldExtendCookieConsent(record)) {
                await extendCookieConsentExpiry(record.uuid);
                setConsentCookie(res, record.uuid);
            }
        }
        next();
    }
    catch (err) {
        if (err instanceof Error) {
            debug("cookieConsentHelper()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in cookieConsentHelper' });
    }
}
/**
 * Sets the "cookie_consent" cookie with an age of 400 days (400 days is the max allowed by Google Chrome)
 * @param res
 * @param uuid
 */
export function setConsentCookie(res, uuid) {
    res.cookie(consentCookieName, uuid, defaultCookieOptions);
}
export const useCookieGPCHelper = () => cookieConsentHelper;
export const postCookieConsent = async (req, res) => {
    try {
        const user = await getTokenUser(req);
        const body = req.body;
        const uuid = req.signedCookies[consentCookieName] ?? req.cookies[consentCookieName] ?? null;
        const props = {
            uuid: uuid,
            userId: user?.id ?? null,
            ack: true,
            gpc: hasGPCSignal(req),
            ipAddress: req.ip ?? 'not supplied',
            url: req.get('referrer') ?? req.originalUrl ?? 'not supplied',
            action: {
                ...body,
                method: 'POST'
            }
        };
        const result = await saveCookieConsent(props);
        if (!result) {
            res.json({ error: 'Error saving cookie consent' });
            return;
        }
        setConsentCookie(res, result.uuid);
        res.json(result);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("postCookieConsent()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in postCookieConsent' });
    }
};
export const getCookieConsent = async (req, res) => {
    try {
        const user = await getTokenUser(req);
        const consent = await loadCookieConsent({
            uuid: req.signedCookies[consentCookieName] ?? null,
            userId: user?.id ?? null
        });
        res.json(consent);
    }
    catch (err) {
        if (err instanceof Error) {
            debug("getCookieConsent()", err.message);
            res.json({ error: err.message, name: err.name });
            return;
        }
        res.json({ error: 'unknown error in getCookieConsent' });
    }
};
