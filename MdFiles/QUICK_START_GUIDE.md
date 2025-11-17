# Quick Start Guide - New MRP Features

## 🚀 Getting Started in 5 Minutes

### Step 1: Run Database Migration

```bash
cd backend
python migrate_add_mrp_fields.py
```

Answer `yes` when prompted. This adds the new MRP fields to your database.

---

### Step 2: Restart Your Application

**Backend:**
```bash
cd backend
python main.py
```

**Frontend (in a new terminal):**
```bash
cd frontend
npm run dev
```

---

### Step 3: Configure Your First Product

1. Open the application: http://localhost:3000
2. Navigate to **Products & BOM**
3. Click **Edit** on any component (e.g., Dog Screw)
4. Scroll to the **MRP Planning Parameters** section
5. Fill in the new fields:

```
✓ Reorder Point: 12,100
✓ Reorder Quantity: 10,000
✓ Lead Time (days): 22
✓ Safety Stock: 2,000        ← NEW!
✓ Order Multiple: 1,000      ← NEW!
✓ Minimum Order Qty: 5,000   ← NEW!
```

6. Click **OK** to save

---

### Step 4: Test the Features

#### A. Test Lead Time Integration
1. Go to **Dashboard**
2. Click **Run MRP Calculation**
3. View **Material Shortages** table
4. Look for the **"Order By"** information in alerts
5. System now tells you WHEN to order, not just WHAT to order!

#### B. Test Lot Sizing
1. Check shortage recommendations
2. Notice **"Recommended Order Qty"** may differ from base reorder quantity
3. This is the system applying lot sizing rules automatically

#### C. Test Multi-Level BOM
1. Create a sub-assembly:
   - Type: **Sub-Assembly**
   - Code: `TEST-SUB`
   - Name: `Test Sub-Assembly`
2. Add BOM to sub-assembly with components
3. Create a finished good that uses this sub-assembly
4. Run MRP calculation
5. System automatically explodes the sub-assembly → components

---

## 📖 Field Definitions

### Safety Stock
**What**: Buffer inventory to protect against demand spikes and delivery delays
**When to use**: High for critical parts, low for easily available parts
**Example**: 2,000 units = ~4 days of production buffer

### Order Multiple
**What**: Quantity you must order in multiples of (e.g., case packs, pallet quantities)
**When to use**: When supplier requires orders in specific increments
**Example**: Order Multiple = 100 means you can order 100, 200, 300... but not 150

### Minimum Order Quantity (MOQ)
**What**: Smallest quantity the supplier will accept
**When to use**: When supplier has minimum order policies
**Example**: MOQ = 5,000 means you must order at least 5,000 units

---

## 💡 Quick Tips

### Tip 1: Start with Conservative Safety Stock
- **High-value items**: 1-2 weeks usage
- **Critical items**: 2-4 weeks usage
- **Easily available items**: < 1 week usage

### Tip 2: Get Order Multiples from Supplier
Ask your supplier:
- "What's your minimum order quantity?"
- "Do you have case/pallet quantities?"
- "Can I order any quantity or specific increments?"

### Tip 3: Update Lead Times Regularly
Track actual delivery times and update your lead times:
- Add 1-2 days buffer for safety
- Account for customs/shipping time
- Consider supplier's production schedule

### Tip 4: Review Order By Dates Daily
The **Order By Date** is when you MUST place the order to avoid stockout:
- ✅ Order by date is today → Order NOW
- ⚠️ Order by date is in 1-3 days → Schedule PO soon
- ℹ️ Order by date is > 7 days → Monitor

---

## 🎯 Common Scenarios

### Scenario 1: Urgent Shortage Alert

**Alert Shows:**
```
Product: DOG-SCR
Order By Date: TODAY
Shortage Date: In 22 days
Recommended Qty: 10,000
```

**Action:**
1. Create purchase order for 10,000 units TODAY
2. Contact supplier to confirm lead time
3. Update product if lead time has changed

---

### Scenario 2: Lot Sizing Adjustment

**You need:** 7,250 units
**Supplier requires:** Multiples of 1,000, minimum 5,000

**System recommends:** 8,000 units
- ✓ Meets minimum (8,000 ≥ 5,000)
- ✓ Multiple of 1,000 (8,000 / 1,000 = 8)
- ✓ Covers need (8,000 ≥ 7,250)

**Action:** Order 8,000 units as recommended

---

### Scenario 3: Sub-Assembly BOM

**You have:**
```
L3 Trigger
├─ Trigger Housing (Sub-Assembly)
│  ├─ Housing Body × 1
│  └─ Screws × 4
└─ Spring × 1
```

**You order:** 100 L3 Triggers

**System calculates automatically:**
- 100 Trigger Housing (sub-assembly qty)
- 100 Housing Body (1 per housing × 100)
- 400 Screws (4 per housing × 100)
- 100 Springs (1 per trigger × 100)

**No manual calculation needed!**

---

## 🔍 Troubleshooting

### Issue: Migration Script Says "Database Not Found"

**Solution:** Run the backend first to create database:
```bash
cd backend
python import_l3_data.py  # Creates database with L3 data
python migrate_add_mrp_fields.py  # Then run migration
```

---

### Issue: New Fields Not Showing in Frontend

**Solution:** Hard refresh the browser:
- Chrome/Edge: `Ctrl + Shift + R`
- Firefox: `Ctrl + F5`
- Mac: `Cmd + Shift + R`

If still not working, rebuild frontend:
```bash
cd frontend
npm run build
```

---

### Issue: Order By Date Seems Wrong

**Check:**
1. Lead time is correct (in days, not weeks)
2. Demand forecast is up to date
3. Current inventory is accurate

**Formula:**
```
Order By Date = Shortage Date - Lead Time Days
```

Example: Shortage on Dec 20, Lead Time 30 days → Order by Nov 20

---

## 📞 Support

For questions or issues with the new features, check:
- Full documentation: `MRP_IMPROVEMENTS_SUMMARY.md`
- Code review report: Your code review document
- Source code: `backend/mrp.py` for calculation logic

---

## ✅ Checklist: I'm Ready to Use the New Features

- [ ] Ran database migration successfully
- [ ] Restarted backend and frontend
- [ ] Can see "MRP Planning Parameters" section in product form
- [ ] Configured at least one product with new fields
- [ ] Ran MRP calculation and see order-by dates in alerts
- [ ] Understand what safety stock, order multiple, and MOQ mean

**If all checked, you're ready to go!** 🎉
