# Security Policy

## Scope

Sentinel is a local desktop application. The attack surface is intentionally narrow:

- The app makes outbound calls to **Binance REST API** (candle data) and **Google Gemini API** (if AI narration is enabled).
- API keys are stored in local AppData — they are never transmitted to Sentinel servers (there are no Sentinel servers).
- Analysis results, history, and settings are stored locally on disk.

Security issues in the following areas are in scope:

- Vulnerabilities that allow arbitrary code execution on the user's machine
- Vulnerabilities that exfiltrate user data (API keys, analysis history) to a third party
- Supply chain issues (malicious dependency updates)
- Insecure key storage

Issues in **Binance's API** or **Google's Gemini API** should be reported directly to those services.

## Reporting a Vulnerability

**Please do not file a public GitHub issue for security vulnerabilities.**

Report vulnerabilities by opening a [GitHub Security Advisory](https://github.com/fakej3/Sentinel/security/advisories/new) (private, only visible to maintainers).

Include:

1. A description of the vulnerability and its potential impact
2. Steps to reproduce or a proof-of-concept
3. The Sentinel version and platform affected

You can expect an acknowledgement within 72 hours. If the issue is confirmed, a patch will be prioritized and a public advisory published once a fix is available.

## Supported Versions

Only the latest release receives security fixes. Confirmed vulnerabilities are patched on the latest version before a public advisory is published.
