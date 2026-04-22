#!/usr/bin/env bun
/**
 * debug.ts — Debug script to check __dirname and DB_PATH
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Use the directory of this source file, NOT process.cwd().
// Claude Desktop spawns MCP processes with cwd=/, which is read-only on macOS.
const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "..", ".nerve", "hub.db");

console.log(`process.cwd(): ${process.cwd()}`);
console.log(`__dirname: ${__dirname}`);
console.log(`DB_PATH: ${DB_PATH}`);
console.log(`Import meta URL: ${import.meta.url}`);
