#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const CONTENT_DIR = "content";
const OUTPUT_DIR = "generated/files";

const OFFICE = new Set([
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
]);

async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    let files = [];

    for (const entry of entries) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory())
            files.push(...await walk(full));
        else
            files.push(full);
    }

    return files;
}

async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}

async function copy(src, dst) {
    await ensureDir(path.dirname(dst));
    await fs.copyFile(src, dst);
}

async function convertDirectory(files, outdir) {
    await ensureDir(outdir);

    return new Promise((resolve, reject) => {
        const proc = spawn("soffice", [
            "--headless",
            "--nologo",
            "--nodefault",
            "--nolockcheck",
            "--norestore",
            "--convert-to",
            "pdf",
            "--outdir",
            outdir,
            ...files
        ], {
            stdio: "inherit"
        });


        proc.on("error", reject);

        proc.on("close", code => {

            if (code === 0)
                resolve();
            else
                reject(new Error(`LibreOffice exited with ${code}`));

        });

    });
}

await fs.rm("generated", {
    recursive: true,
    force: true
});

const officeGroups = new Map();

const files = await walk(CONTENT_DIR);

for (const file of files) {

    const relative = path.relative(CONTENT_DIR, file);

    const ext = path.extname(relative).toLowerCase();

    if (OFFICE.has(ext)) {

        const dir = path.dirname(relative);

        if (!officeGroups.has(dir))
            officeGroups.set(dir, []);

        officeGroups.get(dir).push(file);

        continue;
    }

    if (ext === ".pdf") {

        const dst = path.join(OUTPUT_DIR, relative);

        console.log(`Copy ${relative}`);

        await copy(file, dst);

    }
}

for (const [dir, files] of officeGroups) {

    console.log(`Convert ${dir || "."}`);

    await convertDirectory(
        files,
        path.join(OUTPUT_DIR, dir)
    );
}

console.log("Done.");
