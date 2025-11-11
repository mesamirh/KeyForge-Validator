# 🔐 KeyForge Validator

A powerful and interactive CLI tool for **validating, auto-correcting, and reformatting EVM private keys**. Designed for developers who manage multiple wallets and need a safe, fast, and consistent way to parse `.env` files, text files, or any raw key dump.

This script provides a smooth UI with color-coded feedback, auto-fixing options, customizable output formats, and safe `.env` writing with backups.

---

## 🚀 Features

- ✅ Validate private keys (checks `0x` + 64 hex = 32 bytes)
- ✅ Auto-correct common issues: missing `0x`, uppercase, spaces, non-hex chars
- ✅ Multiple input sources:

  - `.env` file (`PRIVATE_KEYS=...`)
  - Any `.txt` or `.env` file
  - Paste into editor (Inquirer editor mode)

- ✅ Smart extraction modes:

  - Auto-detect all 64‑hex patterns
  - Extract from specific ENV variable
  - Split by comma / newline / semicolon / space

- ✅ Format conversion:

  - `PRIVATE_KEYS=0x...,0x...`
  - JSON array
  - One key per line
  - CSV
  - Custom template (`{key}` with custom joiner)

- ✅ Round‑trip re-validation to ensure no corruption
- ✅ Safe saving to `.env` (auto backup)
- ✅ Beautiful CLI with colors, tables, and summaries

---

## 📦 Installation

```bash
git clone https://github.com/mesamirh/KeyForge-Validator.git
cd KeyForge-Validator
```

Use Node.js v18+.

```bash
npm i inquirer@8 chalk@4 dotenv cli-table3 gradient-string figlet log-symbols@4 ora@6 boxen@5
```

These versions ensure CommonJS compatibility.

---

## ▶️ Usage

Run from the terminal:

```bash
node main.js
```

You will be prompted to:

1. Choose the data source
2. Choose extraction mode
3. Validate & auto-correct keys
4. Choose output format
5. Revalidate the formatted output
6. Save results to `.env` or file

---

## 🗂 Input Formats

You may store keys as:

### ✅ `.env` format

```
PRIVATE_KEYS=0xaaa...,0xbbb...,0xccc...
```

### ✅ Text file (comma, space, or newline separated)

```
0xaaa111...
0xbbb222...
0xccc333...
```

### ✅ JSON array

```
[
  "0xaaa...",
  "0xbbb..."
]
```

### ✅ Full raw dump

The smart extractor will find any valid 64‑hex sequences.

---

## ✅ Output Format Options

- `ENV line`: `PRIVATE_KEYS=0x...,0x...`
- JSON Array
- One per line
- CSV
- Custom template (e.g., `{key},` OR `'private_key="{key}"'`)

---

## 🛡 Safety Notes

- **Never share private keys publicly.**
- The script auto‑creates `.env.bak.TIMESTAMP` before writing.
- Invalid/unfixable keys are shown clearly so you can review before saving.
