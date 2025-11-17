from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal

# ============================================================================
# PRODUCT SCHEMAS
# ============================================================================

class ProductBase(BaseModel):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=200)
    type: str = Field(..., pattern="^(finished_good|sub_assembly|component|raw_material)$")
    uom: str = Field(..., max_length=10)
    reorder_point: Optional[Decimal] = 0
    reorder_qty: Optional[Decimal] = 0
    lead_time_days: Optional[int] = 0
    safety_stock: Optional[Decimal] = 0
    order_multiple: Optional[Decimal] = 1
    minimum_order_qty: Optional[Decimal] = 0
    critical_days: Optional[int] = 7
    warning_days: Optional[int] = 14
    caution_days: Optional[int] = 30
    category: Optional[str] = None
    supplier: Optional[str] = None
    tags: Optional[str] = None  # JSON string of tags array
    is_active: bool = True

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None
    uom: Optional[str] = None
    reorder_point: Optional[Decimal] = None
    reorder_qty: Optional[Decimal] = None
    lead_time_days: Optional[int] = None
    safety_stock: Optional[Decimal] = None
    order_multiple: Optional[Decimal] = None
    minimum_order_qty: Optional[Decimal] = None
    critical_days: Optional[int] = None
    warning_days: Optional[int] = None
    caution_days: Optional[int] = None
    category: Optional[str] = None
    supplier: Optional[str] = None
    tags: Optional[str] = None
    is_active: Optional[bool] = None

class Product(ProductBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# ============================================================================
# BOM SCHEMAS
# ============================================================================

class BOMLineBase(BaseModel):
    component_product_id: int
    quantity_per: Decimal = Field(..., gt=0)

class BOMLineCreate(BOMLineBase):
    pass

class BOMLine(BOMLineBase):
    id: int
    parent_product_id: int
    component_name: Optional[str] = None
    component_code: Optional[str] = None

    class Config:
        from_attributes = True

class BOMWithComponents(BaseModel):
    product_id: int
    product_code: str
    product_name: str
    components: List[BOMLine]

class BOMUpdate(BaseModel):
    components: List[BOMLineCreate]

# ============================================================================
# INVENTORY SCHEMAS
# ============================================================================

class InventoryBase(BaseModel):
    on_hand: Decimal = 0
    allocated: Decimal = 0

class InventoryUpdate(BaseModel):
    on_hand: Optional[Decimal] = None
    allocated: Optional[Decimal] = None

class Inventory(InventoryBase):
    id: int
    product_id: int
    available: Decimal
    last_updated: datetime
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    reorder_point: Optional[Decimal] = None
    reorder_qty: Optional[Decimal] = None
    category: Optional[str] = None
    supplier: Optional[str] = None
    lead_time_days: Optional[int] = None

    class Config:
        from_attributes = True

class InventoryAdjustmentCreate(BaseModel):
    product_id: int
    quantity_change: Decimal
    reason: Optional[str] = None
    notes: Optional[str] = None

class InventoryAdjustment(BaseModel):
    id: int
    product_id: int
    adjustment_date: datetime
    quantity_change: Decimal
    reason: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True

# ============================================================================
# DEMAND SCHEMAS
# ============================================================================

class DailyDemandBase(BaseModel):
    product_id: int
    demand_date: date
    quantity: Decimal

class DailyDemandCreate(DailyDemandBase):
    pass

class DailyDemandBulkCreate(BaseModel):
    product_id: int
    demands: List[dict]  # [{"demand_date": "2024-11-11", "quantity": 100}, ...]

class DailyDemand(DailyDemandBase):
    id: int

    class Config:
        from_attributes = True

# ============================================================================
# MRP SCHEMAS
# ============================================================================

class MRPResultBase(BaseModel):
    product_id: int
    result_date: date
    projected_onhand: Decimal
    needs_ordering: bool = False
    shortage_date: Optional[date] = None

class MRPResult(MRPResultBase):
    id: int
    calculated_at: datetime

    class Config:
        from_attributes = True

class MRPSummary(BaseModel):
    total_products: int
    products_with_shortages: int
    products_low_stock: int
    products_ok: int

class ShortageAlert(BaseModel):
    product_id: int
    product_code: str
    product_name: str
    on_hand: Decimal
    shortage_date: date
    order_by_date: date
    reorder_point: Decimal
    reorder_qty: Decimal
    recommended_order_qty: Decimal
    lead_time_days: int

class DashboardData(BaseModel):
    total_products: int
    total_components: int
    total_inventory_value: int
    low_stock_count: int
    shortages: List[dict]  # Simplified shortages for frontend

# ============================================================================
# SALES HISTORY SCHEMAS
# ============================================================================

class SalesHistoryBase(BaseModel):
    product_id: int
    sale_date: date
    quantity_sold: Decimal
    notes: Optional[str] = None

class SalesHistoryCreate(SalesHistoryBase):
    pass

class SalesHistory(SalesHistoryBase):
    id: int
    created_at: datetime
    product_code: Optional[str] = None
    product_name: Optional[str] = None

    class Config:
        from_attributes = True

class SalesHistoryBulkCreate(BaseModel):
    product_id: int
    sales_data: List[dict]  # [{"sale_date": "2024-11-11", "quantity_sold": 5, "notes": ""}, ...]

class MultiProductSalesUpdate(BaseModel):
    """Schema for bulk multi-product sales updates (for automated nightly imports)"""
    sales_by_product_code: dict  # {"TRIG-001": [{"sale_date": "2024-11-11", "quantity_sold": 5}, ...], ...}

# ============================================================================
# WEEKLY SHIPMENT SCHEMAS
# ============================================================================

class WeeklyShipmentBase(BaseModel):
    product_id: int
    week_start_date: date
    goal: Decimal = 0
    shipped: Decimal = 0
    notes: Optional[str] = None

class WeeklyShipmentCreate(WeeklyShipmentBase):
    pass

class WeeklyShipmentUpdate(BaseModel):
    goal: Optional[Decimal] = None
    shipped: Optional[Decimal] = None
    notes: Optional[str] = None

class WeeklyShipment(WeeklyShipmentBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    product_code: Optional[str] = None
    product_name: Optional[str] = None

    class Config:
        from_attributes = True

class WeeklyShipmentBulkUpdate(BaseModel):
    product_id: int
    weeks: List[dict]  # [{"week_start_date": "2024-11-11", "goal": 2300, "shipped": 2206}, ...]

# ============================================================================
# PURCHASE ORDER SCHEMAS
# ============================================================================

class PurchaseOrderBase(BaseModel):
    po_number: str = Field(..., max_length=50)
    product_id: int
    order_date: date
    expected_date: date
    quantity: Decimal
    supplier: Optional[str] = None
    notes: Optional[str] = None

class PurchaseOrderCreate(PurchaseOrderBase):
    pass

class PurchaseOrderUpdate(BaseModel):
    po_number: Optional[str] = None
    product_id: Optional[int] = None
    order_date: Optional[date] = None
    expected_date: Optional[date] = None
    quantity: Optional[Decimal] = None
    status: Optional[str] = None
    received_date: Optional[date] = None
    received_quantity: Optional[Decimal] = None
    supplier: Optional[str] = None
    notes: Optional[str] = None

class PurchaseOrder(PurchaseOrderBase):
    id: int
    status: str
    received_date: Optional[date] = None
    received_quantity: Optional[Decimal] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    product_code: Optional[str] = None
    product_name: Optional[str] = None

    class Config:
        from_attributes = True

class PurchaseOrderReceive(BaseModel):
    received_date: date
    received_quantity: Decimal
    notes: Optional[str] = None
