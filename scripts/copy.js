#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const CONTENT_DIR = "content";
const OUTPUT_DIR = "generated/files";
const CACHE_FILE = "generated/cache.json";

const COPY = new Set([
    ".pdf",
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
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

const cache = await loadCache();
const newCache = {};

const files = await walk(CONTENT_DIR);

for (const file of files) {

    const relative = path.relative(CONTENT_DIR, file);
    const ext = path.extname(relative).toLowerCase();

    if (!COPY.has(ext)) {
        console.log(`Ignore ${relative}`);
        continue;
    }

    const hash = await sha256(file);
    newCache[relative] = hash;

    const dst = path.join(OUTPUT_DIR, relative);

    if (
        cache[relative] === hash &&
        await exists(dst)
    ) {
        console.log(`Skip ${relative}`);
        continue;
    }

    console.log(`Copy ${relative}`);
    await copy(file, dst);
}

await saveCache(newCache);

console.log("Done.");
