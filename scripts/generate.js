#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const FILE_ROOT = "generated/files";
const DOC_ROOT = "generated/docs";

async function walk(dir) {
    const entries = await fs.readdir(dir, {
        withFileTypes: true,
    });

    const folders = [];

    for (const entry of entries) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            folders.push(full);
            folders.push(...await walk(full));
        }
    }

    return folders;
}

async function generateFolder(dir) {

    const relative = path.relative(FILE_ROOT, dir);

    const outdir = path.join(DOC_ROOT, relative);

    await fs.mkdir(outdir, {
        recursive: true,
    });

    const entries = await fs.readdir(dir, {
        withFileTypes: true,
    });

    const folders = entries
        .filter(e => e.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name));

    const files = entries
        .filter(e => e.isFile() && e.name.toLowerCase().endsWith(".pdf"))
        .sort((a, b) => a.name.localeCompare(b.name));

    const title =
        relative === ""
            ? "Home"
            : path.basename(relative);

    let md = `---
title: ${title}
---

# ${title}

`;

    if (folders.length) {

        md += "## Folders\n\n";

        for (const folder of folders) {
            md += `- [📁 ${folder.name}](./${folder.name}/)\n`;
        }

        md += "\n";
    }

    if (files.length) {

        md += "## Documents\n\n";

        md += "| Name | PDF |\n";
        md += "| ---- | --- |\n";

        for (const file of files) {

            const stem = path.parse(file.name).name;

            const pdf =
                "/files/" +
                [...(relative ? relative.split(path.sep) : []), file.name]
                .map(encodeURIComponent)
                .join("/");
            md += `| ${stem} | [Open](${pdf}) |\n`;
        }

        md += "\n";
    }

    await fs.writeFile(
        path.join(outdir, "index.md"),
        md
    );
}

await fs.rm(DOC_ROOT, {
    recursive: true,
    force: true,
});

await fs.mkdir(DOC_ROOT, {
    recursive: true,
});

// Generate root page
await generateFolder(FILE_ROOT);

// Generate every subdirectory
const dirs = await walk(FILE_ROOT);

for (const dir of dirs) {
    console.log("Generate", path.relative(FILE_ROOT, dir));
    await generateFolder(dir);
}

console.log("Done.");
