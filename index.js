#!/usr/bin/env node
/**
 * validate_private_keys.js — Pretty UI + Format Converter (CJS)
 *
 * Features:
 * - Read keys from: .env, any file, or paste via editor
 * - Extract by: smart-detect, ENV var, comma/newline/space/semicolon
 * - Validate & auto-fix to 0x + 64 lowercase hex (32 bytes)
 * - Convert to: ENV line, JSON array, one-per-line, CSV, or custom per-key template ({key})
 * - Round-trip re-validate after formatting
 * - Save to .env (with backup) or to a new file
 *
 */

const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer"); // v8 (CJS)
const dotenv = require("dotenv");
const chalk = require("chalk"); // v4 (CJS)
const Table = require("cli-table3");
const gradient = require("gradient-string");
const figlet = require("figlet");
const logSymbols = require("log-symbols"); // v4 (CJS)
const boxen = require("boxen"); // v5 (CJS)
// ora compatibility (works with ora@6 CJS and ora@7+ ESM)
const _ora = require("ora");
const ora = typeof _ora === "function" ? _ora : _ora.default;

// Constants
const DOTENV_PATH = path.resolve(process.cwd(), ".env");
const HEX_REGEX = /^[0-9a-fA-F]+$/;
const EXPECTED_HEX_LENGTH = 64; // 32 bytes

// Load .env if present
if (fs.existsSync(DOTENV_PATH)) {
  dotenv.config({ path: DOTENV_PATH });
}

// ──────────────────────────────────────────────────────────────────────────────
// UI Helpers
// ──────────────────────────────────────────────────────────────────────────────
const hr = (label = "") => {
  const len = 60;
  const line = "".padEnd(len, "─");
  if (!label) return chalk.dim(line);
  const text = ` ${label} `;
  const start = Math.max(0, Math.floor((len - text.length) / 2));
  return (
    chalk.dim(line.slice(0, start)) +
    chalk.gray(text) +
    chalk.dim(line.slice(start + text.length))
  );
};

function banner() {
  const msg = figlet.textSync("PK Validator", { font: "Small Slant" });
  console.log(gradient.atlas.multiline(msg));
  const subtitle = boxen(
    chalk.white("Validate and reformat private keys to ") +
      chalk.cyan("0x") +
      chalk.cyan.bold(" + 64 hex"),
    { padding: 1, margin: 0, borderColor: "cyan", borderStyle: "round" }
  );
  console.log(subtitle + "\n");
}

const colorStatus = (ok) =>
  ok ? chalk.black.bgGreen("  VALID  ") : chalk.white.bgRed(" INVALID ");
const faint = (s) => chalk.dim(s);

function buildTable(rows, head) {
  const table = new Table({ head, style: { head: [], border: [] } });
  rows.forEach((r) => table.push(r));
  return table.toString();
}

// ──────────────────────────────────────────────────────────────────────────────
// Core validation helpers
// ──────────────────────────────────────────────────────────────────────────────
function normalizedCandidate(rawKey) {
  if (!rawKey) return "";
  let k = String(rawKey).trim();
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  )
    k = k.slice(1, -1);
  return k.trim();
}

function tryCleanAndFix(rawKey) {
  const original = rawKey;
  let k = normalizedCandidate(rawKey);
  if (k.startsWith("0x") || k.startsWith("0X")) k = k.slice(2);
  const justHex = k.replace(/[^0-9a-fA-F]/g, "");

  const reasons = [];
  if (k !== justHex) reasons.push("removed non-hex chars");
  const lowerHex = justHex.toLowerCase();
  if (!HEX_REGEX.test(lowerHex)) reasons.push("non-hex characters remain");
  if (lowerHex.length !== EXPECTED_HEX_LENGTH)
    reasons.push(`length ${lowerHex.length} != ${EXPECTED_HEX_LENGTH}`);

  const valid =
    HEX_REGEX.test(lowerHex) && lowerHex.length === EXPECTED_HEX_LENGTH;
  const cleaned = valid ? "0x" + lowerHex : null;
  return { original, cleaned, valid, reason: reasons.join("; ") || "ok" };
}

function validateKeys(keys) {
  const results = keys.map((k) => tryCleanAndFix(k));
  const total = results.length;
  const validCount = results.filter((r) => r.valid).length;
  const invalidCount = total - validCount;

  const headerBox = boxen(
    `${logSymbols.info} ${chalk.bold("Summary")}\n\n` +
      `${colorStatus(true)} ${chalk.bold(validCount)}  ` +
      faint("valid") +
      "   " +
      `${colorStatus(false)} ${chalk.bold(invalidCount)}  ` +
      faint("invalid") +
      "\n" +
      faint(`Total: ${total}`),
    {
      padding: 1,
      borderColor: invalidCount ? "red" : "green",
      borderStyle: "round",
    }
  );
  console.log("\n" + headerBox + "\n");

  const rows = results.map((r, idx) => [
    chalk.dim(String(idx + 1)),
    r.original.length > 48 ? r.original.slice(0, 45) + "…" : r.original,
    r.valid ? chalk.green("valid") : chalk.red("invalid"),
    r.cleaned
      ? chalk.cyan(r.cleaned.slice(0, 12) + "…" + r.cleaned.slice(-6))
      : chalk.gray("-"),
    chalk.yellow(r.reason),
  ]);
  console.log(
    buildTable(rows, [
      chalk.gray("#"),
      chalk.gray("Original"),
      chalk.gray("Status"),
      chalk.gray("Cleaned"),
      chalk.gray("Note"),
    ])
  );

  return results;
}

function writeEnvVar(variableName, value, options = { backup: true }) {
  const dotenvPath = DOTENV_PATH;
  let content = "";
  if (fs.existsSync(dotenvPath)) content = fs.readFileSync(dotenvPath, "utf8");
  const keyLine = `${variableName}=${value}\n`;
  if (new RegExp(`^\\s*${variableName}\\s*=.*$`, "m").test(content)) {
    content = content.replace(
      new RegExp(`^\\s*${variableName}\\s*=.*$`, "m"),
      keyLine.trimEnd()
    );
  } else {
    if (content && !content.endsWith("\n")) content += "\n";
    content += keyLine;
  }
  if (options.backup && fs.existsSync(dotenvPath)) {
    const backupPath = dotenvPath + ".bak." + Date.now();
    fs.copyFileSync(dotenvPath, backupPath);
    console.log(faint(`${logSymbols.info} Backup created: ${backupPath}`));
  }
  fs.writeFileSync(dotenvPath, content, "utf8");
}

// Extraction helpers
function extractSmart(text) {
  const re = /(0x)?([0-9a-fA-F]{64})/g;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    out.push(m[0]);
  }
  return out;
}

function splitBy(text, mode) {
  const map = {
    comma: /[,\n]/,
    newline: /\n+/,
    space: /\s+/,
    semicolon: /[;\n]/,
  };
  const sep = map[mode] || /[,\n]/;
  return text
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Build outputs in different formats
function formatOutput(keys, choice, args = {}) {
  switch (choice) {
    case "env_line": {
      const name = args.varName || "PRIVATE_KEYS";
      return `${name}=${keys.join(",")}`;
    }
    case "json_array": {
      return JSON.stringify(keys, null, 2);
    }
    case "lines": {
      return keys.join("\n");
    }
    case "csv": {
      return keys.join(",");
    }
    case "per_key_template": {
      const tpl = args.template || "{key}";
      const joiner = args.joiner != null ? args.joiner : ",\n";
      return keys.map((k) => tpl.replace(/\{key\}/g, k)).join(joiner);
    }
    default:
      return keys.join(",");
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────
(async function main() {
  banner();

  // 1) Choose source
  console.log(hr("SOURCE"));
  const { source } = await inquirer.prompt([
    {
      type: "list",
      name: "source",
      message: "Where should I read keys from?",
      choices: [
        { name: ".env in current folder", value: "env" },
        { name: "Another file (txt/env/json/any)", value: "file" },
        { name: "Paste via editor", value: "editor" },
      ],
    },
  ]);

  let rawText = "";
  let fromPath = null;

  if (source === "env") {
    fromPath = DOTENV_PATH;
    if (!fs.existsSync(fromPath)) {
      console.log(chalk.red(".env not found in current directory."));
      process.exit(1);
    }
    rawText = fs.readFileSync(fromPath, "utf8");
    console.log(
      logSymbols.success,
      chalk.green(`Loaded .env from ${fromPath}`)
    );
  } else if (source === "file") {
    const ans = await inquirer.prompt([
      {
        type: "input",
        name: "path",
        message: "Enter path to the file:",
        default: "./keys.txt",
      },
    ]);
    fromPath = path.resolve(process.cwd(), ans.path);
    if (!fs.existsSync(fromPath)) {
      console.log(chalk.red("File not found: " + fromPath));
      process.exit(1);
    }
    rawText = fs.readFileSync(fromPath, "utf8");
    console.log(logSymbols.success, chalk.green(`Loaded file: ${fromPath}`));
  } else {
    const ans = await inquirer.prompt([
      {
        type: "editor",
        name: "text",
        message: "Paste your keys/raw content. Close the editor to continue:",
      },
    ]);
    rawText = ans.text || "";
  }

  if (!rawText.trim()) {
    console.log(chalk.red("No data provided. Exiting."));
    process.exit(1);
  }

  // 2) Extract keys from the source content
  console.log(hr("EXTRACTION"));
  const { extractMode } = await inquirer.prompt([
    {
      type: "list",
      name: "extractMode",
      message: "How should I extract keys from the content?",
      choices: [
        {
          name: "Smart-detect (scan for 0x + 64-hex or bare 64-hex)",
          value: "smart",
        },
        { name: "From an ENV variable (e.g., PRIVATE_KEYS)", value: "envvar" },
        { name: "Split by comma/newline", value: "comma" },
        { name: "Split by newline only", value: "newline" },
        { name: "Split by spaces", value: "space" },
        { name: "Split by semicolon", value: "semicolon" },
      ],
    },
  ]);

  let initialKeys = [];
  if (extractMode === "smart") {
    initialKeys = extractSmart(rawText);
  } else if (extractMode === "envvar") {
    const ans = await inquirer.prompt([
      {
        type: "input",
        name: "varName",
        message: "Variable name:",
        default: "PRIVATE_KEYS",
      },
    ]);
    const m = rawText.match(
      new RegExp(`^\\s*${ans.varName}\\s*=\\s*(.*)$`, "m")
    );
    if (m) {
      initialKeys = splitBy(m[1], "comma");
    } else {
      console.log(
        chalk.yellow(
          `Variable ${ans.varName} not found; falling back to smart-detect.`
        )
      );
      initialKeys = extractSmart(rawText);
    }
  } else {
    initialKeys = splitBy(rawText, extractMode);
  }

  if (!initialKeys.length) {
    console.log(chalk.red("No candidate keys found. Exiting."));
    process.exit(1);
  }

  // 3) Validate & optionally auto-fix
  const spinner = ora({ text: "Validating keys…", spinner: "dots" }).start();
  let results = validateKeys(initialKeys);
  spinner.stop();

  const invalidButFixable = results.filter((r) => !r.valid && r.cleaned);
  const invalidUnfixable = results.filter((r) => !r.valid && !r.cleaned);

  if (invalidUnfixable.length > 0) {
    const warn = boxen(
      `${logSymbols.warning} ` +
        chalk.yellow(
          "Some keys are not auto-fixable (not 64 hex after cleaning)."
        ),
      { padding: 1, borderColor: "yellow", borderStyle: "round" }
    );
    console.log("\n" + warn + "\n");
  }

  if (invalidButFixable.length > 0) {
    console.log(hr("AUTO-CORRECT"));
    const { doFix } = await inquirer.prompt([
      {
        type: "confirm",
        name: "doFix",
        message: `Auto-correct ${invalidButFixable.length} key(s)?`,
        default: true,
      },
    ]);
    if (doFix) {
      results.forEach((r) => {
        if (!r.valid && r.cleaned) {
          r.applied = r.cleaned;
          r.valid = true;
        }
      });
      console.log(
        logSymbols.success,
        chalk.green("Applied corrections to fixable keys.")
      );
    } else {
      console.log(faint("No automatic corrections applied."));
    }
  }

  const normalizedKeys = results.map((r) => {
    if (r.applied) return r.applied;
    if (r.valid && r.cleaned) return r.cleaned;
    const norm = normalizedCandidate(r.original);
    if (
      (norm.startsWith("0x") || norm.startsWith("0X")) &&
      norm.length === 2 + EXPECTED_HEX_LENGTH &&
      HEX_REGEX.test(norm.slice(2))
    ) {
      return "0x" + norm.slice(2).toLowerCase();
    }
    return r.original; // keep invalid to show user later
  });

  // 4) Choose output format
  console.log(hr("OUTPUT FORMAT"));
  const { outFormat } = await inquirer.prompt([
    {
      type: "list",
      name: "outFormat",
      message: "Choose a target format:",
      choices: [
        { name: "ENV line: PRIVATE_KEYS=0x...,0x...,0x...", value: "env_line" },
        { name: 'JSON array [ "0x...", "0x..." ]', value: "json_array" },
        { name: "One per line", value: "lines" },
        { name: "CSV (comma-separated)", value: "csv" },
        {
          name: "Custom per-key template (use {key})",
          value: "per_key_template",
        },
      ],
    },
  ]);

  let fmtArgs = {};
  if (outFormat === "env_line") {
    const ans = await inquirer.prompt([
      {
        type: "input",
        name: "varName",
        message: "Variable name",
        default: "PRIVATE_KEYS",
      },
    ]);
    fmtArgs.varName = ans.varName;
  } else if (outFormat === "per_key_template") {
    const ans = await inquirer.prompt([
      {
        type: "input",
        name: "template",
        message: "Template (use {key})",
        default: "{key}",
      },
      {
        type: "input",
        name: "joiner",
        message: "Joiner between entries",
        default: ",\n",
      },
    ]);
    fmtArgs.template = ans.template;
    fmtArgs.joiner = ans.joiner;
  }

  const formatted = formatOutput(normalizedKeys, outFormat, fmtArgs);

  // 5) Re-validate from the formatted output (round trip)
  console.log(hr("RE-VALIDATE"));
  let reparsed = [];
  if (outFormat === "env_line") {
    const m = formatted.match(
      new RegExp(`^\\s*${fmtArgs.varName}\\s*=\\s*(.*)$`, "m")
    );
    if (m) reparsed = splitBy(m[1], "comma");
  } else if (outFormat === "json_array") {
    try {
      reparsed = JSON.parse(formatted);
    } catch (_) {
      reparsed = [];
    }
  } else if (outFormat === "lines") {
    reparsed = formatted.split(/\n+/).filter(Boolean);
  } else if (outFormat === "csv") {
    reparsed = formatted
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (outFormat === "per_key_template") {
    // Best-effort smart-detect
    reparsed = extractSmart(formatted);
  }

  const spinner2 = ora({
    text: "Re-validating formatted output…",
    spinner: "dots",
  }).start();
  validateKeys(reparsed);
  spinner2.succeed("Re-validation complete.");

  // 6) Save destination
  console.log(hr("SAVE"));
  const { dest } = await inquirer.prompt([
    {
      type: "list",
      name: "dest",
      message: "Where should I save the formatted output?",
      choices: [
        {
          name: "Write/overwrite .env variable (only for ENV line)",
          value: "env_write",
        },
        { name: "Write to a new file", value: "file_write" },
        { name: "Skip saving (just show)", value: "skip" },
      ],
    },
  ]);

  if (dest === "env_write" && outFormat !== "env_line") {
    console.log(
      chalk.yellow(
        "ENV write is only available when output format is an ENV line. Switching to file write."
      )
    );
  }

  if (dest === "env_write" && outFormat === "env_line") {
    const confirm = await inquirer.prompt([
      {
        type: "confirm",
        name: "ok",
        default: false,
        message: `Overwrite ${DOTENV_PATH} with ${fmtArgs.varName}=… ? (backup will be made)`,
      },
    ]);
    if (confirm.ok) {
      const spinner3 = ora({ text: "Writing .env…", spinner: "dots" }).start();
      try {
        writeEnvVar(fmtArgs.varName, normalizedKeys.join(","), {
          backup: true,
        });
        spinner3.succeed(".env updated successfully.");
      } catch (e) {
        spinner3.fail("Failed to write .env");
        console.error(chalk.red(e.message));
      }
    } else {
      console.log(faint("Skipped writing .env."));
    }
  } else if (dest === "file_write" || dest === "env_write") {
    const ans = await inquirer.prompt([
      {
        type: "input",
        name: "outPath",
        message: "Output file path:",
        default: "./keys.out.txt",
      },
    ]);
    const outPath = path.resolve(process.cwd(), ans.outPath);
    try {
      fs.writeFileSync(outPath, formatted, "utf8");
      console.log(logSymbols.success, chalk.green("Wrote: " + outPath));
    } catch (e) {
      console.error(chalk.red("Failed to write output file: " + e.message));
    }
  } else {
    console.log(
      "\n" +
        boxen(
          formatted.slice(0, 2000) +
            (formatted.length > 2000 ? "\n…(truncated)…" : ""),
          { padding: 1, borderStyle: "round", borderColor: "cyan" }
        )
    );
  }

  console.log(
    "\n" +
      boxen(gradient.cristal(" Done. Never share private keys publicly. "), {
        padding: 1,
        borderStyle: "round",
        borderColor: "cyan",
      })
  );
})();
