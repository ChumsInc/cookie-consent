import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import process from 'node:process';
import type {Request, Response} from 'express';
import Debug from 'debug';

const debug = Debug('chums:src:about');

export interface PackageJSON {
    name: string;
    version: string;
}

async function loadAPIVersion() {
    try {
        let version = '0.0.0';
        const path = resolve(process.cwd(), './package.json');
        const contents = await readFile(path);
        if (contents) {
            const json: PackageJSON = JSON.parse(contents.toString());
            version = json?.version ?? 'unknown version';
        }
        return version;
    } catch (err: unknown) {
        if (err instanceof Error) {
            console.debug("loadAPIVersion()", err.message);
            return Promise.reject(err);
        }
        console.debug("loadAPIVersion()", err);
        return Promise.reject(new Error('Error in loadAPIVersion()'));
    }
}

export const aboutAPI = async (_req: Request, res: Response) => {
    try {
        const version = await loadAPIVersion();
        // @TODO: Update this api path to correct name
        res.json({site: '/api/node-presets', version});
    } catch (err) {
        if (err instanceof Error) {
            debug("aboutAPI()", err.message);
            return Promise.reject(err);
        }
        debug("aboutAPI()", err);
        return Promise.reject(new Error('Error in aboutAPI()'));
    }
}
