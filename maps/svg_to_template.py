#!/usr/bin/env python3
"""
Real Map SVG to Wargame JSON Converter

Converts real geographic SVG maps into the wargame template format.
Handles province extraction, coordinate simplification, centroid calculation,
and adjacency detection.

Usage:
    python svg_to_template.py input.svg output.json [--coastal PROVINCE_NAMES]

Requirements:
    pip install shapely lxml --break-system-packages
"""

import json
import sys
import re
from pathlib import Path
from typing import List, Dict, Tuple, Set
import argparse

try:
    from shapely.geometry import Polygon, MultiPolygon, Point
    from shapely.ops import unary_union
    from shapely.errors import TopologicalError
except ImportError:
    print("ERROR: shapely library not found.")
    print("Install with: pip install shapely --break-system-packages")
    sys.exit(1)

try:
    from lxml import etree
except ImportError:
    print("ERROR: lxml library not found.")
    print("Install with: pip install lxml --break-system-packages")
    sys.exit(1)


def parse_svg_path_to_coords(path_data: str) -> List[Tuple[float, float]]:
    """
    Parse SVG path data to extract coordinates.
    Simplified parser for basic path commands (M, L, Z, with absolute coords).
    """
    # Remove extra whitespace
    path_data = re.sub(r'\s+', ' ', path_data.strip())
    
    coords = []
    current_x, current_y = 0, 0
    
    # Split into commands
    # Match command letter followed by number sequences
    commands = re.findall(r'([MLZmlz])\s*([\d\s,.-]+)?', path_data)
    
    for cmd, args in commands:
        if not args:
            if cmd.upper() == 'Z':
                continue
        else:
            # Parse numbers
            numbers = [float(x) for x in re.findall(r'-?\d+\.?\d*', args)]
            
            if cmd == 'M':  # Move to (absolute)
                current_x, current_y = numbers[0], numbers[1]
                coords.append((current_x, current_y))
                # Additional coordinate pairs are treated as line-to
                for i in range(2, len(numbers), 2):
                    current_x, current_y = numbers[i], numbers[i+1]
                    coords.append((current_x, current_y))
                    
            elif cmd == 'm':  # Move to (relative)
                current_x += numbers[0]
                current_y += numbers[1]
                coords.append((current_x, current_y))
                for i in range(2, len(numbers), 2):
                    current_x += numbers[i]
                    current_y += numbers[i+1]
                    coords.append((current_x, current_y))
                    
            elif cmd == 'L':  # Line to (absolute)
                for i in range(0, len(numbers), 2):
                    current_x, current_y = numbers[i], numbers[i+1]
                    coords.append((current_x, current_y))
                    
            elif cmd == 'l':  # Line to (relative)
                for i in range(0, len(numbers), 2):
                    current_x += numbers[i]
                    current_y += numbers[i+1]
                    coords.append((current_x, current_y))
    
    return coords


def simplify_coords(coords: List[Tuple[float, float]], tolerance: float) -> List[List[int]]:
    """Simplify coordinates using Ramer-Douglas-Peucker algorithm."""
    if len(coords) < 4:
        return [[round(x), round(y)] for x, y in coords]
    
    try:
        poly = Polygon(coords)
        simplified = poly.simplify(tolerance, preserve_topology=True)
        
        # Ensure minimum coordinate count
        if len(simplified.exterior.coords) < 6:
            simplified = poly.simplify(tolerance * 0.5, preserve_topology=True)
        
        # Convert to integer coordinates
        return [[round(x), round(y)] for x, y in list(simplified.exterior.coords)[:-1]]
    except Exception as e:
        print(f"    Warning: Simplification failed, using original coords: {e}")
        return [[round(x), round(y)] for x, y in coords]


def calculate_centroid(coords: List[List[int]]) -> List[int]:
    """Calculate geometric centroid of polygon."""
    try:
        poly = Polygon(coords)
        centroid = poly.centroid
        return [round(centroid.x), round(centroid.y)]
    except:
        # Fallback: simple average
        x_avg = sum(c[0] for c in coords) / len(coords)
        y_avg = sum(c[1] for c in coords) / len(coords)
        return [round(x_avg), round(y_avg)]


def detect_neighbors(provinces: List[Dict]) -> Dict[str, List[str]]:
    """
    Detect which provinces are adjacent by checking if their polygons touch.
    """
    neighbors = {p['id']: [] for p in provinces}
    
    # Create polygons for each province
    polygons = {}
    for province in provinces:
        try:
            poly = Polygon(province['coordinates'])
            if poly.is_valid:
                polygons[province['id']] = poly
            else:
                # Try to fix invalid polygons
                poly = poly.buffer(0)
                polygons[province['id']] = poly
        except Exception as e:
            print(f"    Warning: Could not create polygon for {province['id']}: {e}")
            continue
    
    # Check adjacency
    province_ids = list(polygons.keys())
    for i, id1 in enumerate(province_ids):
        for id2 in province_ids[i+1:]:
            poly1 = polygons[id1]
            poly2 = polygons[id2]
            
            # Check if they touch (share a border)
            try:
                if poly1.touches(poly2) or poly1.intersects(poly2):
                    # Verify they actually share a meaningful border
                    intersection = poly1.intersection(poly2)
                    if intersection.length > 1:  # Share more than a point
                        neighbors[id1].append(id2)
                        neighbors[id2].append(id1)
            except Exception as e:
                continue
    
    return neighbors


def extract_provinces_from_svg(svg_path: Path, tolerance: float = 5.0) -> Tuple[Dict, List[Dict]]:
    """
    Extract province data from SVG file.
    
    Returns:
        (svg_metadata, provinces_list)
    """
    print(f"Parsing SVG: {svg_path.name}")
    
    # Parse SVG
    tree = etree.parse(str(svg_path))
    root = tree.getroot()
    
    # Get viewBox or calculate from width/height
    viewBox = root.get('viewBox')
    if not viewBox:
        width = float(root.get('width', 800))
        height = float(root.get('height', 600))
        viewBox = f"0 0 {int(width)} {int(height)}"
    
    print(f"ViewBox: {viewBox}")
    
    # Find all path elements
    # Handle different namespace possibilities
    paths = root.findall('.//{http://www.w3.org/2000/svg}path')
    if not paths:
        paths = root.findall('.//path')
    
    print(f"Found {len(paths)} provinces")
    
    provinces = []
    
    for idx, path in enumerate(paths):
        # Get province name
        title = path.get('title', f'Province_{idx+1}')
        province_id = path.get('id', f'p{idx}')
        
        # Get path data
        path_data = path.get('d')
        if not path_data:
            print(f"  Skipping {title}: no path data")
            continue
        
        # Parse coordinates
        try:
            raw_coords = parse_svg_path_to_coords(path_data)
            if len(raw_coords) < 3:
                print(f"  Skipping {title}: too few coordinates")
                continue
            
            # Simplify
            coords = simplify_coords(raw_coords, tolerance)
            
            # Calculate centroid
            centroid = calculate_centroid(coords)
            
            print(f"  {title}: {len(raw_coords)} → {len(coords)} coords")
            
            provinces.append({
                'original_title': title,
                'original_id': province_id,
                'coordinates': coords,
                'centroid': centroid,
                'isCoastal': False  # Will be set later
            })
            
        except Exception as e:
            print(f"  Error processing {title}: {e}")
            continue
    
    metadata = {
        'viewBox': viewBox,
        'original_province_count': len(provinces)
    }
    
    return metadata, provinces


def assign_province_ids(provinces: List[Dict]) -> List[Dict]:
    """Assign alphabetical IDs (A, B, C...) to provinces."""
    for idx, province in enumerate(provinces):
        province['id'] = chr(65 + idx)  # A, B, C...
    return provinces


def mark_coastal_provinces(provinces: List[Dict], coastal_names: List[str]) -> List[Dict]:
    """Mark specified provinces as coastal."""
    coastal_names_lower = [name.lower().strip() for name in coastal_names]
    
    for province in provinces:
        title_lower = province['original_title'].lower()
        if any(coastal in title_lower for coastal in coastal_names_lower):
            province['isCoastal'] = True
            print(f"  Marked {province['original_title']} as coastal")
    
    return provinces


def create_template_json(metadata: Dict, provinces: List[Dict], output_name: str) -> Dict:
    """Create final JSON template structure."""
    
    # Detect neighbors
    print("\nDetecting province adjacency...")
    neighbors = detect_neighbors(provinces)
    
    # Add neighbor data to provinces
    for province in provinces:
        province['neighbors'] = sorted(neighbors.get(province['id'], []))
    
    # Create template structure
    template = {
        'id': f"template-{output_name}",
        'name': f"{output_name.title()} Map ({len(provinces)} Provinces)",
        'provinceCount': len(provinces),
        'viewBox': metadata['viewBox'],
        'provinces': []
    }
    
    # Add provinces in clean format
    for province in provinces:
        template['provinces'].append({
            'id': province['id'],
            'title': province['original_title'],  # Include original name for reference
            'coordinates': province['coordinates'],
            'centroid': province['centroid'],
            'isCoastal': province['isCoastal'],
            'neighbors': province['neighbors']
        })
    
    return template


def interactive_coastal_selection(provinces: List[Dict]) -> List[str]:
    """Let user interactively select coastal provinces."""
    print("\n" + "="*70)
    print("COASTAL PROVINCE SELECTION")
    print("="*70)
    print("\nAvailable provinces:")
    for idx, province in enumerate(provinces, 1):
        print(f"  {idx:2d}. {province['original_title']}")
    
    print("\nEnter the numbers of coastal provinces (comma-separated):")
    print("Example: 1,5,12")
    print("Or type province names (comma-separated):")
    print("Example: Al-Basrah, Maysan")
    
    while True:
        user_input = input("\nCoastal provinces: ").strip()
        
        if not user_input:
            print("No coastal provinces specified. Continuing...")
            return []
        
        # Try parsing as numbers first
        if re.match(r'^[\d,\s]+$', user_input):
            try:
                indices = [int(x.strip()) - 1 for x in user_input.split(',')]
                coastal_names = [provinces[i]['original_title'] for i in indices if 0 <= i < len(provinces)]
                return coastal_names
            except (ValueError, IndexError) as e:
                print(f"Invalid input: {e}. Please try again.")
        else:
            # Treat as province names
            return [name.strip() for name in user_input.split(',')]


def main():
    parser = argparse.ArgumentParser(
        description='Convert real geographic SVG maps to wargame JSON templates',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('input', type=str, help='Input SVG file')
    parser.add_argument('output', type=str, nargs='?', help='Output JSON file (default: derived from input)')
    parser.add_argument('--coastal', type=str, help='Comma-separated list of coastal province names')
    parser.add_argument('--tolerance', type=float, default=5.0, help='Simplification tolerance (default: 5.0)')
    parser.add_argument('--no-interactive', action='store_true', help='Skip interactive coastal selection')
    
    args = parser.parse_args()
    
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"ERROR: Input file not found: {input_path}")
        sys.exit(1)
    
    # Determine output path
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = input_path.with_suffix('.json')
    
    # Extract provinces
    metadata, provinces = extract_provinces_from_svg(input_path, args.tolerance)
    
    if not provinces:
        print("ERROR: No provinces extracted from SVG")
        sys.exit(1)
    
    # Assign IDs
    provinces = assign_province_ids(provinces)
    
    # Handle coastal provinces
    coastal_names = []
    if args.coastal:
        coastal_names = [name.strip() for name in args.coastal.split(',')]
    elif not args.no_interactive:
        coastal_names = interactive_coastal_selection(provinces)
    
    if coastal_names:
        provinces = mark_coastal_provinces(provinces, coastal_names)
    
    # Check coastal count
    coastal_count = sum(1 for p in provinces if p['isCoastal'])
    if coastal_count == 0:
        print("\nWARNING: No coastal provinces marked. At least one recommended for game mechanics.")
    
    # Create template
    output_name = input_path.stem
    template = create_template_json(metadata, provinces, output_name)
    
    # Save
    with open(output_path, 'w') as f:
        json.dump(template, f, indent=2)
    
    print("\n" + "="*70)
    print("CONVERSION COMPLETE")
    print("="*70)
    print(f"Input:  {input_path}")
    print(f"Output: {output_path}")
    print(f"Provinces: {len(provinces)}")
    print(f"Coastal: {coastal_count}")
    print(f"Avg coordinates/province: {sum(len(p['coordinates']) for p in provinces) / len(provinces):.0f}")
    print(f"Avg neighbors/province: {sum(len(p['neighbors']) for p in template['provinces']) / len(provinces):.1f}")
    
    # Show mapping table
    print("\nProvince ID Mapping:")
    print("-" * 50)
    for province in template['provinces']:
        coastal_marker = " [COASTAL]" if province['isCoastal'] else ""
        print(f"  {province['id']:2s} → {province['title']}{coastal_marker}")


if __name__ == '__main__':
    main()
