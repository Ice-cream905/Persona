#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const CONTENT_DIR = "content";
const OUTPUT_DIR = "generated/files";
const CACHE_FILE = "generated/cache.json";

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

async function exists(file) {
    try {
        await fs.access(file);
        return true;
    } catch {
        return false;
    }
}

async function copy(src, dst) {
    await ensureDir(path.dirname(dst));
    await fs.copyFile(src, dst);
}

async function sha256(file) {
    const data = await fs.readFile(file);

    return crypto
        .createHash("sha256")
        .update(data)
        .digest("hex");
}

async function loadCache() {
    try {
        return JSON.parse(await fs.readFile(CACHE_FILE, "utf8"));
    } catch {
        return {};
    }
}

async function saveCache(cache) {
    await ensureDir(path.dirname(CACHE_FILE));

    await fs.writeFile(
        CACHE_FILE,
        JSON.stringify(cache, null, 2)
    );
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

const cache = await loadCache();
const newCache = {};

const officeGroups = new Map();

const files = await walk(CONTENT_DIR);

for (const file of files) {

    const relative = path.relative(CONTENT_DIR, file);

    const ext = path.extname(relative).toLowerCase();

    const hash = await sha256(file);

    newCache[relative] = hash;

    let output = null;

    if (OFFICE.has(ext)) {

        output = path.join(
            OUTPUT_DIR,
            path.dirname(relative),
            path.parse(relative).name + ".pdf"
        );

    } else if (ext === ".pdf") {

        output = path.join(
            OUTPUT_DIR,
            relative
        );

    }

    if (
        output &&
        cache[relative] === hash &&
        await exists(output)
    ) {

        console.log(`Skip ${relative}`);

        continue;

    }

    if (OFFICE.has(ext)) {

        const dir = path.dirname(relative);

        if (!officeGroups.has(dir))
            officeGroups.set(dir, []);

        officeGroups.get(dir).push(file);

        continue;

    }

    if (ext === ".pdf") {

        const dst = path.join(
            OUTPUT_DIR,
            relative
        );

        console.log(`Copy ${relative}`);

        await copy(file, dst);

        continue;

    }

    console.log(`Ignore ${relative}`);
}

for (const [dir, files] of officeGroups) {

    console.log(`Convert ${dir || "."}`);

    await convertDirectory(
        files,
        path.join(OUTPUT_DIR, dir)
    );
}

await saveCache(newCache);

console.log("Done.");
