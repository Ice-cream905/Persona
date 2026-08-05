#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const FILE_ROOT = "generated/files";
const DOC_ROOT = "generated/docs";

const ASK = process.argv.includes("--ask");
const FORCE = process.argv.includes("--force");

const rl = ASK
    ? readline.createInterface({
        input: stdin,
        output: stdout,
    })
    : null;

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

async function exists(file) {
    try {
        await fs.access(file);
        return true;
    } catch {
        return false;
    }
}

async function generateFolder(dir) {

    const relative = path.relative(FILE_ROOT, dir);

    const outdir = path.join(DOC_ROOT, relative);

    await fs.mkdir(outdir, {
        recursive: true,
    });

    const outfile = path.join(outdir, "index.md");

    if (await exists(outfile)) {

        if (!FORCE) {

            if (ASK) {

                const answer = await rl.question(
                    `Overwrite ${outfile}? [y/N] `
                );

                if (!/^y(es)?$/i.test(answer.trim())) {
                    console.log(`Skip ${relative || "."}`);
                    return;
                }

            } else {

                console.log(`Skip ${relative || "."}`);
                return;

            }

        }

    }

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

    await fs.writeFile(outfile, md);

    console.log(`${await exists(outfile) ? "Overwrite" : "Generate"} ${relative || "."}`);
}

await fs.mkdir(DOC_ROOT, {
    recursive: true,
});

await generateFolder(FILE_ROOT);

const dirs = await walk(FILE_ROOT);

for (const dir of dirs) {
    await generateFolder(dir);
}

if (rl) {
    await rl.close();
}

console.log("Done.");
