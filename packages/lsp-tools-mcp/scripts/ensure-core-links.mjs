import { lstatSync, mkdirSync, symlinkSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function ensureDirectoryLink({ linkPath, targetPath }) {
	mkdirSync(dirname(linkPath), { recursive: true });

	if (pathExists(linkPath)) return;

	const linkTarget = relative(dirname(linkPath), targetPath);
	symlinkSync(linkTarget, linkPath, process.platform === "win32" ? "junction" : "dir");
}

function pathExists(path) {
	try {
		lstatSync(path);
		return true;
	} catch (error) {
		if (isNodeErrorWithCode(error, "ENOENT")) return false;
		throw error;
	}
}

function isNodeErrorWithCode(error, code) {
	return error instanceof Error && "code" in error && error.code === code;
}
