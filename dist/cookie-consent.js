import Debug from "debug";
import { mysql2Pool } from "./mysql.js";
import dayjs from 'dayjs';
import { randomUUID } from "node:crypto";
const debug = Debug('chums:src:cookie-consent');
/**
 * A globally accessible name for the cookie that stores the cookie consent uuid
 */
export const consentCookieName = 'cookie_consent';
/**
 * Sets the "cookie_consent" cookie with an age of 400 days (400 days is the max allowed by Google Chrome)
 * @param res
 * @param uuid
 */
export function setConsentCookie(res, uuid) {
    res.cookie(consentCookieName, uuid, {
        httpOnly: true,
        signed: true,
        maxAge: 1000 * 60 * 60 * 24 * 400,
        sameSite: 'strict',
        secure: true
    });
}
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
/**
 * Saves an opt-out record for the user
 *  - if the user already has a cookie consent record, it will be updated to set gpc = true and record the change
 *  - if the user does not have a cookie consent record, it will be created and set to gpc = true
 *
 * @param props
 */
export async function saveOptOutUser(props) {
    try {
        const consent = await loadCookieConsent({ uuid: props.uuid });
        if (consent?.gpc) {
            return consent;
        }
        if (!consent) {
            return await saveCookieConsent({
                ...props,
                action: {
                    accepted: ['functional', 'preferences'],
                    rejected: ['marketing', 'analytics'],
                    url: props.url,
                    method: 'header:sec-gpc'
                },
                gpc: true,
            });
        }
        const change = {
            accepted: [],
            rejected: [],
            url: props.url,
            timestamp: new Date().toISOString(),
            method: 'header:sec-gpc'
        };
        const sql = `UPDATE users.cookieConsentLog
                     SET gpc = :gpc
                     WHERE uuid = :uuid`;
        const data = {
            uuid: props.uuid,
            gpc: true,
            changes: JSON.stringify([...consent.changes, change])
        };
        await mysql2Pool.query(sql, data);
        return await loadCookieConsent({ uuid: props.uuid });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("gpcOptOutUser()", err.message);
            return Promise.reject(err);
        }
        debug("gpcOptOutUser()", err);
        return Promise.reject(new Error('Error in gpcOptOutUser()'));
    }
}
export async function loadUserIdFromEmail(email) {
    const sql = `SELECT id
                 FROM users.users
                 WHERE email = :email`;
    const data = { email: email };
    const [rows] = await mysql2Pool.query(sql, data);
    if (rows.length === 0) {
        return null;
    }
    return rows[0].id;
}
/**
 * Saves a cookie consent record for the user
 *  - if the user already has a cookie consent record, it will be updated to record the change
 *  - if the user does not have a cookie consent record, it will be created
 *
 */
export async function saveCookieConsent({ uuid, userId, url, ipAddress, action, gpc }) {
    try {
        const sqlInsert = `INSERT INTO users.cookieConsentLog (uuid, userId, url, ipAddress, preferences, gpc, changes,
                                                               status, dateExpires)
                           VALUES (:uuid, :userId, :url, :ipAddress, :preferences, :gpc, :changes, :status,
                                   DATE_ADD(NOW(), INTERVAL 1 YEAR))`;
        const sqlUpdate = `UPDATE users.cookieConsentLog
                           SET userId      = :userId,
                               ipAddress   = :ipAddress,
                               preferences = :preferences,
                               gpc         = :gpc,
                               changes     = :changes,
                               status      = :status,
                               dateExpires = DATE_ADD(NOW(), INTERVAL 1 YEAR)
                           WHERE uuid = :uuid`;
        let consent = null;
        const preferences = {
            functional: true,
            preferences: action.accepted.includes('preferences'),
            analytics: action.accepted.includes('analytics'),
            marketing: action.accepted.includes('marketing'),
        };
        const changes = [];
        if (uuid || userId) {
            consent = await loadCookieConsent({ uuid, userId });
            if (consent) {
                changes.push(...consent.changes);
            }
        }
        changes.push({
            ...action,
            url: action.url ?? url,
            timestamp: new Date().toISOString()
        });
        const data = {
            uuid: consent?.uuid ?? randomUUID(),
            url: url,
            userId: consent?.userId ?? userId,
            ipAddress: ipAddress,
            preferences: JSON.stringify(preferences),
            changes: JSON.stringify(changes),
            status: getPreferencesStatus(preferences),
            gpc: gpc ?? consent?.gpc ?? false,
        };
        const sql = consent?.uuid ? sqlUpdate : sqlInsert;
        const [status] = await mysql2Pool.query(sql, data);
        return await loadCookieConsent({ id: status.insertId });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("saveCookieConsent()", err.message);
            return Promise.reject(err);
        }
        debug("saveCookieConsent()", err);
        return Promise.reject(new Error('Error in saveCookieConsent()'));
    }
}
/**
 * Updates the cookie consent record for the user to a current expiration date
 *  - the expiration date is not normally checked but is there for audit purposes
 * @param uuid
 */
export async function extendCookieConsentExpiry(uuid) {
    try {
        const sql = `UPDATE users.cookieConsentLog
                     SET dateExpires = DATE_ADD(NOW(), INTERVAL 1 YEAR)
                     WHERE uuid = :uuid`;
        const data = { uuid: uuid };
        await mysql2Pool.query(sql, data);
        return await loadCookieConsent({ uuid });
    }
    catch (err) {
        if (err instanceof Error) {
            debug("extendCookieConsentExpiry()", err.message);
            return Promise.reject(err);
        }
        debug("extendCookieConsentExpiry()", err);
        return Promise.reject(new Error('Error in extendCookieConsentExpiry()'));
    }
}
/**
 * Checks if the cookie consent record is more than 30 days old, and therefore should be extended
 * @param consent
 */
export function shouldExtendCookieConsent(consent) {
    return dayjs(consent.dateExpires).diff(dayjs(), 'day') > 30;
}
/**
 * Loads a cookie consent record for the user by id, uuid, or userId
 */
export async function loadCookieConsent(props) {
    try {
        const sql = `SELECT uuid,
                            userId,
                            url,
                            ipAddress,
                            JSON_OBJECT(preferences, '$')           AS preferences,
                            JSON_OBJECT(IFNULL(changes, '[]'), '$') AS changes,
                            status,
                            dateCreated,
                            dateUpdated
                     FROM users.cookieConsentLog
                     WHERE id = :id
                        OR uuid = :uuid
                        OR userId = :userId
                     LIMIT 1`;
        const args = {
            id: props.id ?? null,
            uuid: props.uuid ?? null,
            userId: props.userId ?? null,
        };
        const [rows] = await mysql2Pool.query(sql, args);
        if (rows.length === 0) {
            return null;
        }
        const row = rows[0];
        return {
            ...row,
            preferences: JSON.parse(row.preferences),
            gpc: !!row.gpc,
            changes: JSON.parse(row.changes),
        };
    }
    catch (err) {
        if (err instanceof Error) {
            debug("loadCookieConsent()", err.message);
            return Promise.reject(err);
        }
        debug("loadCookieConsent()", err);
        return Promise.reject(new Error('Error in loadCookieConsent()'));
    }
}
/**
 * Returns the status of the preferences based on the preferences
 *  - if all preferences are accepted, the status is "accepted"
 *  - if all preferences are rejected, the status is "rejected"
 *  - if some preferences are accepted and some are rejected, the status is "partial"
 */
function getPreferencesStatus(preferences) {
    if (preferences.functional && preferences.preferences && preferences.analytics && preferences.marketing) {
        return 'accepted';
    }
    if (!(preferences.functional || preferences.preferences || preferences.analytics || preferences.marketing)) {
        return 'rejected';
    }
    return 'partial';
}
