import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';

import { CASCClient, WDCReader, DBDParser } from '@rhyster/wow-casc-dbc';

import { latestVersion } from './client.ts';
import BLPReader from './blp.ts';
import createBMP from './bmp.ts';

const client = new CASCClient('us', latestVersion.product, latestVersion.version);
await client.init();

// eslint-disable-next-line no-console
console.log(new Date().toISOString(), '[INFO]: Loading remote TACT keys');
await client.loadRemoteTACTKeys();
// eslint-disable-next-line no-console
console.log(new Date().toISOString(), '[INFO]: Loaded remote TACT keys');

const loadDB2 = async (fileDataID: number) => {
    const cKeys = client.getContentKeysByFileDataID(fileDataID);
    assert(cKeys, `No cKeys found for fileDataID ${fileDataID.toString()}`);

    const cKey = cKeys
        // eslint-disable-next-line no-bitwise
        .find((data) => !!(data.localeFlags & CASCClient.LocaleFlags.zhCN));
    assert(cKey, `No cKey found for fileDataID ${fileDataID.toString()} in zhCN`);

    const data = await client.getFileByContentKey(cKey.cKey, true);
    const reader = new WDCReader(data.buffer, data.blocks);
    const parser = await DBDParser.parse(reader);

    return parser;
};

const includes: number[] = [];
const excludes: number[] = [];

const [loadingScreen, artTile, overlayTile] = await Promise.all([
    loadDB2(1266541), // dbfilesclient/loadingscreens.db2
    loadDB2(1957210), // dbfilesclient/uimaparttile.db2
    loadDB2(1957212), // dbfilesclient/worldmapoverlaytile.db2
]);

loadingScreen.getAllIDs().forEach((id) => {
    const row = loadingScreen.getRowData(id);
    const narrowScreenFileDataID = row?.NarrowScreenFileDataID as number;
    const wideScreenFileDataID = row?.WideScreenFileDataID as number;
    const wideScreen169FileDataID = row?.WideScreen169FileDataID as number;
    const mainImageFileDataID = row?.MainImageFileDataID as number;
    const logoFileDataID = row?.LogoFileDataID as number;

    if (narrowScreenFileDataID) {
        excludes.push(narrowScreenFileDataID);
    }

    if (wideScreenFileDataID) {
        excludes.push(wideScreenFileDataID);
    }

    if (wideScreen169FileDataID) {
        excludes.push(wideScreen169FileDataID);
    }

    if (mainImageFileDataID) {
        includes.push(mainImageFileDataID);
    }

    if (logoFileDataID) {
        includes.push(logoFileDataID);
    }
});

artTile.getAllIDs().forEach((id) => {
    const row = artTile.getRowData(id);
    const fileDataID = row?.FileDataID as number;

    if (fileDataID) {
        excludes.push(fileDataID);
    }
});

overlayTile.getAllIDs().forEach((id) => {
    const row = overlayTile.getRowData(id);
    const fileDataID = row?.FileDataID as number;

    if (fileDataID) {
        excludes.push(fileDataID);
    }
});

const listFileText = await fs.readFile('./community-listfile.csv', 'utf-8');
const listFile = listFileText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
        const [idText, name] = line.split(';');
        const id = parseInt(idText, 10);
        return { id, name };
    });

interface FileData {
    id: number,
    name: string,
    enUS: string,
    zhCN: string,
}

const result: FileData[] = [];

listFile.forEach((file) => {
    const { id, name } = file;

    if (
        includes.includes(id)
        || (
            name.startsWith('interface/')
            && !excludes.includes(id)
            && !name.startsWith('interface/addons/')
            && !name.startsWith('interface/cinematics/')
            && !name.startsWith('interface/framexml/')
            && !name.startsWith('interface/glues/loadingscreens')
            && !name.startsWith('interface/gluexml/')
            && !/^interface\/worldmap\/.*\//.test(name)
        )
    ) {
        const cKeys = client.getContentKeysByFileDataID(id);
        if (cKeys) {
            // eslint-disable-next-line no-bitwise
            const enUS = cKeys.find((cKey) => cKey.localeFlags & CASCClient.LocaleFlags.enUS);
            // eslint-disable-next-line no-bitwise
            const zhCN = cKeys.find((cKey) => cKey.localeFlags & CASCClient.LocaleFlags.zhCN);

            if (enUS && zhCN && enUS.cKey !== zhCN.cKey) {
                result.push({
                    id,
                    name,
                    enUS: enUS.cKey,
                    zhCN: zhCN.cKey,
                });
            }
        }
    }
});

// eslint-disable-next-line no-restricted-syntax
for (const { name, enUS, zhCN } of result) {
    // eslint-disable-next-line no-console
    console.log(`Processing ${name}`);

    // eslint-disable-next-line no-await-in-loop
    await Promise.all([
        (async () => {
            const data = await client.getFileByContentKey(enUS);
            const filePath = path.join('output', 'enUS', name);
            const fileDir = path.dirname(filePath);
            await fs.mkdir(fileDir, { recursive: true });
            await fs.writeFile(filePath, data.buffer);

            if (name.endsWith('.blp')) {
                const blp = new BLPReader(new Uint8Array(data.buffer));
                const mipmap = blp.processMipmap(0);

                const bmp = createBMP(mipmap.rgba, mipmap.width, mipmap.height);

                const bmpPath = path.join('output', 'compare', name.replace(/\.blp$/, '.enUS.bmp'));
                const bmpDir = path.dirname(bmpPath);
                await fs.mkdir(bmpDir, { recursive: true });
                await fs.writeFile(bmpPath, Buffer.from(bmp.buffer));
            }
        })(),
        (async () => {
            const data = await client.getFileByContentKey(zhCN);
            const filePath = path.join('output', 'zhCN', name);
            const fileDir = path.dirname(filePath);
            await fs.mkdir(fileDir, { recursive: true });
            await fs.writeFile(filePath, data.buffer);

            if (name.endsWith('.blp')) {
                const blp = new BLPReader(new Uint8Array(data.buffer));
                const mipmap = blp.processMipmap(0);

                const bmp = createBMP(mipmap.rgba, mipmap.width, mipmap.height);

                const bmpPath = path.join('output', 'compare', name.replace(/\.blp$/, '.zhCN.bmp'));
                const bmpDir = path.dirname(bmpPath);
                await fs.mkdir(bmpDir, { recursive: true });
                await fs.writeFile(bmpPath, Buffer.from(bmp.buffer));
            }
        })(),
    ]);
}
