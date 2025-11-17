from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date, timedelta
from decimal import Decimal

import models
import schemas
from database import get_db, init_db, engine
from mrp import MRPEngine

# Create FastAPI app
app = FastAPI(
    title="MRP System MVP",
    description="Multi-Product Material Requirements Planning System",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
def on_startup():
    init_db()
    print("Application started successfully!")

# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/")
def read_root():
    return {"message": "MRP System API", "version": "1.0.0", "status": "running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# ============================================================================
# PRODUCT ENDPOINTS
# ============================================================================

@app.get("/api/products", response_model=List[schemas.Product])
def get_products(
    skip: int = 0,
    limit: int = 100,
    search: str = None,
    type: str = None,
    db: Session = Depends(get_db)
):
    """Get list of products"""
    query = db.query(models.Product).filter(models.Product.is_active == True)

    if search:
        query = query.filter(
            (models.Product.code.ilike(f"%{search}%")) |
            (models.Product.name.ilike(f"%{search}%"))
        )

    if type:
        query = query.filter(models.Product.type == type)

    products = query.offset(skip).limit(limit).all()
    return products

@app.get("/api/products/{product_id}", response_model=schemas.Product)
def get_product(product_id: int, db: Session = Depends(get_db)):
    """Get single product"""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@app.post("/api/products", response_model=schemas.Product, status_code=status.HTTP_201_CREATED)
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db)):
    """Create new product"""
    # Check if code already exists
    existing = db.query(models.Product).filter(models.Product.code == product.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Product code already exists")

    db_product = models.Product(**product.dict())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)

    # Create inventory record
    inventory = models.Inventory(product_id=db_product.id, on_hand=0, allocated=0)
    db.add(inventory)
    db.commit()

    return db_product

@app.put("/api/products/{product_id}", response_model=schemas.Product)
def update_product(product_id: int, product: schemas.ProductUpdate, db: Session = Depends(get_db)):
    """Update product"""
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = product.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_product, field, value)

    db.commit()
    db.refresh(db_product)
    return db_product

@app.delete("/api/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """Delete product (soft delete)"""
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    db_product.is_active = False
    db.commit()
    return None

# ============================================================================
# BOM ENDPOINTS
# ============================================================================

@app.get("/api/products/{product_id}/bom", response_model=schemas.BOMWithComponents)
def get_bom(product_id: int, db: Session = Depends(get_db)):
    """Get BOM for a product"""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    bom_lines = db.query(models.BOMLine).filter(
        models.BOMLine.parent_product_id == product_id
    ).all()

    components = []
    for line in bom_lines:
        component = line.component_product
        components.append(schemas.BOMLine(
            id=line.id,
            parent_product_id=line.parent_product_id,
            component_product_id=line.component_product_id,
            quantity_per=line.quantity_per,
            component_code=component.code,
            component_name=component.name
        ))

    return schemas.BOMWithComponents(
        product_id=product.id,
        product_code=product.code,
        product_name=product.name,
        components=components
    )

@app.post("/api/products/{product_id}/bom")
def save_bom(product_id: int, bom_update: schemas.BOMUpdate, db: Session = Depends(get_db)):
    """Save BOM for a product (replaces existing)"""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Delete existing BOM lines
    db.query(models.BOMLine).filter(models.BOMLine.parent_product_id == product_id).delete()

    # Add new BOM lines
    for line in bom_update.components:
        db_bom_line = models.BOMLine(
            parent_product_id=product_id,
            component_product_id=line.component_product_id,
            quantity_per=line.quantity_per
        )
        db.add(db_bom_line)

    db.commit()
    return {"message": "BOM saved successfully"}

@app.delete("/api/bom/{bom_line_id}")
def delete_bom_line(bom_line_id: int, db: Session = Depends(get_db)):
    """Delete a single BOM line"""
    bom_line = db.query(models.BOMLine).filter(models.BOMLine.id == bom_line_id).first()
    if not bom_line:
        raise HTTPException(status_code=404, detail="BOM line not found")

    db.delete(bom_line)
    db.commit()
    return {"message": "BOM line deleted"}

# ============================================================================
# INVENTORY ENDPOINTS
# ============================================================================

@app.get("/api/inventory", response_model=List[schemas.Inventory])
def get_inventory(db: Session = Depends(get_db)):
    """Get all inventory balances for active products only"""
    inventories = db.query(models.Inventory).join(models.Product).filter(
        models.Product.is_active == True
    ).all()

    result = []
    for inv in inventories:
        result.append(schemas.Inventory(
            id=inv.id,
            product_id=inv.product_id,
            on_hand=inv.on_hand,
            allocated=inv.allocated,
            available=Decimal(str(inv.available)),
            last_updated=inv.last_updated,
            product_code=inv.product.code,
            product_name=inv.product.name,
            reorder_point=inv.product.reorder_point,
            reorder_qty=inv.product.reorder_qty,
            category=inv.product.category,
            supplier=inv.product.supplier,
            lead_time_days=inv.product.lead_time_days
        ))

    return result

@app.get("/api/inventory/pending")
def get_pending_inventory(db: Session = Depends(get_db)):
    """Get pending incoming inventory grouped by product"""
    pending_pos = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.status == 'pending'
    ).all()

    # Group by product
    pending_by_product = {}
    for po in pending_pos:
        if po.product_id not in pending_by_product:
            pending_by_product[po.product_id] = {
                "product_id": po.product_id,
                "product_code": po.product.code,
                "product_name": po.product.name,
                "total_pending": 0,
                "orders": []
            }

        pending_by_product[po.product_id]["total_pending"] += float(po.quantity)
        pending_by_product[po.product_id]["orders"].append({
            "po_number": po.po_number,
            "quantity": float(po.quantity),
            "expected_date": po.expected_date.isoformat(),
            "supplier": po.supplier
        })

    return {"pending_inventory": list(pending_by_product.values())}

@app.get("/api/inventory/dynamic-reorder-points")
def get_dynamic_reorder_points(db: Session = Depends(get_db)):
    """
    Calculate dynamic reorder points for all components based on 6-week lead time
    and weekly shipment goals from the Weekly Shipments tab.

    Formula: Reorder Point = (Average Weekly Usage × 6 weeks) + Safety Stock
    Where Average Weekly Usage is calculated from weekly shipment goals and BOM requirements
    """
    from collections import defaultdict

    # Get the next 6 weeks of weekly shipment goals
    today = date.today()
    current_week_start = today - timedelta(days=today.weekday())

    # Get next 6 weeks
    week_starts = []
    for i in range(6):
        week_start = current_week_start + timedelta(weeks=i)
        week_starts.append(week_start)

    # Get all weekly shipment goals for the next 6 weeks
    all_shipments = db.query(models.WeeklyShipment).filter(
        models.WeeklyShipment.week_start_date.in_(week_starts)
    ).all()

    # Group shipments by product_id
    shipments_by_product = defaultdict(list)
    for shipment in all_shipments:
        shipments_by_product[shipment.product_id].append(float(shipment.goal))

    # Get all BOM lines to understand component usage
    all_bom_lines = db.query(models.BOMLine).all()

    # Group BOM lines by component to see which products use each component
    component_usage = defaultdict(list)
    for bom_line in all_bom_lines:
        component_usage[bom_line.component_product_id].append({
            'parent_product_id': bom_line.parent_product_id,
            'quantity_per': float(bom_line.quantity_per)
        })

    # Get all components
    all_components = db.query(models.Product).filter(
        models.Product.type == 'component',
        models.Product.is_active == True
    ).all()

    result = []

    for component in all_components:
        # Skip if this component is not used in any BOM
        if component.id not in component_usage:
            result.append({
                'product_id': component.id,
                'product_code': component.code,
                'product_name': component.name,
                'current_reorder_point': float(component.reorder_point or 0),
                'dynamic_reorder_point': 0,
                'average_weekly_usage': 0,
                'six_week_usage': 0,
                'safety_stock': float(component.safety_stock or 0),
                'used_in_products': []
            })
            continue

        # Calculate total weekly usage for this component across ALL products
        total_weekly_usage = []
        used_in_products = []

        for usage in component_usage[component.id]:
            parent_product_id = usage['parent_product_id']
            quantity_per = usage['quantity_per']

            # Get the parent product
            parent_product = db.query(models.Product).filter(
                models.Product.id == parent_product_id
            ).first()

            if parent_product:
                used_in_products.append({
                    'code': parent_product.code,
                    'name': parent_product.name,
                    'quantity_per': quantity_per
                })

            # Get weekly goals for this parent product
            if parent_product_id in shipments_by_product:
                for weekly_goal in shipments_by_product[parent_product_id]:
                    # Calculate component usage for this week
                    component_weekly_usage = weekly_goal * quantity_per

                    # Find or create entry for this week
                    if len(total_weekly_usage) < len(shipments_by_product[parent_product_id]):
                        total_weekly_usage.extend([0] * (len(shipments_by_product[parent_product_id]) - len(total_weekly_usage)))

                    # Add to the appropriate week (matching the index)
                    week_index = shipments_by_product[parent_product_id].index(weekly_goal)
                    if week_index < len(total_weekly_usage):
                        total_weekly_usage[week_index] += component_weekly_usage
                    else:
                        total_weekly_usage.append(component_weekly_usage)

        # Calculate average weekly usage across the 6 weeks
        if total_weekly_usage:
            # Sum usage across all weeks where we have data
            total_usage = sum(total_weekly_usage)
            weeks_with_data = len([u for u in total_weekly_usage if u > 0]) or 1
            average_weekly_usage = total_usage / weeks_with_data
        else:
            average_weekly_usage = 0

        # Calculate 6-week usage
        six_week_usage = average_weekly_usage * 6

        # Calculate dynamic reorder point: 6-week usage + safety stock
        safety_stock = float(component.safety_stock or 0)
        dynamic_reorder_point = six_week_usage + safety_stock

        result.append({
            'product_id': component.id,
            'product_code': component.code,
            'product_name': component.name,
            'current_reorder_point': float(component.reorder_point or 0),
            'dynamic_reorder_point': round(dynamic_reorder_point, 2),
            'average_weekly_usage': round(average_weekly_usage, 2),
            'six_week_usage': round(six_week_usage, 2),
            'safety_stock': safety_stock,
            'used_in_products': used_in_products
        })

    # Sort by dynamic reorder point (highest first)
    result.sort(key=lambda x: x['dynamic_reorder_point'], reverse=True)

    return {"components": result}

@app.post("/api/inventory/update-reorder-points")
def update_reorder_points_from_dynamic(db: Session = Depends(get_db)):
    """
    Update all component reorder points based on dynamic calculation
    """
    # Get dynamic reorder points
    dynamic_data = get_dynamic_reorder_points(db)

    updated_count = 0
    for component_data in dynamic_data['components']:
        product = db.query(models.Product).filter(
            models.Product.id == component_data['product_id']
        ).first()

        if product:
            product.reorder_point = Decimal(str(component_data['dynamic_reorder_point']))
            updated_count += 1

    db.commit()

    return {
        "message": f"Updated reorder points for {updated_count} components",
        "updated_count": updated_count
    }

@app.get("/api/inventory/{product_id}", response_model=schemas.Inventory)
def get_product_inventory(product_id: int, db: Session = Depends(get_db)):
    """Get inventory for a specific product"""
    inv = db.query(models.Inventory).filter(models.Inventory.product_id == product_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory not found")

    return schemas.Inventory(
        id=inv.id,
        product_id=inv.product_id,
        on_hand=inv.on_hand,
        allocated=inv.allocated,
        available=Decimal(str(inv.available)),
        last_updated=inv.last_updated,
        product_code=inv.product.code,
        product_name=inv.product.name,
        reorder_point=inv.product.reorder_point,
        reorder_qty=inv.product.reorder_qty
    )

@app.post("/api/inventory/adjust")
def adjust_inventory(adjustment: schemas.InventoryAdjustmentCreate, db: Session = Depends(get_db)):
    """Adjust inventory quantity"""
    # Get or create inventory record
    inventory = db.query(models.Inventory).filter(
        models.Inventory.product_id == adjustment.product_id
    ).first()

    if not inventory:
        inventory = models.Inventory(product_id=adjustment.product_id, on_hand=0, allocated=0)
        db.add(inventory)

    # Store previous quantity for audit trail
    previous_on_hand = float(inventory.on_hand)

    # Apply adjustment
    inventory.on_hand = Decimal(str(float(inventory.on_hand) + float(adjustment.quantity_change)))
    new_on_hand = float(inventory.on_hand)

    # Enhance notes with before/after quantities
    enhanced_notes = adjustment.notes or ""
    if enhanced_notes:
        enhanced_notes += f" Previous: {previous_on_hand}, New: {new_on_hand}"
    else:
        enhanced_notes = f"Previous: {previous_on_hand}, New: {new_on_hand}"

    # Record adjustment with enhanced notes
    db_adjustment = models.InventoryAdjustment(
        product_id=adjustment.product_id,
        quantity_change=adjustment.quantity_change,
        reason=adjustment.reason,
        notes=enhanced_notes
    )
    db.add(db_adjustment)

    db.commit()
    return {"message": "Inventory adjusted successfully", "new_on_hand": inventory.on_hand}

@app.get("/api/inventory/adjustments/history")
def get_inventory_adjustment_history(db: Session = Depends(get_db)):
    """Get complete history of all inventory adjustments"""
    adjustments = db.query(models.InventoryAdjustment).order_by(
        models.InventoryAdjustment.adjustment_date.desc()
    ).all()

    result = []
    for adj in adjustments:
        # Get product info
        product = db.query(models.Product).filter(models.Product.id == adj.product_id).first()

        if product:
            # Parse notes to extract previous and new quantities if available
            previous_quantity = None
            new_quantity = None

            if adj.notes:
                # Try to extract quantities from notes like "Previous: 100, New: 150"
                import re
                prev_match = re.search(r'Previous:\s*([\d.]+)', adj.notes)
                new_match = re.search(r'New:\s*([\d.]+)', adj.notes)

                if prev_match:
                    previous_quantity = float(prev_match.group(1))
                if new_match:
                    new_quantity = float(new_match.group(1))

            result.append({
                'id': adj.id,
                'product_id': adj.product_id,
                'product_code': product.code,
                'product_name': product.name,
                'quantity_change': float(adj.quantity_change),
                'previous_quantity': previous_quantity,
                'new_quantity': new_quantity,
                'reason': adj.reason or '',
                'notes': adj.notes,
                'adjustment_date': adj.adjustment_date.isoformat() if adj.adjustment_date else None,
                'created_at': adj.adjustment_date.isoformat() if adj.adjustment_date else None,
                'category': product.category,
                'supplier': product.supplier
            })

    return result

# ============================================================================
# DEMAND ENDPOINTS
# ============================================================================

@app.get("/api/demand/daily-build-analysis")
def get_daily_build_analysis(days: int = 90, db: Session = Depends(get_db)):
    """
    Calculate CONSOLIDATED daily material consumption across ALL products based on weekly shipment goals and BOMs.
    Returns a component-centric view showing actual total consumption and run-out dates.
    """
    from datetime import datetime, timedelta
    from collections import defaultdict

    # Calculate date range
    start_date = date.today()
    dates = [start_date + timedelta(days=i) for i in range(days)]

    # Get weekly shipment goals for the date range - FOR ALL PRODUCTS
    week_starts = set()
    for d in dates:
        week_start = d - timedelta(days=d.weekday())
        week_starts.add(week_start)

    # Fetch ALL weekly shipments for these weeks
    all_shipments = db.query(models.WeeklyShipment).filter(
        models.WeeklyShipment.week_start_date.in_(list(week_starts))
    ).all()

    # Group shipments by product_id and week
    shipments_by_product = defaultdict(dict)
    for s in all_shipments:
        shipments_by_product[s.product_id][s.week_start_date] = float(s.goal)

    # Calculate daily production targets for EACH product
    daily_production_by_product = defaultdict(dict)
    for product_id, weekly_goals in shipments_by_product.items():
        for d in dates:
            week_start = d - timedelta(days=d.weekday())
            weekly_goal = weekly_goals.get(week_start, 0)

            # Only produce on weekdays (Mon-Fri)
            if d.weekday() < 5:  # 0-4 are Mon-Fri
                daily_production_by_product[product_id][d] = weekly_goal / 5
            else:
                daily_production_by_product[product_id][d] = 0

    # Get ALL BOM lines to understand component usage
    all_bom_lines = db.query(models.BOMLine).all()

    # Group BOM lines by component to see which products use each component
    component_usage = defaultdict(list)
    for bom_line in all_bom_lines:
        component_usage[bom_line.component_product_id].append({
            'parent_product_id': bom_line.parent_product_id,
            'parent_product': bom_line.parent_product,
            'quantity_per': float(bom_line.quantity_per)
        })

    # Get all components
    all_components = db.query(models.Product).filter(models.Product.type == 'component').all()

    components_data = []

    for component in all_components:
        # Skip if this component is not used in any BOM
        if component.id not in component_usage:
            continue

        # Get current inventory
        inventory = db.query(models.Inventory).filter(
            models.Inventory.product_id == component.id
        ).first()
        current_stock = float(inventory.on_hand) if inventory else 0

        # Get pending purchase orders for this component (including overdue ones)
        pending_pos = db.query(models.PurchaseOrder).filter(
            models.PurchaseOrder.product_id == component.id,
            models.PurchaseOrder.status == 'pending'
        ).all()

        # Create a map of expected PO arrivals by date
        po_arrivals_by_date = defaultdict(float)
        for po in pending_pos:
            po_arrivals_by_date[po.expected_date] += float(po.quantity)

        # Calculate TOTAL daily consumption across ALL products that use this component
        daily_data = []
        running_inventory = current_stock
        run_out_date = None

        # Build list of products that use this component (do this once, not in the loop)
        used_in_products = []
        seen_products = set()
        for usage in component_usage[component.id]:
            product_code = usage['parent_product'].code
            if product_code not in seen_products:
                seen_products.add(product_code)
                used_in_products.append({
                    'code': product_code,
                    'name': usage['parent_product'].name,
                    'quantity_per': usage['quantity_per']
                })

        for d in dates:
            total_consumption = 0

            # Sum consumption from ALL products that use this component
            for usage in component_usage[component.id]:
                parent_product_id = usage['parent_product_id']
                quantity_per = usage['quantity_per']

                # Get daily production for this parent product
                if parent_product_id in daily_production_by_product:
                    production = daily_production_by_product[parent_product_id].get(d, 0)
                    consumption = production * quantity_per
                    total_consumption += consumption

            # Add incoming PO if arriving today
            incoming_po = po_arrivals_by_date.get(d, 0)

            # Calculate end of day inventory (subtract consumption, add incoming PO)
            running_inventory -= total_consumption
            running_inventory += incoming_po

            # Record when we first go negative
            if run_out_date is None and running_inventory < 0:
                run_out_date = d.isoformat()

            daily_data.append({
                'date': d.isoformat(),
                'day_of_week': d.strftime('%a'),
                'consumption': round(total_consumption, 2),
                'incoming_po': round(incoming_po, 2) if incoming_po > 0 else 0,
                'projected_inventory': round(running_inventory, 2)
            })

        # Calculate days until run out
        days_of_inventory = None
        if run_out_date:
            days_until_runout = (datetime.strptime(run_out_date, '%Y-%m-%d').date() - start_date).days
            days_of_inventory = days_until_runout
        else:
            days_of_inventory = days  # More than the projection period

        # Format pending POs for frontend
        pending_pos_data = [{
            'po_id': po.id,
            'po_number': po.po_number,
            'quantity': float(po.quantity),
            'expected_date': po.expected_date.isoformat(),
            'supplier': po.supplier,
            'order_date': po.order_date.isoformat()
        } for po in pending_pos]

        # Get product details for reorder calculations
        reorder_point = float(component.reorder_point) if component.reorder_point else 0
        reorder_qty = float(component.reorder_qty) if component.reorder_qty else 0
        lead_time_days = component.lead_time_days or 0
        order_multiple = float(component.order_multiple) if component.order_multiple else 1
        minimum_order_qty = float(component.minimum_order_qty) if component.minimum_order_qty else 0
        critical_days = component.critical_days or 7
        warning_days = component.warning_days or 14
        caution_days = component.caution_days or 30

        # Determine if component is "stagnant" (not part of any active production goals)
        # A component is stagnant if it has zero consumption across all days and shows 90+ days of inventory
        total_consumption_across_all_days = sum(day['consumption'] for day in daily_data)
        is_stagnant = (total_consumption_across_all_days == 0 and days_of_inventory >= 90)

        components_data.append({
            'component_id': component.id,
            'component_code': component.code,
            'component_name': component.name,
            'current_stock': current_stock,
            'run_out_date': run_out_date,
            'days_of_inventory': days_of_inventory,
            'used_in_products': used_in_products,
            'daily_data': daily_data,
            'pending_pos': pending_pos_data,
            'has_pending_po': len(pending_pos_data) > 0,
            'reorder_point': reorder_point,
            'reorder_qty': reorder_qty,
            'lead_time_days': lead_time_days,
            'order_multiple': order_multiple,
            'minimum_order_qty': minimum_order_qty,
            'critical_days': critical_days,
            'warning_days': warning_days,
            'caution_days': caution_days,
            'is_stagnant': is_stagnant
        })

    # Sort by days_of_inventory (items running out soonest first)
    components_data.sort(key=lambda x: x['days_of_inventory'] if x['days_of_inventory'] is not None else 999999)

    return {
        'start_date': start_date.isoformat(),
        'components': components_data
    }

@app.get("/api/demand/{product_id}")
def get_demand(product_id: int, days: int = 30, db: Session = Depends(get_db)):
    """Get demand forecast for a product"""
    start_date = date.today()
    end_date = start_date + timedelta(days=days)

    demands = db.query(models.DailyDemand).filter(
        models.DailyDemand.product_id == product_id,
        models.DailyDemand.demand_date >= start_date,
        models.DailyDemand.demand_date <= end_date
    ).all()

    return {"demands": [{"date": d.demand_date.isoformat(), "quantity": float(d.quantity)} for d in demands]}

@app.post("/api/demand")
def save_demand(demand_data: schemas.DailyDemandBulkCreate, db: Session = Depends(get_db)):
    """Save demand forecast (bulk)"""
    from datetime import datetime

    # Convert date strings to date objects
    parsed_demands = []
    for demand in demand_data.demands:
        demand_date = demand['demand_date']
        if isinstance(demand_date, str):
            demand_date = datetime.strptime(demand_date, '%Y-%m-%d').date()
        parsed_demands.append({'demand_date': demand_date, 'quantity': demand['quantity']})

    # Delete existing demands for this product in the date range
    dates_to_update = [d['demand_date'] for d in parsed_demands]
    db.query(models.DailyDemand).filter(
        models.DailyDemand.product_id == demand_data.product_id,
        models.DailyDemand.demand_date.in_(dates_to_update)
    ).delete(synchronize_session=False)

    # Add new demands
    for demand in parsed_demands:
        db_demand = models.DailyDemand(
            product_id=demand_data.product_id,
            demand_date=demand['demand_date'],
            quantity=Decimal(str(demand['quantity']))
        )
        db.add(db_demand)

    db.commit()
    return {"message": f"Saved {len(parsed_demands)} demand records"}

# ============================================================================
# MRP ENDPOINTS
# ============================================================================

@app.post("/api/mrp/calculate")
def calculate_mrp(days: int = 30, db: Session = Depends(get_db)):
    """Run MRP calculation"""
    engine = MRPEngine(db)
    results = engine.calculate_mrp(days=days)
    return results

@app.get("/api/mrp/shortages")
def get_shortages(days: int = 14, db: Session = Depends(get_db)):
    """Get products with shortages"""
    engine = MRPEngine(db)
    shortages = engine.get_shortages(days=days)
    return {"shortages": shortages}

@app.get("/api/dashboard", response_model=schemas.DashboardData)
def get_dashboard(db: Session = Depends(get_db)):
    """Get dashboard summary data"""
    engine = MRPEngine(db)
    return engine.get_dashboard_data()

@app.get("/api/mrp/material-analysis/history")
def get_material_analysis_history(days: int = 30, db: Session = Depends(get_db)):
    """
    Get historical inventory data for material analysis
    Returns daily inventory levels and events (PO receipts, consumption, etc.) for components
    """
    from datetime import datetime, timedelta

    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    # Get all component products (non-finished goods)
    components = db.query(models.Product).filter(
        models.Product.type.in_(['component', 'raw_material', 'sub_assembly']),
        models.Product.is_active == True
    ).all()

    result = []

    for component in components:
        # Get inventory adjustments for this component in the date range
        adjustments = db.query(models.InventoryAdjustment).filter(
            models.InventoryAdjustment.product_id == component.id,
            models.InventoryAdjustment.adjustment_date >= start_date,
            models.InventoryAdjustment.adjustment_date <= datetime.now()
        ).order_by(models.InventoryAdjustment.adjustment_date.asc()).all()

        # Get current inventory
        inventory = db.query(models.Inventory).filter(
            models.Inventory.product_id == component.id
        ).first()

        current_stock = float(inventory.on_hand) if inventory else 0

        # Build daily history by working backwards from current stock
        daily_history = []
        running_total = current_stock

        # Create a map of dates to events
        events_by_date = {}
        for adj in reversed(adjustments):
            adj_date = adj.adjustment_date.date()
            if adj_date not in events_by_date:
                events_by_date[adj_date] = []

            event_type = 'adjustment'
            if adj.reason:
                if 'PO Receipt' in adj.reason:
                    event_type = 'po_receipt'
                elif 'Production Output' in adj.reason:
                    event_type = 'production_output'
                elif 'Production Consumption' in adj.reason:
                    event_type = 'production_consumption'
                elif 'Physical count' in adj.reason:
                    event_type = 'physical_count'
                elif 'Scrap' in adj.reason:
                    event_type = 'scrap'

            events_by_date[adj_date].append({
                'type': event_type,
                'quantity_change': float(adj.quantity_change),
                'reason': adj.reason or '',
                'notes': adj.notes or ''
            })

        # Build daily data working backwards
        current_date = end_date
        while current_date >= start_date:
            events = events_by_date.get(current_date, [])

            daily_history.insert(0, {
                'date': current_date.isoformat(),
                'inventory_level': running_total,
                'events': events
            })

            # Subtract today's changes to get yesterday's level
            for event in events:
                running_total -= event['quantity_change']

            current_date -= timedelta(days=1)

        # Only include components that have some history
        if adjustments or current_stock > 0:
            result.append({
                'component_id': component.id,
                'component_code': component.code,
                'component_name': component.name,
                'current_stock': current_stock,
                'daily_history': daily_history
            })

    return {
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'days': days,
        'components': result
    }

# ============================================================================
# SALES HISTORY ENDPOINTS
# ============================================================================

@app.get("/api/sales/summary")
def get_sales_summary(days: int = 30, db: Session = Depends(get_db)):
    """Get sales summary for all products"""
    start_date = date.today() - timedelta(days=days)

    # Get all finished goods products
    products = db.query(models.Product).filter(
        models.Product.type == 'finished_good',
        models.Product.is_active == True
    ).all()

    summary = []
    for product in products:
        total_sales = db.query(func.sum(models.SalesHistory.quantity_sold)).filter(
            models.SalesHistory.product_id == product.id,
            models.SalesHistory.sale_date >= start_date
        ).scalar() or 0

        summary.append({
            'product_id': product.id,
            'product_code': product.code,
            'product_name': product.name,
            'total_sold': float(total_sales)
        })

    return {"summary": summary, "period_days": days}

@app.get("/api/sales/{product_id}")
def get_sales_history(product_id: int, days: int = 30, db: Session = Depends(get_db)):
    """Get sales history for a product"""
    start_date = date.today() - timedelta(days=days)
    end_date = date.today()

    sales = db.query(models.SalesHistory).filter(
        models.SalesHistory.product_id == product_id,
        models.SalesHistory.sale_date >= start_date,
        models.SalesHistory.sale_date <= end_date
    ).order_by(models.SalesHistory.sale_date).all()

    return {"sales": [{"date": s.sale_date.isoformat(), "quantity": float(s.quantity_sold), "notes": s.notes} for s in sales]}

@app.post("/api/sales")
def save_sales_history(sales_data: schemas.SalesHistoryBulkCreate, db: Session = Depends(get_db)):
    """Save sales history (bulk) and deduct inventory for shipped products"""
    from datetime import datetime

    # Get product info
    product = db.query(models.Product).filter(models.Product.id == sales_data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Get product's BOM
    bom_lines = db.query(models.BOMLine).filter(
        models.BOMLine.parent_product_id == sales_data.product_id
    ).all()

    # Convert date strings to date objects
    parsed_sales = []
    for sale in sales_data.sales_data:
        sale_date = sale['sale_date']
        if isinstance(sale_date, str):
            sale_date = datetime.strptime(sale_date, '%Y-%m-%d').date()
        parsed_sales.append({
            'sale_date': sale_date,
            'quantity_sold': sale['quantity_sold'],
            'notes': sale.get('notes', '')
        })

    # Get existing sales to calculate inventory delta
    dates_to_update = [s['sale_date'] for s in parsed_sales]
    existing_sales = db.query(models.SalesHistory).filter(
        models.SalesHistory.product_id == sales_data.product_id,
        models.SalesHistory.sale_date.in_(dates_to_update)
    ).all()

    # Create map of existing quantities
    existing_map = {s.sale_date: float(s.quantity_sold) for s in existing_sales}

    # Calculate inventory changes needed
    inventory_adjustments = []
    for sale in parsed_sales:
        old_qty = existing_map.get(sale['sale_date'], 0)
        new_qty = sale['quantity_sold']
        qty_delta = new_qty - old_qty  # Positive = more shipped, negative = less shipped

        if qty_delta != 0:
            inventory_adjustments.append({
                'sale_date': sale['sale_date'],
                'quantity_delta': qty_delta
            })

    # Delete existing sales for these dates
    db.query(models.SalesHistory).filter(
        models.SalesHistory.product_id == sales_data.product_id,
        models.SalesHistory.sale_date.in_(dates_to_update)
    ).delete(synchronize_session=False)

    # Add new sales records
    for sale in parsed_sales:
        db_sale = models.SalesHistory(
            product_id=sales_data.product_id,
            sale_date=sale['sale_date'],
            quantity_sold=Decimal(str(sale['quantity_sold'])),
            notes=sale['notes']
        )
        db.add(db_sale)

    # Adjust inventory for the quantity changes
    if inventory_adjustments:
        # Deduct finished good inventory
        finished_good_inventory = db.query(models.Inventory).filter(
            models.Inventory.product_id == sales_data.product_id
        ).first()

        if not finished_good_inventory:
            # Create inventory record if doesn't exist
            finished_good_inventory = models.Inventory(
                product_id=sales_data.product_id,
                on_hand=0,
                allocated=0
            )
            db.add(finished_good_inventory)
            db.flush()

        # Calculate total delta
        total_delta = sum(adj['quantity_delta'] for adj in inventory_adjustments)

        if total_delta != 0:
            # Record previous quantity for audit
            previous_fg_qty = float(finished_good_inventory.on_hand)

            # Deduct finished good (negative delta = increase inventory back)
            finished_good_inventory.on_hand = finished_good_inventory.on_hand - Decimal(str(total_delta))

            # Create adjustment record for finished good
            fg_adjustment = models.InventoryAdjustment(
                product_id=sales_data.product_id,
                quantity_change=-total_delta,  # Negative because it's shipped out
                reason=f"Production Output",
                notes=f"Shipped {total_delta} units. Previous: {previous_fg_qty}, New: {float(finished_good_inventory.on_hand)}"
            )
            db.add(fg_adjustment)

            # Deduct BOM components
            for bom_line in bom_lines:
                component_qty_per = float(bom_line.quantity_per)
                component_total_qty = total_delta * component_qty_per

                # Get component inventory
                component_inventory = db.query(models.Inventory).filter(
                    models.Inventory.product_id == bom_line.component_product_id
                ).first()

                if not component_inventory:
                    # Create inventory record if doesn't exist
                    component_inventory = models.Inventory(
                        product_id=bom_line.component_product_id,
                        on_hand=0,
                        allocated=0
                    )
                    db.add(component_inventory)
                    db.flush()

                previous_comp_qty = float(component_inventory.on_hand)
                component_inventory.on_hand = component_inventory.on_hand - Decimal(str(component_total_qty))

                # Create adjustment record for component
                comp_adjustment = models.InventoryAdjustment(
                    product_id=bom_line.component_product_id,
                    quantity_change=-component_total_qty,
                    reason=f"Production Consumption - Used in {product.code}",
                    notes=f"Consumed for {total_delta} units of {product.code}. Previous: {previous_comp_qty}, New: {float(component_inventory.on_hand)}"
                )
                db.add(comp_adjustment)

    db.commit()

    message = f"Saved {len(parsed_sales)} sales records"
    if inventory_adjustments:
        total_shipped = sum(adj['quantity_delta'] for adj in inventory_adjustments)
        if total_shipped != 0:
            message += f" and adjusted inventory for {abs(total_shipped)} units"

    return {"message": message}

@app.post("/api/sales/bulk-import")
def bulk_import_sales(sales_update: schemas.MultiProductSalesUpdate, db: Session = Depends(get_db)):
    """
    Bulk import sales data for multiple products using product codes.
    Perfect for nightly automated updates from external systems.

    Expects JSON format:
    {
        "sales_by_product_code": {
            "TRIG-001": [
                {"sale_date": "2024-11-11", "quantity_sold": 5, "notes": ""},
                {"sale_date": "2024-11-12", "quantity_sold": 3}
            ],
            "TRIG-002": [
                {"sale_date": "2024-11-11", "quantity_sold": 10}
            ]
        }
    }
    """
    from datetime import datetime

    results = {
        'success': [],
        'errors': [],
        'total_records': 0
    }

    for product_code, sales_records in sales_update.sales_by_product_code.items():
        try:
            # Find product by code
            product = db.query(models.Product).filter(
                models.Product.code == product_code
            ).first()

            if not product:
                results['errors'].append({
                    'product_code': product_code,
                    'error': f'Product with code {product_code} not found'
                })
                continue

            # Parse and validate sales records
            parsed_sales = []
            for sale in sales_records:
                sale_date = sale['sale_date']
                if isinstance(sale_date, str):
                    sale_date = datetime.strptime(sale_date, '%Y-%m-%d').date()
                parsed_sales.append({
                    'sale_date': sale_date,
                    'quantity_sold': sale['quantity_sold'],
                    'notes': sale.get('notes', '')
                })

            # Delete existing sales for these dates (upsert behavior)
            dates_to_update = [s['sale_date'] for s in parsed_sales]
            db.query(models.SalesHistory).filter(
                models.SalesHistory.product_id == product.id,
                models.SalesHistory.sale_date.in_(dates_to_update)
            ).delete(synchronize_session=False)

            # Insert new sales records
            for sale in parsed_sales:
                db_sale = models.SalesHistory(
                    product_id=product.id,
                    sale_date=sale['sale_date'],
                    quantity_sold=Decimal(str(sale['quantity_sold'])),
                    notes=sale['notes']
                )
                db.add(db_sale)
                results['total_records'] += 1

            results['success'].append({
                'product_code': product_code,
                'product_name': product.name,
                'records_imported': len(parsed_sales)
            })

        except Exception as e:
            results['errors'].append({
                'product_code': product_code,
                'error': str(e)
            })

    db.commit()

    return {
        'message': f'Import complete. {results["total_records"]} records imported.',
        'results': results
    }

# ============================================================================
# WEEKLY SHIPMENT ENDPOINTS
# ============================================================================

@app.get("/api/weekly-shipments/current-week-summary")
def get_current_week_summary(db: Session = Depends(get_db)):
    """Get current week's shipment summary for all products with goals"""
    from datetime import datetime, timedelta

    # Calculate current week start (Monday)
    today = date.today()
    current_week_start = today - timedelta(days=today.weekday())

    # Get all products with shipments for current week
    shipments = db.query(models.WeeklyShipment).filter(
        models.WeeklyShipment.week_start_date == current_week_start
    ).all()

    # Only include products that have a goal set
    shipments_with_goals = [s for s in shipments if s.goal > 0]

    result = []
    for shipment in shipments_with_goals:
        product = shipment.product

        # Calculate total shipped for the week from SalesHistory (not from shipment.shipped)
        total_shipped_this_week = db.query(func.sum(models.SalesHistory.quantity_sold)).filter(
            models.SalesHistory.product_id == product.id,
            models.SalesHistory.sale_date >= current_week_start,
            models.SalesHistory.sale_date <= today
        ).scalar() or 0
        total_shipped_this_week = float(total_shipped_this_week)

        progress = (total_shipped_this_week / float(shipment.goal) * 100) if shipment.goal > 0 else 0

        # Get today's sales to calculate daily status
        today_sales = db.query(func.sum(models.SalesHistory.quantity_sold)).filter(
            models.SalesHistory.product_id == product.id,
            models.SalesHistory.sale_date == today
        ).scalar() or 0
        today_shipped = float(today_sales)

        # Get shipped so far this week (excluding today)
        shipped_before_today = db.query(func.sum(models.SalesHistory.quantity_sold)).filter(
            models.SalesHistory.product_id == product.id,
            models.SalesHistory.sale_date >= current_week_start,
            models.SalesHistory.sale_date < today
        ).scalar() or 0
        shipped_before_today = float(shipped_before_today)

        # Calculate status based on remaining workdays pace
        # Count remaining workdays in the week (Mon=0 to Fri=4, including today)
        today_weekday = today.weekday()  # Monday=0, Sunday=6

        # Calculate the original daily target (goal / 5 workdays)
        original_daily_target = float(shipment.goal) / 5

        # Calculate workdays completed so far (not including today)
        workdays_completed = min(today_weekday, 5)  # Monday=0 completed, Friday=4 completed

        # If it's Saturday (5) or Sunday (6), consider next week
        if today_weekday >= 5:
            workdays_remaining = 5  # Full week ahead
            remaining_needed = max(0, float(shipment.goal) - total_shipped_this_week)
            daily_target_remaining = remaining_needed / workdays_remaining if workdays_remaining > 0 else 0
            daily_goal_today = 0
            daily_status = 'weekend'
            status = 'behind' if total_shipped_this_week < shipment.goal else 'complete'
        else:
            # Calculate workdays remaining (including today)
            workdays_remaining = 5 - today_weekday  # e.g., Mon=5, Tue=4, Wed=3, Thu=2, Fri=1

            # Calculate the original daily target (goal / 5 workdays)
            original_daily_target = float(shipment.goal) / 5

            # Calculate how much is still needed for the week (excluding what's already shipped BEFORE today)
            # This ensures the daily goal shows what needs to be done starting TODAY
            remaining_needed = max(0, float(shipment.goal) - shipped_before_today)

            # Today's daily goal is dynamic - it's the catch-up target (remaining / days left including today)
            daily_goal_today = remaining_needed / workdays_remaining if workdays_remaining > 0 else 0

            # Determine overall week status first
            if total_shipped_this_week >= shipment.goal:
                status = 'complete'
                daily_status = 'complete'
            else:
                # Calculate daily status based on today's performance against the dynamic daily goal
                if today_shipped >= daily_goal_today:
                    daily_status = 'complete'
                elif today_shipped >= daily_goal_today * 0.8:
                    daily_status = 'close'
                else:
                    daily_status = 'behind'

                # Determine week status based on remaining workload
                # If we met today's daily goal, we're on pace
                if today_shipped >= daily_goal_today:
                    status = 'on_pace'
                else:
                    # Calculate what we need per day for remaining days (excluding today since it's already done/in progress)
                    remaining_after_today = max(0, float(shipment.goal) - total_shipped_this_week)
                    days_after_today = workdays_remaining - 1  # Exclude today

                    if days_after_today > 0:
                        needed_per_day_remaining = remaining_after_today / days_after_today
                        # On track if the remaining daily need is <= original target
                        if needed_per_day_remaining <= original_daily_target:
                            status = 'on_pace'
                        else:
                            status = 'behind'
                    elif days_after_today == 0:
                        # Today is Friday (last workday) - if we didn't meet goal, we're behind
                        status = 'behind'
                    else:
                        # This shouldn't happen, but handle edge case
                        status = 'behind'

        result.append({
            'product_id': product.id,
            'product_code': product.code,
            'product_name': product.name,
            'goal': float(shipment.goal),
            'shipped': total_shipped_this_week,
            'progress': round(progress, 1),
            'variance': total_shipped_this_week - float(shipment.goal),
            'status': status,
            'daily_target_remaining': round(daily_goal_today, 1),
            'daily_goal_today': round(daily_goal_today, 1),
            'today_shipped': round(today_shipped, 1),
            'shipped_before_today': round(shipped_before_today, 1),
            'daily_status': daily_status,
            'workdays_remaining': workdays_remaining
        })

    # Sort by progress (lowest first to highlight what needs attention)
    result.sort(key=lambda x: x['progress'])

    return {
        'week_start': current_week_start.isoformat(),
        'week_end': (current_week_start + timedelta(days=6)).isoformat(),
        'products': result
    }

@app.get("/api/weekly-shipments/{product_id}")
def get_weekly_shipments(
    product_id: int,
    weeks: int = 8,
    start_date: str = None,
    db: Session = Depends(get_db)
):
    """Get weekly shipments for a product with shipped qty calculated from sales history"""
    from datetime import datetime, timedelta
    from sqlalchemy import func

    # Calculate week start dates (Mondays) for the requested number of weeks
    today = date.today()

    # Use provided start_date or default to current week
    if start_date:
        try:
            base_week_start = datetime.strptime(start_date, '%Y-%m-%d').date()
            # Ensure it's a Monday
            base_week_start = base_week_start - timedelta(days=base_week_start.weekday())
        except ValueError:
            base_week_start = today - timedelta(days=today.weekday())
    else:
        # Find the Monday of the current week
        base_week_start = today - timedelta(days=today.weekday())

    # Calculate current week start for shipped_before_today calculation
    current_week_start = today - timedelta(days=today.weekday())

    week_starts = []
    for i in range(weeks):
        week_start = base_week_start + timedelta(weeks=i)
        week_starts.append(week_start)

    # Get existing shipment records (for goals and notes)
    shipments = db.query(models.WeeklyShipment).filter(
        models.WeeklyShipment.product_id == product_id,
        models.WeeklyShipment.week_start_date.in_(week_starts)
    ).all()

    # Create a dict for easy lookup
    shipment_dict = {s.week_start_date: s for s in shipments}

    # Calculate shipped quantities from sales history
    # Get all sales for this product
    earliest_week = min(week_starts)
    latest_week = max(week_starts) + timedelta(days=6)  # End of last week

    sales = db.query(models.SalesHistory).filter(
        models.SalesHistory.product_id == product_id,
        models.SalesHistory.sale_date >= earliest_week,
        models.SalesHistory.sale_date <= latest_week
    ).all()

    # Group sales by week
    shipped_by_week = {}
    for sale in sales:
        # Calculate which Monday this sale belongs to
        sale_weekday = sale.sale_date.weekday()
        week_start = sale.sale_date - timedelta(days=sale_weekday)

        if week_start not in shipped_by_week:
            shipped_by_week[week_start] = 0
        shipped_by_week[week_start] += float(sale.quantity_sold)

    # Calculate shipped_before_today for current week
    shipped_before_today_current_week = 0
    if current_week_start in shipped_by_week:
        # Calculate shipped before today for current week
        for sale in sales:
            sale_weekday = sale.sale_date.weekday()
            week_start = sale.sale_date - timedelta(days=sale_weekday)
            if week_start == current_week_start and sale.sale_date < today:
                shipped_before_today_current_week += float(sale.quantity_sold)

    # Build result with all weeks (fill in missing with defaults)
    result = []
    for week_start in week_starts:
        shipped_qty = shipped_by_week.get(week_start, 0)

        # For current week, also include shipped_before_today
        is_current_week = (week_start == current_week_start)
        shipped_before_today = shipped_before_today_current_week if is_current_week else None

        if week_start in shipment_dict:
            s = shipment_dict[week_start]
            result.append({
                'week_start_date': week_start.isoformat(),
                'goal': float(s.goal),
                'shipped': shipped_qty,  # From sales history, not DB
                'shipped_before_today': shipped_before_today,  # Only for current week
                'notes': s.notes or ''
            })
        else:
            result.append({
                'week_start_date': week_start.isoformat(),
                'goal': 0,
                'shipped': shipped_qty,  # From sales history
                'shipped_before_today': shipped_before_today,  # Only for current week
                'notes': ''
            })

    return {"shipments": result}

@app.post("/api/weekly-shipments")
def save_weekly_shipments(shipment_data: schemas.WeeklyShipmentBulkUpdate, db: Session = Depends(get_db)):
    """Save weekly shipment data (bulk) - only goal and notes, shipped is calculated from sales"""
    from datetime import datetime

    # Parse and save each week's data
    for week in shipment_data.weeks:
        week_start = week['week_start_date']
        if isinstance(week_start, str):
            week_start = datetime.strptime(week_start, '%Y-%m-%d').date()

        # Check if record exists
        existing = db.query(models.WeeklyShipment).filter(
            models.WeeklyShipment.product_id == shipment_data.product_id,
            models.WeeklyShipment.week_start_date == week_start
        ).first()

        if existing:
            # Update existing (only goal and notes, shipped is calculated from sales)
            existing.goal = Decimal(str(week.get('goal', 0)))
            existing.notes = week.get('notes', '')
            # NOTE: shipped field is ignored - it's calculated from sales_history
        else:
            # Create new
            new_shipment = models.WeeklyShipment(
                product_id=shipment_data.product_id,
                week_start_date=week_start,
                goal=Decimal(str(week.get('goal', 0))),
                shipped=0,  # Always 0 in DB, calculated from sales_history on read
                notes=week.get('notes', '')
            )
            db.add(new_shipment)

    db.commit()
    return {"message": f"Saved {len(shipment_data.weeks)} weekly shipment goals"}

# ============================================================================
# PURCHASE ORDER ENDPOINTS
# ============================================================================

@app.get("/api/purchase-orders")
def get_purchase_orders(
    status: Optional[str] = None,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get all purchase orders with optional filtering and status counts"""
    # Get counts for all statuses (regardless of filter)
    pending_count = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.status == 'pending').count()
    received_count = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.status == 'received').count()
    total_count = db.query(models.PurchaseOrder).count()

    # Build filtered query
    query = db.query(models.PurchaseOrder)

    if status:
        query = query.filter(models.PurchaseOrder.status == status)
    if product_id:
        query = query.filter(models.PurchaseOrder.product_id == product_id)

    pos = query.order_by(models.PurchaseOrder.expected_date.asc()).all()

    # Add product info
    result = []
    for po in pos:
        po_dict = {
            "id": po.id,
            "po_number": po.po_number,
            "product_id": po.product_id,
            "order_date": po.order_date,
            "expected_date": po.expected_date,
            "quantity": po.quantity,
            "status": po.status,
            "received_date": po.received_date,
            "received_quantity": po.received_quantity,
            "supplier": po.supplier,
            "notes": po.notes,
            "created_at": po.created_at,
            "updated_at": po.updated_at,
            "product_code": po.product.code if po.product else None,
            "product_name": po.product.name if po.product else None
        }
        result.append(po_dict)

    return {
        "purchase_orders": result,
        "counts": {
            "pending": pending_count,
            "received": received_count,
            "all": total_count
        }
    }

@app.get("/api/purchase-orders/{po_id}", response_model=schemas.PurchaseOrder)
def get_purchase_order(po_id: int, db: Session = Depends(get_db)):
    """Get a specific purchase order"""
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    po_dict = {
        "id": po.id,
        "po_number": po.po_number,
        "product_id": po.product_id,
        "order_date": po.order_date,
        "expected_date": po.expected_date,
        "quantity": po.quantity,
        "status": po.status,
        "received_date": po.received_date,
        "received_quantity": po.received_quantity,
        "supplier": po.supplier,
        "notes": po.notes,
        "created_at": po.created_at,
        "updated_at": po.updated_at,
        "product_code": po.product.code if po.product else None,
        "product_name": po.product.name if po.product else None
    }
    return schemas.PurchaseOrder(**po_dict)

@app.post("/api/purchase-orders", response_model=schemas.PurchaseOrder)
def create_purchase_order(po: schemas.PurchaseOrderCreate, db: Session = Depends(get_db)):
    """Create a new purchase order"""
    # Check if PO number already exists
    existing = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.po_number == po.po_number
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"PO number {po.po_number} already exists")

    # Check if product exists
    product = db.query(models.Product).filter(models.Product.id == po.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db_po = models.PurchaseOrder(**po.dict())
    db.add(db_po)
    db.commit()
    db.refresh(db_po)

    po_dict = {
        "id": db_po.id,
        "po_number": db_po.po_number,
        "product_id": db_po.product_id,
        "order_date": db_po.order_date,
        "expected_date": db_po.expected_date,
        "quantity": db_po.quantity,
        "status": db_po.status,
        "received_date": db_po.received_date,
        "received_quantity": db_po.received_quantity,
        "supplier": db_po.supplier,
        "notes": db_po.notes,
        "created_at": db_po.created_at,
        "updated_at": db_po.updated_at,
        "product_code": product.code,
        "product_name": product.name
    }
    return schemas.PurchaseOrder(**po_dict)

@app.put("/api/purchase-orders/{po_id}", response_model=schemas.PurchaseOrder)
def update_purchase_order(
    po_id: int,
    po_update: schemas.PurchaseOrderUpdate,
    db: Session = Depends(get_db)
):
    """Update a purchase order"""
    db_po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not db_po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    update_data = po_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_po, key, value)

    db.commit()
    db.refresh(db_po)

    po_dict = {
        "id": db_po.id,
        "po_number": db_po.po_number,
        "product_id": db_po.product_id,
        "order_date": db_po.order_date,
        "expected_date": db_po.expected_date,
        "quantity": db_po.quantity,
        "status": db_po.status,
        "received_date": db_po.received_date,
        "received_quantity": db_po.received_quantity,
        "supplier": db_po.supplier,
        "notes": db_po.notes,
        "created_at": db_po.created_at,
        "updated_at": db_po.updated_at,
        "product_code": db_po.product.code if db_po.product else None,
        "product_name": db_po.product.name if db_po.product else None
    }
    return schemas.PurchaseOrder(**po_dict)

@app.post("/api/purchase-orders/{po_id}/receive")
def receive_purchase_order(
    po_id: int,
    receive_data: schemas.PurchaseOrderReceive,
    db: Session = Depends(get_db)
):
    """Receive a purchase order and update inventory"""
    db_po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not db_po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    if db_po.status == 'received':
        raise HTTPException(status_code=400, detail="Purchase order already received")

    # Update PO status
    db_po.status = 'received'
    db_po.received_date = receive_data.received_date
    db_po.received_quantity = receive_data.received_quantity
    if receive_data.notes:
        db_po.notes = (db_po.notes or "") + f"\nReceived: {receive_data.notes}"

    # Update inventory
    inventory = db.query(models.Inventory).filter(
        models.Inventory.product_id == db_po.product_id
    ).first()

    previous_on_hand = 0.0
    if inventory:
        previous_on_hand = float(inventory.on_hand)
        inventory.on_hand = float(inventory.on_hand) + float(receive_data.received_quantity)
    else:
        # Create inventory record if it doesn't exist
        inventory = models.Inventory(
            product_id=db_po.product_id,
            on_hand=receive_data.received_quantity,
            allocated=0
        )
        db.add(inventory)

    new_on_hand = float(inventory.on_hand)

    # Create inventory adjustment record with before/after quantities
    enhanced_notes = receive_data.notes or ""
    if enhanced_notes:
        enhanced_notes += f" Previous: {previous_on_hand}, New: {new_on_hand}"
    else:
        enhanced_notes = f"Previous: {previous_on_hand}, New: {new_on_hand}"

    adjustment = models.InventoryAdjustment(
        product_id=db_po.product_id,
        quantity_change=receive_data.received_quantity,
        reason=f"PO Receipt: {db_po.po_number}",
        notes=enhanced_notes
    )
    db.add(adjustment)

    db.commit()

    return {
        "message": "Purchase order received successfully",
        "po_id": db_po.id,
        "received_quantity": float(receive_data.received_quantity),
        "new_inventory_level": float(inventory.on_hand)
    }

@app.post("/api/purchase-orders/{po_id}/undo-receipt")
def undo_purchase_order_receipt(po_id: int, db: Session = Depends(get_db)):
    """Undo/reverse a received purchase order"""
    db_po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not db_po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    if db_po.status != 'received':
        raise HTTPException(status_code=400, detail="Purchase order has not been received yet")

    # Get the received quantity before clearing it
    received_qty = float(db_po.received_quantity or 0)

    if received_qty <= 0:
        raise HTTPException(status_code=400, detail="No received quantity to undo")

    # Update inventory - subtract the received quantity
    inventory = db.query(models.Inventory).filter(
        models.Inventory.product_id == db_po.product_id
    ).first()

    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory record not found")

    previous_on_hand = float(inventory.on_hand)
    new_on_hand = previous_on_hand - received_qty

    if new_on_hand < 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot undo receipt: Would result in negative inventory. Current: {previous_on_hand}, Undo amount: {received_qty}"
        )

    inventory.on_hand = new_on_hand

    # Create inventory adjustment record for the reversal
    adjustment = models.InventoryAdjustment(
        product_id=db_po.product_id,
        quantity_change=-received_qty,
        reason=f"PO Receipt Undo: {db_po.po_number}",
        notes=f"Reversed PO receipt. Previous: {previous_on_hand}, New: {new_on_hand}"
    )
    db.add(adjustment)

    # Update PO status back to pending
    db_po.status = 'pending'
    received_date_str = db_po.received_date.strftime('%Y-%m-%d') if db_po.received_date else 'unknown'
    db_po.notes = (db_po.notes or "") + f"\n[UNDONE] Receipt from {received_date_str} of {received_qty} units was reversed"
    db_po.received_date = None
    db_po.received_quantity = None

    db.commit()

    return {
        "message": "Purchase order receipt undone successfully",
        "po_id": db_po.id,
        "reversed_quantity": received_qty,
        "new_inventory_level": new_on_hand,
        "previous_inventory_level": previous_on_hand
    }

@app.delete("/api/purchase-orders/{po_id}")
def delete_purchase_order(po_id: int, db: Session = Depends(get_db)):
    """Delete or cancel a purchase order"""
    db_po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not db_po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    if db_po.status == 'received':
        raise HTTPException(status_code=400, detail="Cannot delete received purchase order")

    db.delete(db_po)
    db.commit()
    return {"message": "Purchase order deleted"}

# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
