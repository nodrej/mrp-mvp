import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal
import models
from collections import defaultdict

db = SessionLocal()

try:
    products = db.query(models.Product).filter(models.Product.is_active == True).all()

    print("="*80)
    print("PRODUCT ANALYSIS & ORGANIZATION OPPORTUNITIES")
    print("="*80)

    # Analyze by type
    print("\n1. PRODUCTS BY TYPE:")
    by_type = defaultdict(list)
    for p in products:
        by_type[p.type].append(p)

    for ptype, prods in sorted(by_type.items()):
        print(f"\n   {ptype.upper().replace('_', ' ')} ({len(prods)} items):")
        for p in sorted(prods, key=lambda x: x.code):
            print(f"      {p.code:20s} - {p.name}")

    # Analyze code patterns
    print("\n\n2. PRODUCT CODE PATTERNS:")
    code_prefixes = defaultdict(list)
    for p in products:
        if '-' in p.code:
            prefix = p.code.split('-')[0]
            code_prefixes[prefix].append(p)
        else:
            code_prefixes['OTHER'].append(p)

    for prefix, prods in sorted(code_prefixes.items()):
        print(f"\n   {prefix} family ({len(prods)} items):")
        for p in sorted(prods, key=lambda x: x.code):
            print(f"      {p.code:20s} - {p.name:50s} [{p.type}]")

    # Analyze categories based on naming
    print("\n\n3. FUNCTIONAL CATEGORIES (Based on names):")
    categories = {
        'Main Assemblies': [],
        'Trigger Bodies': [],
        'Hardware/Fasteners': [],
        'Springs': [],
        'Safety Components': [],
        'Other Components': []
    }

    for p in products:
        name_lower = p.name.lower()
        code_lower = p.code.lower()

        if p.type == 'finished_good':
            categories['Main Assemblies'].append(p)
        elif 'body' in name_lower or 'body' in code_lower:
            categories['Trigger Bodies'].append(p)
        elif 'spring' in name_lower or 'spr-' in code_lower:
            categories['Springs'].append(p)
        elif 'safe' in code_lower or 'safety' in name_lower:
            categories['Safety Components'].append(p)
        elif any(x in name_lower for x in ['screw', 'pin', 'axle', 'dowel', 'button', 'wrench', 'head']):
            categories['Hardware/Fasteners'].append(p)
        else:
            categories['Other Components'].append(p)

    for cat, prods in categories.items():
        if prods:
            print(f"\n   {cat} ({len(prods)} items):")
            for p in sorted(prods, key=lambda x: x.code):
                print(f"      {p.code:20s} - {p.name}")

    # Analyze lead times
    print("\n\n4. LEAD TIME ANALYSIS:")
    lead_times = defaultdict(list)
    for p in products:
        if p.lead_time_days:
            if p.lead_time_days <= 7:
                lead_times['Short (≤7 days)'].append(p)
            elif p.lead_time_days <= 30:
                lead_times['Medium (8-30 days)'].append(p)
            elif p.lead_time_days <= 60:
                lead_times['Long (31-60 days)'].append(p)
            else:
                lead_times['Very Long (>60 days)'].append(p)

    for lt_range, prods in sorted(lead_times.items()):
        print(f"\n   {lt_range}: {len(prods)} items")
        for p in sorted(prods, key=lambda x: (x.lead_time_days or 0, x.code)):
            print(f"      {p.code:20s} - {p.lead_time_days:3d} days - {p.name}")

    # Usage analysis (where used)
    print("\n\n5. COMPONENT USAGE ANALYSIS:")
    bom_lines = db.query(models.BOMLine).all()
    component_usage = defaultdict(list)

    for bom in bom_lines:
        component_usage[bom.component_product_id].append(bom.parent_product_id)

    # Components used in multiple products
    shared_components = [(pid, parents) for pid, parents in component_usage.items() if len(set(parents)) > 1]
    shared_components.sort(key=lambda x: len(set(x[1])), reverse=True)

    print(f"\n   Shared Components (used in multiple products):")
    for comp_id, parent_ids in shared_components[:15]:  # Top 15
        comp = db.query(models.Product).filter(models.Product.id == comp_id).first()
        unique_parents = set(parent_ids)
        print(f"      {comp.code:20s} - Used in {len(unique_parents)} products - {comp.name}")
        for pid in sorted(unique_parents):
            parent = db.query(models.Product).filter(models.Product.id == pid).first()
            print(f"         └─ {parent.code}")

    print("\n\n6. SUGGESTED IMPROVEMENTS:")
    print("""
   ✓ Add CATEGORY/FAMILY field:
     - Manufacturing: L3 parts, MR3 parts, FRT parts
     - Hardware: Fasteners, Springs, Pins
     - Safety: Safety bodies, selectors

   ✓ Add SUPPLIER field:
     - Track where components come from
     - Filter by supplier for PO management

   ✓ Add MATERIAL field:
     - Metal, Plastic, Spring Steel, etc.

   ✓ Add CRITICALITY flag:
     - Mark critical path components
     - Long lead time items
     - Single-source items

   ✓ Add TAGS (multi-select):
     - "long-lead", "single-source", "shared-component"
     - "precision-part", "high-volume", "custom"

   ✓ Enhanced filtering in UI:
     - Filter by product family (L3, MR3, FRT)
     - Filter by category (springs, hardware, bodies)
     - Filter by lead time range
     - Filter by usage (where used in BOMs)
     - Combined filters with AND/OR logic

   ✓ Grouping/Hierarchical view:
     - Group by category, then show products
     - Collapsible sections

   ✓ Better search:
     - Search across code, name, category, tags
     - Fuzzy matching
     - Search by partial codes
    """)

finally:
    db.close()
