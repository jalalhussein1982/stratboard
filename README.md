# Insurgency Wargame Application

A web-based tool for moderating two-faction insurgency wargames. This application helps game moderators manage conflicts between a Government (Blue) faction and a Jihadist (Red) faction through an interactive map interface.

## Table of Contents

- [Overview](#overview)
- [Deployment](#deployment)
- [Getting Started](#getting-started)
- [Setup Phase](#setup-phase)
- [Play Phase](#play-phase)
- [Features](#features)
- [Adding Custom Maps](#adding-custom-maps)
- [Browser Support](#browser-support)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Insurgency Wargame Application is a static web application designed for tabletop-style wargame moderation. Teams communicate their actions verbally while the moderator uses this interface to:

- Track territorial control
- Manage faction forces
- Log game actions and outcomes
- Visualize the strategic situation

**No backend required** - the application runs entirely in the browser.

---

## Deployment

### Requirements

- Any web server (Apache, Nginx, IIS, etc.)
- FTP access or file upload capability
- No database or server-side scripting needed

### Installation

1. Upload all files to your web server maintaining the folder structure:

```
your-website/
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── assets/
│   └── icons/
│       └── (SVG icon files)
└── maps/
    ├── manifest.json
    └── (your map JSON files)
```

2. Navigate to `index.html` in your browser
3. The application is ready to use

---

## Getting Started

When you first open the application, you'll enter the **Setup Phase** to configure your game. You can also **Load a Saved Game** to continue a previous session. After setup is complete, you'll transition to the **Play Phase** where the actual game is managed.

---

## Setup Phase

### Step 1: Select Map Template or Load Saved Game

Choose from 9 available map templates based on the number of provinces you want in your game:

| Template | Provinces |
|----------|-----------|
| Map 1 | 5 provinces |
| Map 2 | 10 provinces |
| Map 3 | 4 provinces |
| Map 4 | 4 provinces |
| Map 5 | 9 provinces |
| Map 6 | 11 provinces |
| Map 7 | 11 provinces |
| Map 8 | 13 provinces |
| Map 9 | 9 provinces |

Click on a template card to select it. You can use the **Back to Templates** button later if you want to change your selection.

**Load Saved Game**: Click the "Load Saved Game" button to import a previously exported game. This will restore all game data including the map, province configurations, force levels, action log, and game progress, jumping directly to the play phase.

### Step 2: Designate Capital

Click on any province on the map to designate it as the capital city. The capital:

- Automatically starts under Government control
- Is marked with a gold star icon
- Cannot be assigned to the Jihadist faction during setup

Click **Confirm Capital** to proceed.

### Step 3: Province Configuration

Configure each province in alphabetical order (A, B, C, etc.). Provinces are labeled generically as "Country 1", "Country 2", etc. For each province, set:

**Control** (required for non-capital provinces)
- Government (Blue)
- Jihadist (Red)

**Population Density**
- High
- Moderate
- Sparse

**Sentiment** (-100 to +100)
- Negative values = Pro-Jihadist sentiment
- Zero = Neutral
- Positive values = Pro-Government sentiment

**Terrain** (required)
- Mountains
- Forest
- Plain

**Resources** (optional, select any that apply)
- Oil/Gas Fields
- Water Sources
- Border Crossing
- Seaport/Airport
- Major Highway
- Urban Center
- Religious/Cultural Site
- Agricultural Land
- Mining Operations
- Telecommunications Hub

Use **Previous** and **Next Province** buttons to navigate. The current province is highlighted with a pulsing gold border on the map.

### Step 4: Initial Force Levels

Set the starting force levels for each faction:

- **Government Forces**: Total military units available
- **Jihadist Forces**: Total insurgent units available

Click **Start Game** to begin the play phase.

---

## Play Phase

### Interface Layout

The play phase interface consists of:

- **Header Bar**: Shows current turn, active faction, and game controls
- **Left Sidebar**: Forces panel and action log
- **Center**: Interactive map
- **Right Sidebar**: Province details and quick actions

### Map Interaction

**Hovering** over a province displays a tooltip showing:
- Control status
- Population density
- Sentiment value
- Terrain type
- Resources
- Active status flags

**Clicking** a province opens the Province Details panel where you can:
- Change control (Government/Jihadist)
- Adjust sentiment
- Toggle status flags (Under Siege, Blockaded, Contested)

### Map Icons

| Icon | Meaning |
|------|---------|
| Gold Star | Capital city |
| Anchor | Coastal province |
| Mountain | Mountain terrain |
| Tree | Forest terrain |
| Lines | Plain terrain |

### Managing Forces

The Forces panel shows current troop levels for both factions. Click the **+** or **-** buttons to adjust:

1. Enter the adjustment amount (positive or negative)
2. Add a description for the change
3. Click **Confirm**

Force adjustments are automatically logged.

### Action Log

The Action Log records all significant game events. To add an entry:

1. Click **+ Add Log Entry**
2. Select the acting faction
3. Choose a category:
   - Military
   - Propaganda
   - Economic
   - Diplomatic
   - Recruitment
   - Other
4. Select the outcome (Success/Partial/Failure)
5. Check affected provinces
6. Enter a description
7. Optionally add force adjustments
8. Click **Create Entry**

Log entries are displayed with color-coded faction indicators and outcome badges.

### Turn Management

Click **END TURN** to:
- Increment the turn counter
- Switch the active faction (Government ↔ Jihadist)
- Update the turn history display

The turn indicator in the header shows the current turn number and active faction.

### Game Controls

**Export**: Save the current game state as a JSON file. Use this to:
- Backup your game
- Continue later
- Share with others

**Import**: Load a previously saved game state. Select a JSON file exported from this application.

**New Game**: Start over with a fresh setup. You'll be prompted to export first to avoid losing progress.

---

## Features

### Save and Load Games

The application supports full game state persistence:

- **Export**: Download the complete game state as a JSON file at any time during play
- **Load Saved Game**: From the setup screen, load a previously exported game to continue where you left off
- **Import**: During play, import a saved game (with confirmation to avoid accidental overwrites)

The saved file includes:
- Selected map and all province configurations
- Current turn number and active faction
- Force levels for both factions
- Complete action log history
- Turn history

### Province Status Flags

Toggle these flags to track special conditions:

- **Under Siege**: Province is currently under military siege
- **Blockaded**: Supply lines are cut off
- **Contested**: Active fighting for control

### Coastal Provinces

Provinces marked as coastal (anchor icon) represent territories with sea access, which may be strategically significant for naval operations or supply routes.

**Note**: Game state is not automatically saved. Export regularly to preserve your progress.

---

## Adding Custom Maps

You can add your own map files to the application. Maps are loaded dynamically from the `maps/` folder.

### Step 1: Create Your Map JSON File

Create a JSON file with the following structure:

```json
{
  "id": "my-custom-map",
  "name": "My Custom Map (6 Provinces)",
  "provinceCount": 6,
  "viewBox": "0 0 800 600",
  "provinces": [
    {
      "id": "A",
      "title": "Country 1",
      "coordinates": [[x1, y1], [x2, y2], ...],
      "centroid": [cx, cy],
      "isCoastal": true,
      "neighbors": ["B", "C"]
    },
    ...
  ]
}
```

**Field Descriptions:**

| Field | Description |
|-------|-------------|
| `id` | Unique identifier for the map |
| `name` | Display name shown in template selection |
| `provinceCount` | Number of provinces (optional, auto-calculated if missing) |
| `viewBox` | SVG viewBox dimensions (e.g., "0 0 800 600") |
| `provinces` | Array of province objects |
| `provinces[].id` | Province letter identifier (A, B, C...) |
| `provinces[].title` | Display name for the province (e.g., "Country 1") |
| `provinces[].coordinates` | Array of [x, y] points forming the province polygon |
| `provinces[].centroid` | [x, y] position for the province label |
| `provinces[].isCoastal` | Boolean - true if province has sea access |
| `provinces[].neighbors` | Array of adjacent province IDs |

### Step 2: Upload the Map File

Upload your JSON file to the `maps/` folder on your web server.

### Step 3: Update the Manifest

Edit `maps/manifest.json` to include your new map file:

```json
{
  "maps": [
    "map-1.json",
    "map-2.json",
    "my-custom-map.json"
  ]
}
```

The application will automatically load all maps listed in the manifest. Maps appear in the order listed.

### Tips for Creating Maps

- Use an SVG editor to design your map, then extract coordinates
- Province coordinates should form closed polygons
- Centroid should be roughly in the center of each province
- ViewBox should encompass all province coordinates with some padding
- Use generic names like "Country 1", "Country 2" for provinces
- Test your map by loading it in the application

---

## Browser Support

The application is tested and supported on:

- Google Chrome (recommended)
- Mozilla Firefox
- Microsoft Edge

**Minimum screen width**: 1024px

On smaller screens, a warning message will be displayed asking you to use a larger display.

---

## Tips for Moderators

1. **Export frequently** - Save your game state after major events
2. **Use the log** - Document all faction actions for reference
3. **Status flags** - Keep these updated to reflect the tactical situation
4. **Sentiment tracking** - Adjust sentiment values as factions win hearts and minds
5. **Force adjustments** - Always add descriptions to track why forces changed
6. **Load Saved Game** - Use this feature to continue games across sessions

---

## Troubleshooting

**Map templates not loading?**
- Check that `maps/manifest.json` exists and lists your map files
- Ensure map JSON files are in the `maps/` folder
- Verify filenames in manifest.json match actual file names exactly
- Check browser console (F12) for errors
- Verify files are accessible on your web server

**No maps appearing in selection?**
- The manifest.json file may be missing or malformed
- Ensure manifest.json contains a valid `"maps"` array

**Tooltip appearing off-screen?**
- The tooltip automatically repositions to stay within the viewport
- Try moving your cursor closer to the center of the screen

**Can't scroll in setup panels?**
- Ensure your browser window is at least 1024px wide
- Try refreshing the page

**Import/Load not working?**
- Verify the file is a valid JSON export from this application
- Check that the file hasn't been corrupted or modified
- Ensure you're selecting a .json file

**Load Saved Game button not responding?**
- Check browser console for errors
- Ensure JavaScript is enabled in your browser

---

## Author

**Jalal Hussein**
Email: jalalhussein@gmail.com

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Credits

Built as a static web application using HTML, CSS, and JavaScript. No external frameworks required.
