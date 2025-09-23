import { consentCookieName, extendCookieConsentExpiry, loadCookieConsent, saveCookieConsent, saveOptOutUser, setConsentCookie, shouldExtendCookieConsent } from "./cookie-consent.js";
import Debug from "debug";
import { getTokenUser } from "./token-handler.js";
const debug = Debug('chums:src:index');
export { consentCookieName } from './cookie-consent.js';
/**
 * cookieConsentHelper handles the following:
 *  - checks for Sec-GPC header and opts the user out of analytics and marketing if it is present
 *  - sets a "cookie_consent" cookie if Sec-GPC is present
 *  - renews a "cookie_consent" cookie if needed (with a new expiration date)
 */
export async function cookieConsentHelper(req, res, next) {
    try {
        const uuid = req.signedCookies[consentCookieName] ?? null;
        const gpcSignal = req.headers['sec-gpc'] ?? null;
        if (!uuid && gpcSignal === '1') {
            const record = await saveOptOutUser({
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
export const postCookieConsent = async (req, res) => {
    try {
        const user = await getTokenUser(req);
        const body = req.body;
        const uuid = req.signedCookies[consentCookieName] ?? null;
        const props = {
            uuid: uuid,
            userId: user?.id ?? null,
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
            uuid: req.cookies.consent_uuid ?? null,
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
