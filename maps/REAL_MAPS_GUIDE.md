# Using Real Maps for the Wargame

## Why Real Maps Are Better

Real geographic maps with actual provincial boundaries provide:
- **Authenticity**: Players recognize real locations
- **Educational value**: Learn actual geography while playing
- **Strategic realism**: Real terrain and adjacency relationships
- **Engagement**: More immersive than abstract generated maps

---

## Conversion Process

### Step 1: Prepare Your SVG Map

Your SVG map should have:
- **Individual provinces as separate elements** (`<path>`, `<polygon>`, or `<g>` groups)
- **Identifiable provinces** via `id`, `title`, or `class` attributes
- **Any province count** (not limited to specific numbers)

**Example structure (Iraq map):**
```svg
<path d="..." title="Babil" id="IQ-BB" />
<path d="..." title="Al-Anbar" id="IQ-AN" />
...
```

### Step 2: Install Dependencies

```bash
pip install shapely lxml --break-system-packages
```

### Step 3: Run Converter

**Basic usage:**
```bash
python svg_to_template.py iraq.svg
```

**Specify output file:**
```bash
python svg_to_template.py iraq.svg iraq-template.json
```

**Specify coastal provinces (non-interactive):**
```bash
python svg_to_template.py iraq.svg --coastal "Al-Basrah, Maysan"
```

**Adjust simplification tolerance:**
```bash
python svg_to_template.py iraq.svg --tolerance 3  # More detail
python svg_to_template.py iraq.svg --tolerance 8  # More simplified
```

---

## Iraq Example Results

### Conversion Summary

```
Input:  iraq.svg
Output: iraq.json
Provinces: 18
Coastal: 1 (Al-Basrah)
Avg coordinates/province: 15
Avg neighbors/province: 3.7
File size: 5.6 KB
```

### Province Mapping

| ID | Province Name | Neighbors |
|----|---------------|-----------|
| A | Babil | B, E, H |
| B | Al-Anbar | A, K, L, M, N, O |
| C | Diyala | D, E, K, N |
| D | As-Sulaymaniyah | C, P, Q |
| E | Wasit | A, C, F, G, H, K |
| F | Maysan | E, G, J |
| G | Dhi-Qar | E, F, H, I, J |
| H | Al-Qadisiyah | A, E, G, L, M |
| I | Al-Muthannia | G, J, M |
| J | Al-Basrah [COASTAL] | F, G, I |
| K | Baghdad | B, C, E, N |
| L | Karbala | B, H, M, N |
| M | An-Najaf | B, H, I, L |
| N | Sala ad-Din | B, C, K, L, O, Q |
| O | Ninawa | B, N, P, Q, R |
| P | Arbil | D, O, Q, R |
| Q | Kirkuk | C, D, N, O, P |
| R | Dohuk | O, P |

---

## Interactive Coastal Selection

If you don't specify `--coastal`, the script will prompt you:

```
COASTAL PROVINCE SELECTION
======================================================================

Available provinces:
   1. Babil
   2. Al-Anbar
   3. Diyala
   ...
  10. Al-Basrah
   ...

Enter the numbers of coastal provinces (comma-separated):
Example: 1,5,12
Or type province names (comma-separated):
Example: Al-Basrah, Maysan

Coastal provinces: 10
```

---

## Customization Options

### Tolerance (Coordinate Simplification)

Controls how aggressively coordinates are simplified:

- **Low (2-4):** Maximum detail, larger file size, slower rendering
- **Medium (5-7):** Balanced detail and performance **[RECOMMENDED]**
- **High (8-12):** Minimal detail, smallest file size, fastest rendering

**When to adjust:**
- Provinces look too jagged → Lower tolerance (e.g., `--tolerance 3`)
- File too large or rendering slow → Higher tolerance (e.g., `--tolerance 8`)

### Multiple Coastal Provinces

Some countries have multiple coastal regions:

```bash
# Yemen example (Red Sea and Arabian Sea coasts)
python svg_to_template.py yemen.svg --coastal "Aden, Hadramaut, Al Hudaydah"

# Syria example (Mediterranean coast)
python svg_to_template.py syria.svg --coastal "Latakia, Tartus"
```

---

## Integration with Wargame Application

### Replace Generated Templates

1. Convert your map: `python svg_to_template.py iraq.svg`
2. Place output in `maps/` directory
3. Update template selection in application to show real map names

### Application Changes Required

**Setup Phase - Template Selection:**

Instead of showing:
- "6 Province Template"
- "8 Province Template"
- etc.

Show:
- "Iraq (18 Provinces)"
- "Syria (14 Provinces)"
- etc.

**Minor code adjustment needed in `app.js`:**

```javascript
// Load template
fetch(`maps/iraq.json`)
  .then(response => response.json())
  .then(data => {
    // Use data.name for display
    console.log(data.name); // "Iraq Map (18 Provinces)"
  });
```

### Province Names in UI

Each province has both ID and title:
- **ID:** Used internally (A, B, C...)
- **Title:** Original province name for display

**Display in tooltips/panels:**
```javascript
// Show: "Province J (Al-Basrah)"
const displayName = `Province ${province.id} (${province.title})`;
```

This helps users recognize real locations while maintaining clean internal logic.

---

## Advanced: Batch Conversion

Convert multiple maps at once:

```bash
#!/bin/bash
# batch_convert.sh

for svg in maps/*.svg; do
    echo "Converting $svg..."
    python svg_to_template.py "$svg" --tolerance 5 --no-interactive
done
```

Save as `batch_convert.sh`, make executable, and run:
```bash
chmod +x batch_convert.sh
./batch_convert.sh
```

---

## Troubleshooting

### "No provinces extracted"

**Problem:** SVG structure not recognized

**Solutions:**
1. Check that provinces are `<path>` or `<polygon>` elements
2. Verify elements have valid `d` attribute (for paths)
3. Try opening SVG in Inkscape to validate structure

### "Coordinate parsing failed"

**Problem:** Complex SVG path commands not supported

**Solutions:**
1. Open SVG in Inkscape
2. Select all provinces: `Edit → Select All`
3. Simplify paths: `Path → Simplify` (Ctrl+L)
4. Convert curves to lines: `Path → Object to Path`
5. Save and retry conversion

### "Province polygons invalid"

**Problem:** Self-intersecting or malformed polygons

**Solutions:**
1. Open in Inkscape
2. Select problematic provinces
3. Use `Path → Union` to merge overlapping areas
4. Use `Path → Break Apart` then `Path → Union` to fix topology
5. Save and retry

### Provinces don't touch but should be neighbors

**Problem:** Small gaps between provinces in SVG

**Solutions:**
- Lower simplification tolerance: `--tolerance 3`
- Or manually edit JSON after conversion to add missing neighbors

---

## Recommended Maps for Wargaming

### Middle East / North Africa
- **Iraq** ✓ (already converted)
- **Syria** - 14 provinces
- **Yemen** - 22 provinces
- **Libya** - 22 districts
- **Afghanistan** - 34 provinces

### Sub-Saharan Africa
- **Somalia** - 18 regions
- **Mali** - 10 regions
- **Niger** - 8 regions
- **Nigeria** - 36 states

### South Asia
- **Pakistan** - 4 provinces + territories
- **Bangladesh** - 8 divisions

### Sources for SVG Maps

1. **Wikimedia Commons**: Search "[country name] blank map svg"
2. **MapSVG.com**: Free SVG maps of many countries
3. **D3.js examples**: TopoJSON files (can be converted to SVG)

**Quality criteria:**
- Provinces as separate paths (not groups)
- Clean, simplified boundaries
- Proper attribution/licensing

---

## Files Included

**[svg_to_template.py](computer:///mnt/user-data/outputs/svg_to_template.py)** - Converter script
**[iraq.json](computer:///mnt/user-data/outputs/iraq.json)** - Converted Iraq template (18 provinces)

---

## Next Steps

1. **Convert your maps** using the provided script
2. **Test in application** by placing JSON in `maps/` directory
3. **Verify rendering** - provinces should display smoothly
4. **Check adjacency** - neighbors should be logically connected
5. **Deploy** - real maps ready for educational wargaming

Real maps transform the wargame from abstract exercise to geopolitically grounded simulation.
