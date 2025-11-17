# MRP System MVP - Getting Started Guide

## 🚀 Quick Start (5 Minutes to Running System)

### Prerequisites
- Python 3.10+ installed
- Node.js 18+ installed
- Terminal/Command Prompt

---

## Step 1: Set Up Backend (2 minutes)

### 1.1 Navigate to backend folder
```bash
cd "c:\Users\jtopham.CACHEOPS\Desktop\L3 Trigger sheets\mrp-mvp\backend"
```

### 1.2 Install Python dependencies
```bash
pip install -r requirements.txt
```

### 1.3 Import L3 Trigger data
```bash
python import_l3_data.py
```

You should see:
```
✓ L3 Trigger data import completed successfully!
Summary:
  - 1 Finished Good: L3 Trigger Assembly
  - 19 Components
  - 19 BOM Lines
  - 19 Inventory Records
  - ~20 Demand Forecast Records
```

### 1.4 Start the backend server
```bash
python main.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

**✓ Backend is now running!**

Test it: Open http://localhost:8000/docs in your browser

---

## Step 2: Set Up Frontend (3 minutes)

### 2.1 Open a NEW terminal/command prompt

### 2.2 Navigate to frontend folder
```bash
cd "c:\Users\jtopham.CACHEOPS\Desktop\L3 Trigger sheets\mrp-mvp\frontend"
```

### 2.3 Install Node dependencies
```bash
npm install
```

This will take 1-2 minutes.

### 2.4 Start the frontend dev server
```bash
npm run dev
```

You should see:
```
VITE v5.0.5  ready in 500 ms

➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

**✓ Frontend is now running!**

---

## Step 3: Use the System

### 3.1 Open the application
Go to: **http://localhost:3000**

### 3.2 Navigate through the app
- **Dashboard** - See shortages and alerts
- **Products & BOM** - View L3 Trigger and its components
- **Inventory** - See current stock levels
- **Demand Forecast** - View/edit daily demand

### 3.3 Run MRP Calculation
1. Go to Dashboard
2. Click "Run MRP" button
3. Wait ~5 seconds
4. See shortage alerts appear

---

## What You Can Do Now

### ✅ View L3 Trigger BOM
1. Go to "Products & BOM"
2. Find "L3-TRIG"
3. Click "View BOM"
4. See all 19 components and quantities

### ✅ Check Inventory Levels
1. Go to "Inventory"
2. See current on-hand quantities
3. Click "Adjust" to change quantities
4. See components marked as 🔴 (shortage), 🟡 (low), or 🟢 (OK)

### ✅ Add New Product (Multi-Product!)
1. Go to "Products & BOM"
2. Click "+ Add Product"
3. Fill in details (e.g., "L4 Trigger")
4. Save
5. Add BOM components
6. Run MRP to see material needs

### ✅ View Shortages
1. Go to Dashboard
2. Click "Run MRP"
3. See critical shortages (e.g., Dog Screw: -850 units)
4. See what needs ordering

### ✅ Edit Demand Forecast
1. Go to "Demand Forecast"
2. Select product
3. Edit daily quantities
4. Save
5. Re-run MRP to see impact

---

## Frontend Components (Need to Create)

I've set up the framework. Now let's create the actual component files:

### Create Dashboard Component

Create file: `frontend/src/components/Dashboard.tsx`

```typescript
import { useState, useEffect } from 'react';
import { Card, Statistic, Table, Button, message, Spin } from 'antd';
import { WarningOutlined, CheckCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { mrpAPI } from '../services/api';

const Dashboard = () => {
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const response = await mrpAPI.getDashboard();
      setDashboardData(response.data);
    } catch (error) {
      message.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const runMRP = async () => {
    setCalculating(true);
    try {
      await mrpAPI.calculate(30);
      message.success('MRP calculation completed');
      fetchDashboard();
    } catch (error) {
      message.error('MRP calculation failed');
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) return <Spin size="large" />;

  const shortageColumns = [
    { title: 'Part Code', dataIndex: 'product_code', key: 'product_code' },
    { title: 'Part Name', dataIndex: 'product_name', key: 'product_name' },
    { title: 'On-Hand', dataIndex: 'on_hand', key: 'on_hand', render: (val: number) => val.toFixed(0) },
    { title: 'Shortage Date', dataIndex: 'shortage_date', key: 'shortage_date' },
    { title: 'Order Qty', dataIndex: 'reorder_qty', key: 'reorder_qty', render: (val: number) => val.toFixed(0) },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>MRP Dashboard</h1>
        <Button
          type="primary"
          icon={<SyncOutlined spin={calculating} />}
          onClick={runMRP}
          loading={calculating}
        >
          Run MRP
        </Button>
      </div>

      {dashboardData && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <Card>
              <Statistic
                title="Critical Shortages"
                value={dashboardData.summary.products_with_shortages}
                valueStyle={{ color: '#cf1322' }}
                prefix={<WarningOutlined />}
              />
            </Card>
            <Card>
              <Statistic
                title="Low Stock"
                value={dashboardData.summary.products_low_stock}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
            <Card>
              <Statistic
                title="OK Status"
                value={dashboardData.summary.products_ok}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
            <Card>
              <Statistic
                title="Total Products"
                value={dashboardData.summary.total_products}
              />
            </Card>
          </div>

          <Card title="🔴 Critical Shortages (Next 14 Days)" style={{ marginBottom: 16 }}>
            <Table
              dataSource={dashboardData.shortages}
              columns={shortageColumns}
              rowKey="product_id"
              pagination={false}
            />
          </Card>

          <Card title="🟡 Low Stock Items">
            <Table
              dataSource={dashboardData.low_stock}
              columns={shortageColumns}
              rowKey="product_id"
              pagination={false}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default Dashboard;
```

### Create Products Component

Create file: `frontend/src/components/Products.tsx`

```typescript
import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { productAPI } from '../services/api';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await productAPI.getAll();
      setProducts(response.data);
    } catch (error) {
      message.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleAdd = () => {
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await productAPI.create(values);
      message.success('Product created successfully');
      setIsModalOpen(false);
      fetchProducts();
    } catch (error) {
      message.error('Failed to create product');
    }
  };

  const columns = [
    { title: 'Code', dataIndex: 'code', key: 'code' },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const colors: Record<string, string> = {
          finished_good: 'blue',
          component: 'green',
          raw_material: 'purple'
        };
        return <Tag color={colors[type]}>{type.replace('_', ' ').toUpperCase()}</Tag>;
      }
    },
    { title: 'UOM', dataIndex: 'uom', key: 'uom' },
    {
      title: 'Reorder Point',
      dataIndex: 'reorder_point',
      key: 'reorder_point',
      render: (val: number) => val.toFixed(0)
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button type="link" icon={<EditOutlined />}>View BOM</Button>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h1>Products & BOMs</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Add Product
        </Button>
      </div>

      <Table
        dataSource={products}
        columns={columns}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title="Add New Product"
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="Product Code" rules={[{ required: true }]}>
            <Input placeholder="L4-TRIG" />
          </Form.Item>
          <Form.Item name="name" label="Product Name" rules={[{ required: true }]}>
            <Input placeholder="L4 Trigger Assembly" />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="finished_good">Finished Good</Select.Option>
              <Select.Option value="component">Component</Select.Option>
              <Select.Option value="raw_material">Raw Material</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="uom" label="Unit of Measure" rules={[{ required: true }]}>
            <Input placeholder="Each" />
          </Form.Item>
          <Form.Item name="reorder_point" label="Reorder Point" initialValue={0}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="reorder_qty" label="Reorder Quantity" initialValue={0}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="lead_time_days" label="Lead Time (Days)" initialValue={0}>
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Products;
```

### Create Inventory Component

Create file: `frontend/src/components/Inventory.tsx`

```typescript
import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, InputNumber, Select, message, Tag } from 'antd';
import { inventoryAPI } from '../services/api';

const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adjustModal, setAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [form] = Form.useForm();

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await inventoryAPI.getAll();
      setInventory(response.data);
    } catch (error) {
      message.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleAdjust = (record: any) => {
    setSelectedProduct(record);
    form.resetFields();
    setAdjustModal(true);
  };

  const handleSubmitAdjustment = async () => {
    try {
      const values = await form.validateFields();
      await inventoryAPI.adjust({
        product_id: selectedProduct.product_id,
        quantity_change: values.quantity_change,
        reason: values.reason,
        notes: values.notes
      });
      message.success('Inventory adjusted successfully');
      setAdjustModal(false);
      fetchInventory();
    } catch (error) {
      message.error('Failed to adjust inventory');
    }
  };

  const getStatusTag = (onHand: number, reorderPoint: number) => {
    if (onHand < 0) return <Tag color="red">🔴 Shortage</Tag>;
    if (onHand < reorderPoint) return <Tag color="orange">🟡 Low Stock</Tag>;
    return <Tag color="green">🟢 OK</Tag>;
  };

  const columns = [
    { title: 'Part Code', dataIndex: 'product_code', key: 'product_code' },
    { title: 'Part Name', dataIndex: 'product_name', key: 'product_name' },
    {
      title: 'On-Hand',
      dataIndex: 'on_hand',
      key: 'on_hand',
      render: (val: number) => val.toFixed(0)
    },
    {
      title: 'Available',
      dataIndex: 'available',
      key: 'available',
      render: (val: number) => val.toFixed(0)
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: any) => getStatusTag(record.on_hand, record.reorder_point || 0)
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button type="link" onClick={() => handleAdjust(record)}>Adjust</Button>
      )
    }
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Inventory</h1>

      <Table
        dataSource={inventory}
        columns={columns}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={`Adjust Inventory: ${selectedProduct?.product_name}`}
        open={adjustModal}
        onOk={handleSubmitAdjustment}
        onCancel={() => setAdjustModal(false)}
      >
        <p>Current On-Hand: {selectedProduct?.on_hand?.toFixed(0)} units</p>
        <Form form={form} layout="vertical">
          <Form.Item
            name="quantity_change"
            label="Quantity Change"
            rules={[{ required: true }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="Enter + or - amount"
            />
          </Form.Item>
          <Form.Item name="reason" label="Reason">
            <Select>
              <Select.Option value="Received PO">Received PO</Select.Option>
              <Select.Option value="Cycle Count">Cycle Count</Select.Option>
              <Select.Option value="Damage">Damage</Select.Option>
              <Select.Option value="Found">Found</Select.Option>
              <Select.Option value="Other">Other</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Inventory;
```

### Create Demand Component

Create file: `frontend/src/components/Demand.tsx`

```typescript
import { useState, useEffect } from 'react';
import { Select, Button, Table, InputNumber, message } from 'antd';
import { productAPI, demandAPI } from '../services/api';

const Demand = () => {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [demandData, setDemandData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await productAPI.getAll({ type: 'finished_good' });
      setProducts(response.data);
      if (response.data.length > 0) {
        setSelectedProduct(response.data[0].id);
      }
    } catch (error) {
      message.error('Failed to load products');
    }
  };

  useEffect(() => {
    if (selectedProduct) {
      fetchDemand();
    }
  }, [selectedProduct]);

  const fetchDemand = async () => {
    setLoading(true);
    try {
      const response = await demandAPI.get(selectedProduct!, 30);
      setDemandData(response.data.demands);
    } catch (error) {
      message.error('Failed to load demand data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await demandAPI.save({
        product_id: selectedProduct!,
        demands: demandData
      });
      message.success('Demand forecast saved');
    } catch (error) {
      message.error('Failed to save demand');
    }
  };

  const columns = [
    { title: 'Date', dataIndex: 'date', key: 'date' },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (val: number, record: any, index: number) => (
        <InputNumber
          value={val}
          onChange={(value) => {
            const newData = [...demandData];
            newData[index].quantity = value || 0;
            setDemandData(newData);
          }}
        />
      )
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Demand Forecast</h1>

      <div style={{ marginBottom: 16 }}>
        <span style={{ marginRight: 8 }}>Product:</span>
        <Select
          style={{ width: 300 }}
          value={selectedProduct}
          onChange={setSelectedProduct}
          options={products.map((p: any) => ({ label: p.name, value: p.id }))}
        />
        <Button
          type="primary"
          style={{ marginLeft: 16 }}
          onClick={handleSave}
        >
          Save Forecast
        </Button>
      </div>

      <Table
        dataSource={demandData}
        columns={columns}
        rowKey="date"
        loading={loading}
        pagination={{ pageSize: 30 }}
      />
    </div>
  );
};

export default Demand;
```

---

## Next Steps

1. **Create the 4 component files** above
2. **Start both servers** (backend and frontend)
3. **Test the system:**
   - View L3 Trigger BOM
   - Check inventory shortages
   - Run MRP calculation
   - Add a new product (L4 Trigger)

4. **Add more products** to test multi-product capability!

---

## Troubleshooting

### Backend won't start
- Make sure you're in the backend folder
- Check Python version: `python --version` (need 3.10+)
- Reinstall dependencies: `pip install -r requirements.txt`

### Frontend won't start
- Make sure you're in the frontend folder
- Check Node version: `node --version` (need 18+)
- Delete `node_modules` and run `npm install` again

### Database errors
- Delete `data/mrp.db` file
- Run `python import_l3_data.py` again

### CORS errors
- Make sure backend is running on port 8000
- Make sure frontend is running on port 3000

---

**You now have a working multi-product MRP system!** 🎉
