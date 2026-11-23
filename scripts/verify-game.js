"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const htmlPath = path.join(publicDir, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const failures = [];

function checkLocalReference(raw, kind) {
  const value = raw.split(/[?#]/, 1)[0];
  if (!value || value.startsWith("data:") || value.startsWith("http:") || value.startsWith("https:") || value.startsWith("//") || value.startsWith("#")) return;
  const relative = value.startsWith("/") ? value.slice(1) : value;
  const target = path.resolve(publicDir, relative);
  if (!target.startsWith(publicDir + path.sep) && target !== publicDir) {
    failures.push(kind + " escapes public directory: " + raw);
    return;
  }
  if (!fs.existsSync(target)) failures.push("Missing " + kind + ": " + raw);
}

for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) checkLocalReference(match[1], "script");
for (const match of html.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["']/gi)) checkLocalReference(match[1], "stylesheet or link");
for (const match of html.matchAll(/<(?:img|source)\b[^>]*\bsrc=["']([^"']+)["']/gi)) checkLocalReference(match[1], "media");

const browserFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(?:js|html|css)$/.test(entry.name)) browserFiles.push(file);
  }
}
walk(publicDir);

const forbidden = ["SUPABASE_SECRET_KEY", "SESSION_SECRET"];
for (const file of browserFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const secretName of forbidden) {
    if (source.includes(secretName)) failures.push("Server-only variable name appears in browser file: " + path.relative(root, file));
  }
}

if (failures.length) {
  console.error("World Sercher checks failed:");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}
console.log("World Sercher checks passed: local entry assets exist and no server-only secret names are in public files.");
