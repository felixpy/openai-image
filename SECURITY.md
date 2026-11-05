# Security policy

## Reporting a vulnerability

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/felixpy/openai-image/security/advisories/new).

Please include:

- The package version and Node.js version
- What an attacker can do, and what they need
- Steps to reproduce, or a proof of concept that does not contain secrets

Do **not** paste API keys, bearer tokens, `.env` files, or request headers. If a log line contains `OPENAI_API_KEY` or an `sk-` key, delete that value before sending the report. Do not open a public issue for an unpublished vulnerability.

The maintainer will acknowledge the report and coordinate a fix. There is no bug-bounty program.

## Supported versions

| Version | Status |
|---|---|
| 0.1.x | Supported |

## Secrets in this repository

This server reads `OPENAI_API_KEY` from the environment at tool-call time and does not log it. Never commit a key, and never put one in an issue, pull request, or discussion.
