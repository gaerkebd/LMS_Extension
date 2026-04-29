# Privacy Policy - Canvas LMS Time Estimator

**Last Updated:** April 2026

## What Data We Collect

This extension processes the following data from your Canvas LMS account:
- Assignment titles, due dates, point values, and submission types
- Course names and IDs
- Assignment description snippets (used for AI estimation only)

We do **not** collect: student IDs, grades, personal information, login credentials, or submitted work.

## How We Use Your Data

Assignment metadata is used solely to estimate how long each assignment will take to complete. Depending on your configuration:

- **Heuristic mode (no AI):** All processing happens locally on your device. No data leaves your browser.
- **AI-powered mode:** Assignment details (title, type, course name, points, description snippet) are sent to your chosen AI provider for time estimation.

## Third-Party Services

This extension may communicate with the following services based on your configuration:

| Service | When Used | Data Sent |
|---------|-----------|-----------|
| Canvas LMS API | Always (when configured) | API requests authenticated with your Canvas token |
| OpenAI API | If selected as AI provider | Assignment metadata for estimation |
| Anthropic API | If selected as AI provider | Assignment metadata for estimation |
| Local LLM (Ollama) | If selected as AI provider | Assignment metadata (stays on your network) |
| Stripe | If you purchase a subscription | Payment information (handled by Stripe) |
| Google Calendar API | Premium feature, if enabled | Calendar free/busy data read; study block events created |

Each third-party service is subject to its own privacy policy:
- [OpenAI Privacy Policy](https://openai.com/privacy)
- [Anthropic Privacy Policy](https://www.anthropic.com/privacy)
- [Stripe Privacy Policy](https://stripe.com/privacy)
- [Google Privacy Policy](https://policies.google.com/privacy)

## Local Storage

All data is stored locally on your device using Chrome's extension storage:
- **Settings** (chrome.storage.sync): Canvas URL, API keys, preferences. Chrome encrypts this data and may sync it across your signed-in devices.
- **Cache** (chrome.storage.local): Cached assignment data, usage counters. Stored only on this device.

## What We Do NOT Do

- We do not collect analytics, telemetry, or usage data
- We do not sell or share your data with anyone
- We do not operate servers that receive your data
- We do not track your browsing activity

## API Keys

Your Canvas API token, OpenAI key, and Anthropic key are stored in Chrome's encrypted extension storage and transmitted directly to their respective APIs over HTTPS. They never pass through our servers.

## Data Retention

All data is stored locally and deleted when you uninstall the extension or clear extension data. You can also reset all data from the extension's options page.

## Contact

For privacy concerns, please open an issue on our GitHub repository or contact us at the email listed on the Chrome Web Store listing.
