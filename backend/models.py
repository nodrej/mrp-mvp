from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Date, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Product(Base):
    """Products table - both finished goods and components"""
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    type = Column(String(20), nullable=False)  # 'finished_good', 'sub_assembly', 'component', 'raw_material'
    uom = Column(String(10), nullable=False)
    reorder_point = Column(Numeric(15, 2), default=0)
    reorder_qty = Column(Numeric(15, 2), default=0)
    lead_time_days = Column(Integer, default=0)
    safety_stock = Column(Numeric(15, 2), default=0)  # Safety stock quantity
    order_multiple = Column(Numeric(15, 2), default=1)  # Must order in multiples of this
    minimum_order_qty = Column(Numeric(15, 2), default=0)  # Minimum order quantity
    critical_days = Column(Integer, default=7)  # Days threshold for critical urgency
    warning_days = Column(Integer, default=14)  # Days threshold for warning urgency
    caution_days = Column(Integer, default=30)  # Days threshold for caution urgency
    category = Column(String(50), nullable=True)  # Product family/category (e.g., 'L3 Components', 'Springs', 'Hardware')
    supplier = Column(String(100), nullable=True)  # Supplier name
    tags = Column(Text, nullable=True)  # JSON array of tags (e.g., '["long-lead", "shared-component"]')
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    bom_lines_as_parent = relationship("BOMLine", foreign_keys="BOMLine.parent_product_id", back_populates="parent_product")
    bom_lines_as_component = relationship("BOMLine", foreign_keys="BOMLine.component_product_id", back_populates="component_product")
    inventory = relationship("Inventory", back_populates="product", uselist=False)
    daily_demands = relationship("DailyDemand", back_populates="product")
    mrp_results = relationship("MRPResult", back_populates="product")

class BOMLine(Base):
    """Bill of Materials - component requirements for each product"""
    __tablename__ = "bom_lines"

    id = Column(Integer, primary_key=True, index=True)
    parent_product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    component_product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity_per = Column(Numeric(15, 4), nullable=False)

    __table_args__ = (
        UniqueConstraint('parent_product_id', 'component_product_id', name='uq_parent_component'),
    )

    # Relationships
    parent_product = relationship("Product", foreign_keys=[parent_product_id], back_populates="bom_lines_as_parent")
    component_product = relationship("Product", foreign_keys=[component_product_id], back_populates="bom_lines_as_component")

class Inventory(Base):
    """Current inventory balances"""
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), unique=True, nullable=False)
    on_hand = Column(Numeric(15, 2), default=0)
    allocated = Column(Numeric(15, 2), default=0)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    product = relationship("Product", back_populates="inventory")

    @property
    def available(self):
        """Calculate available quantity"""
        return float(self.on_hand) - float(self.allocated)

class DailyDemand(Base):
    """Daily demand forecast for products"""
    __tablename__ = "daily_demand"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    demand_date = Column(Date, nullable=False)
    quantity = Column(Numeric(15, 2), nullable=False)

    __table_args__ = (
        UniqueConstraint('product_id', 'demand_date', name='uq_product_date'),
    )

    # Relationships
    product = relationship("Product", back_populates="daily_demands")

class InventoryAdjustment(Base):
    """Track inventory adjustments"""
    __tablename__ = "inventory_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    adjustment_date = Column(DateTime(timezone=True), default=None, server_default=func.now())
    quantity_change = Column(Numeric(15, 2), nullable=False)
    reason = Column(String(200))
    notes = Column(Text)

class MRPResult(Base):
    """Cached MRP calculation results"""
    __tablename__ = "mrp_results"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    result_date = Column(Date, nullable=False)
    projected_onhand = Column(Numeric(15, 2))
    needs_ordering = Column(Boolean, default=False)
    shortage_date = Column(Date)
    calculated_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('product_id', 'result_date', name='uq_product_result_date'),
    )

    # Relationships
    product = relationship("Product", back_populates="mrp_results")

class SalesHistory(Base):
    """Daily sales history for products"""
    __tablename__ = "sales_history"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    sale_date = Column(Date, nullable=False)
    quantity_sold = Column(Numeric(15, 2), nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('product_id', 'sale_date', name='uq_product_sale_date'),
    )

    # Relationships
    product = relationship("Product")

class WeeklyShipment(Base):
    """Weekly shipment goals and actuals for products"""
    __tablename__ = "weekly_shipments"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    week_start_date = Column(Date, nullable=False)  # Monday of the week
    goal = Column(Numeric(15, 2), default=0)
    shipped = Column(Numeric(15, 2), default=0)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('product_id', 'week_start_date', name='uq_product_week'),
    )

    # Relationships
    product = relationship("Product")

class PurchaseOrder(Base):
    """Purchase Orders - tracking incoming inventory"""
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    po_number = Column(String(50), unique=True, nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    order_date = Column(Date, nullable=False)
    expected_date = Column(Date, nullable=False)
    quantity = Column(Numeric(15, 2), nullable=False)
    status = Column(String(20), default='pending')  # 'pending', 'received', 'cancelled'
    received_date = Column(Date)
    received_quantity = Column(Numeric(15, 2))
    supplier = Column(String(200))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    product = relationship("Product")
