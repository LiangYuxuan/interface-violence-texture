/* eslint-disable import-x/no-unused-modules */

import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';

import { CASCClient } from '@rhyster/wow-casc-dbc';
import { Jimp } from 'jimp';

import BLPReader from './blp.ts';
import { latestVersion } from './client.ts';

const prevBuild = await fs.readFile('buildInfo.txt', 'utf-8').catch(() => '0');

const currBuild = latestVersion.version.BuildId;
assert(currBuild, 'Failed to get current build number');

if (process.argv[2] !== '--force' && prevBuild === currBuild) {
    console.info(new Date().toISOString(), `[INFO]: Build ${currBuild} is up to date`);
    process.exit(0);
}

const client = new CASCClient('us', latestVersion.product, latestVersion.version);
await client.init();

console.info(new Date().toISOString(), '[INFO]: Loading remote TACT keys');
await client.loadRemoteTACTKeys();
console.info(new Date().toISOString(), '[INFO]: Loaded remote TACT keys');

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

const promises = listFile.map(async (file) => {
    const { id, name } = file;

    if (
        name.startsWith('interface/')
        && !name.startsWith('interface/addons/')
        && !name.startsWith('interface/cinematics/')
        && !name.startsWith('interface/framexml/')
        && !name.startsWith('interface/glues/')
        && !name.startsWith('interface/gluexml/')
        && !/^interface\/worldmap\/.*\//.test(name)
    ) {
        const cKeys = client.getContentKeysByFileDataID(id);
        if (cKeys) {
            // eslint-disable-next-line no-bitwise
            const enUS = cKeys.find((cKey) => cKey.localeFlags & CASCClient.LocaleFlags.enUS);
            // eslint-disable-next-line no-bitwise
            const zhCN = cKeys.find((cKey) => cKey.localeFlags & CASCClient.LocaleFlags.zhCN);

            if (enUS && zhCN && enUS.cKey !== zhCN.cKey) {
                console.info(`Processing ${name}`);

                const enUSFilePath = path.join('output', 'enUS', name);
                await fs.mkdir(path.dirname(enUSFilePath), { recursive: true });

                const [enUSBuffer, zhCNBuffer] = await Promise.all([
                    client.getFileByContentKey(enUS.cKey),
                    client.getFileByContentKey(zhCN.cKey),
                ]);

                if (name.endsWith('.blp')) {
                    const compareFilePath = path.join('output', 'compare', name.replace(/\.blp$/, '.png'));
                    await fs.mkdir(path.dirname(compareFilePath), { recursive: true });

                    const enUSImage = new BLPReader(
                        new Uint8Array(enUSBuffer.buffer),
                    ).processMipmap(0);
                    const zhCNImage = new BLPReader(
                        new Uint8Array(zhCNBuffer.buffer),
                    ).processMipmap(0);

                    const { width, height } = enUSImage;
                    const enUSRGBA = enUSImage.rgba;
                    const zhCNRGBA = zhCNImage.rgba;

                    const buffer = Buffer.alloc(width * 2 * height * 4);
                    for (let i = 0; i < height; i += 1) {
                        const originImageOffset = i * width * 4;
                        const compareImageOffset = i * width * 4 * 2;

                        buffer.set(
                            enUSRGBA.slice(
                                originImageOffset,
                                originImageOffset + width * 4,
                            ),
                            compareImageOffset,
                        );

                        buffer.set(
                            zhCNRGBA.slice(
                                originImageOffset,
                                originImageOffset + width * 4,
                            ),
                            compareImageOffset + width * 4,
                        );
                    }

                    const image = new Jimp({ data: buffer, width: width * 2, height });
                    const imageFileBuffer = await image.getBuffer('image/png');

                    await Promise.all([
                        fs.writeFile(enUSFilePath, enUSBuffer.buffer),
                        fs.writeFile(compareFilePath, imageFileBuffer),
                    ]);
                } else {
                    await fs.writeFile(enUSFilePath, enUSBuffer.buffer);
                }
            }
        }
    }
});

await Promise.all(promises);

await fs.writeFile('buildInfo.txt', currBuild);

if (process.env.GITHUB_OUTPUT !== undefined) {
    await fs.writeFile(process.env.GITHUB_OUTPUT, `updated=true\nbuild=${currBuild}\n`, { flag: 'a' });
}
