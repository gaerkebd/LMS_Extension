# Canvas LMS Time Estimator

A Chrome extension that integrates with Canvas LMS to display AI-powered time estimates for your assignments. See your weekly workload at a glance and plan your study time effectively.

## Features

- **To-Do Integration**: Automatically fetches your Canvas assignments and to-do items
- **AI Time Estimation**: Uses OpenAI or Anthropic to intelligently estimate assignment completion times
- **Weekly Summary**: View total assignments and estimated hours for the week
- **In-Page Badges**: Time estimates appear directly on Canvas assignment pages
- **Smart Notifications**: Get notified about urgent assignments due within 24 hours
- **Heuristic Fallback**: Works without AI using smart estimation rules

## Project Structure

```
LMS_Extension/
├── manifest.json           # Chrome extension manifest (v3)
├── package.json            # Node.js dependencies and scripts
├── README.md               # This file
├── .gitignore              # Git ignore rules
├── .eslintrc.json          # ESLint configuration
├── assets/
│   └── icons/              # Extension icons (16, 48, 128px)
└── src/
    ├── background/
    │   └── service-worker.js   # Background tasks and message handling
    ├── content/
    │   ├── content-script.js   # Injects badges into Canvas pages
    │   └── content-styles.css  # Styles for injected elements
    ├── options/
    │   ├── options.html        # Settings page
    │   ├── options.css         # Settings styles
    │   └── options.js          # Settings logic
    ├── popup/
    │   ├── popup.html          # Main popup interface
    │   ├── popup.css           # Popup styles
    │   └── popup.js            # Popup logic
    ├── services/
    │   ├── canvas-api.js       # Canvas LMS API wrapper
    │   └── time-estimator.js   # AI time estimation service
    └── utils/
        └── helpers.js          # Shared utility functions
```

## Installation

### For Development

1. Clone this repository:
   ```bash
   git clone <your-repo-url>
   cd LMS_Extension
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create placeholder icons (or add your own):
   - Create `assets/icons/` directory
   - Add `icon16.png`, `icon48.png`, and `icon128.png`

4. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `LMS_Extension` folder

### For Production

1. Build the extension:
   ```bash
   npm run build
   ```

2. Create a zip for Chrome Web Store:
   ```bash
   npm run zip
   ```

## Configuration

### Canvas API Token

1. Log in to your Canvas account
2. Go to **Account** → **Settings**
3. Scroll to **Approved Integrations**
4. Click **+ New Access Token**
5. Enter a purpose (e.g., "Time Estimator Extension")
6. Copy the generated token
7. Paste it in the extension settings

### AI Provider (Optional)

For more accurate time estimates, configure an AI provider:

**OpenAI:**
1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Select "OpenAI" as provider in extension settings
3. Enter your API key

**Anthropic:**
1. Get an API key from [Anthropic Console](https://console.anthropic.com/)
2. Select "Anthropic" as provider in extension settings
3. Enter your API key

## How It Works

### Time Estimation

The extension estimates assignment time using:

1. **AI Analysis** (if configured): Sends assignment details to an AI model that considers:
   - Assignment type (quiz, essay, project, etc.)
   - Point value and complexity
   - Submission requirements
   - Description content

2. **Heuristic Rules** (fallback): Uses built-in rules based on:
   - Base time for assignment type
   - Points-based multiplier
   - Submission type adjustments

### Default Time Estimates

| Assignment Type | Base Time | Per Point |
|-----------------|-----------|-----------|
| Quiz            | 30 min    | +1 min    |
| Discussion      | 45 min    | +2 min    |
| Assignment      | 60 min    | +3 min    |
| Essay           | 120 min   | +5 min    |
| Project         | 180 min   | +8 min    |
| Exam            | 90 min    | +2 min    |
| Reading         | 30 min    | +1 min    |

## API Reference

### Canvas API

The extension uses these Canvas API endpoints:

- `GET /api/v1/users/self` - Test connection
- `GET /api/v1/planner/items` - Fetch to-do items
- `GET /api/v1/courses` - List enrolled courses
- `GET /api/v1/courses/:id/assignments` - Course assignments

### Message Types

The service worker handles these message types:

- `GET_ASSIGNMENTS` - Get assignments (cached or fresh)
- `REFRESH_ASSIGNMENTS` - Force refresh from Canvas
- `GET_CACHED_ASSIGNMENTS` - Get cached data only
- `ESTIMATE_SINGLE` - Estimate time for one assignment
- `TEST_CONNECTION` - Test Canvas API connection

## Development

### Available Scripts

```bash
npm run dev      # Watch mode for development
npm run build    # Build for production
npm run lint     # Run ESLint
npm run lint:fix # Fix ESLint errors
npm run test     # Run tests
npm run zip      # Create distribution zip
```

### Adding Features

1. **New API endpoints**: Extend `src/services/canvas-api.js`
2. **UI changes**: Modify popup or options files
3. **Estimation logic**: Update `src/services/time-estimator.js`
4. **Canvas integration**: Edit `src/content/content-script.js`

## Privacy & Security

- **No data collection**: All data stays on your device
- **Secure storage**: API tokens stored in Chrome's encrypted sync storage
- **Minimal permissions**: Only requests necessary Canvas access
- **No tracking**: No analytics or telemetry

## Troubleshooting

### "Connection failed" error
- Verify your Canvas URL format (include https://)
- Check that your API token is valid and not expired
- Ensure you're logged into Canvas in the same browser

### No assignments showing
- Make sure you have upcoming assignments in Canvas
- Check that courses are active (not past enrollment)
- Try clicking the refresh button

### Time estimates not appearing on Canvas
- Reload the Canvas page after installing
- Check browser console for errors
- Verify the extension has permissions for your Canvas domain

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linting: `npm run lint`
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Canvas LMS API documentation
- OpenAI and Anthropic for AI capabilities
- Chrome Extensions documentation
