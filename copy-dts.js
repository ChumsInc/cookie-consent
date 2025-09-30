import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const srcDir = path.join(process.cwd(), 'src')
const distDir = path.join(process.cwd(), 'dist');

async function copyDts() {
    const files = await fs.readdir(srcDir)
    for (const file of files) {
        if (file.endsWith('.d.ts')) {
            console.log(`Copying ${file} to ${distDir}`)
            await fs.copyFile(path.join(srcDir, file), path.join(distDir, file))
        }
    }
}

copyDts().then(() => console.log('done')).catch(err => console.error(err))
