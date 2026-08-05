#!/usr/bin/env node

import fs from "node:fs/promises";

async function copy(src, dst) {
    await fs.cp(src, dst, {
        recursive: true,
        force: true,
    });
}

async function main() {
    // Clean previous published output
    await fs.rm("docs", {
        recursive: true,
        force: true,
    });

    await fs.rm("static/files", {
        recursive: true,
        force: true,
    });

    // Publish
    await copy("generated/docs", "docs");
    await copy("generated/files", "static/files");

    console.log("Published generated/docs -> docs");
    console.log("Published generated/files -> static/files");
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
