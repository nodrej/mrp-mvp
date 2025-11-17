import { useEffect, useState, useMemo } from 'react';
import { Table, Button, Card, Tag, Modal, Form, InputNumber, Input, message, Radio, Space, Tooltip, Select, Dropdown, Collapse, Badge } from 'antd';
import { EditOutlined, SearchOutlined, DownloadOutlined, ShoppingCartOutlined, MoreOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { exportTableToCSV, getExportFilename } from '../utils/exportUtils';

const { Panel } = Collapse;

interface PendingOrder {
  po_number: string;
  quantity: number;
  expected_date: string;
  supplier?: string;
}

interface PendingInventory {
  product_id: number;
  product_code: string;
  product_name: string;
  total_pending: number;
  orders: PendingOrder[];
}

interface InventoryItem {
  id: number;
  product_id: number;
  product_code: string;
  product_name: string;
  on_hand: number;
  allocated: number;
  available: number;
  reorder_point: number;
  reorder_qty: number;
  product_type?: string;
  pending_incoming?: number;
  pending_orders?: PendingOrder[];
  category?: string | null;
  supplier?: string | null;
  lead_time_days?: number;
}

interface FinishedGood {
  id: number;
  code: string;
  name: string;
}

function Inventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [adjustmentMode, setAdjustmentMode] = useState<'change' | 'set'>('change');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [finishedGoods, setFinishedGoods] = useState<FinishedGood[]>([]);
  const [bomFilter, setBomFilter] = useState<number | null>(null);
  const [bomComponents, setBomComponents] = useState<Set<number>>(new Set());
  const [reasonType, setReasonType] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'grouped'>('grouped');
  const [form] = Form.useForm();

  const loadInventory = async () => {
    try {
      setLoading(true);

      // Load inventory and pending orders in parallel
      const [inventoryResponse, pendingResponse] = await Promise.all([
        axios.get('/api/inventory'),
        axios.get('/api/inventory/pending')
      ]);

      const inventoryData = inventoryResponse.data;
      const pendingData: PendingInventory[] = pendingResponse.data.pending_inventory || [];

      // Create a map of pending inventory by product_id
      const pendingMap = new Map<number, PendingInventory>();
      pendingData.forEach(pending => {
        pendingMap.set(pending.product_id, pending);
      });

      // Merge pending data with inventory
      const enrichedInventory = inventoryData.map((item: InventoryItem) => {
        const pending = pendingMap.get(item.product_id);
        return {
          ...item,
          pending_incoming: pending?.total_pending || 0,
          pending_orders: pending?.orders || []
        };
      });

      setInventory(enrichedInventory);
    } catch (error) {
      message.error('Error loading inventory');
    } finally {
      setLoading(false);
    }
  };

  const loadFinishedGoods = async () => {
    try {
      const response = await axios.get('/api/products');
      const fgProducts = response.data.filter((p: any) => p.type === 'finished_good');
      setFinishedGoods(fgProducts);
    } catch (error) {
      console.error('Error loading finished goods:', error);
    }
  };

  const loadBomForProduct = async (productId: number) => {
    try {
      const response = await axios.get(`/api/products/${productId}/bom`);
      const componentIds = new Set(response.data.map((item: any) => item.component_product_id));
      setBomComponents(componentIds);
    } catch (error) {
      console.error('Error loading BOM:', error);
      setBomComponents(new Set());
    }
  };

  useEffect(() => {
    loadInventory();
    loadFinishedGoods();
  }, []);

  useEffect(() => {
    if (bomFilter) {
      loadBomForProduct(bomFilter);
    } else {
      setBomComponents(new Set());
    }
  }, [bomFilter]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(inventory.map(i => i.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [inventory]);

  const handleAdjust = (item: InventoryItem) => {
    setSelectedItem(item);
    form.resetFields();
    setAdjustmentMode('change');
    setReasonType('');
    setModalVisible(true);
  };

  const handleSaveAdjustment = async () => {
    try {
      const values = await form.validateFields();

      // Calculate the quantity change based on adjustment mode
      let quantityChange = values.quantity_change;
      if (adjustmentMode === 'set' && selectedItem) {
        // User wants to set to a specific value, so calculate the delta
        const currentOnHand = typeof selectedItem.on_hand === 'string'
          ? parseFloat(selectedItem.on_hand)
          : selectedItem.on_hand;
        quantityChange = values.quantity_change - currentOnHand;
      }

      // Use custom reason if provided, otherwise use the selected reason
      const reason = values.reason_type === 'custom' ? values.custom_reason : values.reason_type;

      await axios.post('/api/inventory/adjust', {
        product_id: selectedItem?.product_id,
        quantity_change: quantityChange,
        reason: reason,
        notes: values.notes,
      });
      message.success('Inventory adjusted successfully');
      setModalVisible(false);
      loadInventory();
    } catch (error) {
      message.error('Error adjusting inventory');
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.available <= 0) {
      return { color: 'red', text: 'OUT OF STOCK' };
    }
    if (item.reorder_point && item.available < item.reorder_point) {
      return { color: 'orange', text: 'LOW STOCK' };
    }
    return { color: 'green', text: 'OK' };
  };

  const handleExportInventory = () => {
    if (filteredInventory && filteredInventory.length > 0) {
      exportTableToCSV(
        filteredInventory,
        columns,
        getExportFilename('inventory')
      );
    }
  };

  const columns = [
    {
      title: 'Product Code',
      dataIndex: 'product_code',
      key: 'product_code',
      width: 120,
    },
    {
      title: 'Product Name',
      dataIndex: 'product_name',
      key: 'product_name',
      width: 200,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 150,
      render: (category: string | null) => category ? <Tag color="blue">{category}</Tag> : <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: 'Supplier',
      dataIndex: 'supplier',
      key: 'supplier',
      width: 130,
      render: (supplier: string | null) => supplier || <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: 'On Hand',
      dataIndex: 'on_hand',
      key: 'on_hand',
      render: (val: number | string) => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return Math.round(num).toLocaleString();
      },
      align: 'right' as const,
    },
    {
      title: 'Allocated',
      dataIndex: 'allocated',
      key: 'allocated',
      render: (val: number | string) => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return Math.round(num).toLocaleString();
      },
      align: 'right' as const,
    },
    {
      title: 'Available',
      dataIndex: 'available',
      key: 'available',
      render: (val: number | string) => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return Math.round(num).toLocaleString();
      },
      align: 'right' as const,
    },
    {
      title: 'On Order',
      dataIndex: 'pending_incoming',
      key: 'pending_incoming',
      render: (val: number, record: InventoryItem) => {
        if (!val || val === 0) {
          return <span style={{ color: '#999' }}>-</span>;
        }

        const tooltipContent = (
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Pending Orders:</div>
            {record.pending_orders?.map((order, idx) => (
              <div key={idx} style={{ fontSize: '12px', marginBottom: 4 }}>
                <div><strong>{order.po_number}</strong></div>
                <div>Qty: {order.quantity.toLocaleString()}</div>
                <div>Expected: {dayjs(order.expected_date).format('MMM D, YYYY')}</div>
                {order.supplier && <div>Supplier: {order.supplier}</div>}
                {idx < (record.pending_orders?.length || 0) - 1 && <div style={{ borderTop: '1px solid #ddd', marginTop: 4, paddingTop: 4 }} />}
              </div>
            ))}
          </div>
        );

        return (
          <Tooltip title={tooltipContent}>
            <span style={{ color: '#1890ff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
              <ShoppingCartOutlined />
              {Math.round(val).toLocaleString()}
            </span>
          </Tooltip>
        );
      },
      align: 'right' as const,
    },
    {
      title: 'Reorder Point',
      dataIndex: 'reorder_point',
      key: 'reorder_point',
      render: (val: number | string | null) => {
        if (val === null || val === undefined) return '-';
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return isNaN(num) ? '-' : num.toFixed(0);
      },
      align: 'right' as const,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: InventoryItem) => {
        const status = getStockStatus(record);
        return <Tag color={status.color}>{status.text}</Tag>;
      },
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      fixed: 'right' as const,
      render: (_: any, record: InventoryItem) => (
        <Dropdown
          menu={{
            items: [
              {
                key: 'adjust',
                label: 'Adjust Inventory',
                icon: <EditOutlined />,
                onClick: () => handleAdjust(record),
              },
            ],
          }}
          trigger={['click']}
        >
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  // Filter inventory based on search, status, category, and BOM
  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      searchText === '' ||
      item.product_code.toLowerCase().includes(searchText.toLowerCase()) ||
      item.product_name.toLowerCase().includes(searchText.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(searchText.toLowerCase())) ||
      (item.supplier && item.supplier.toLowerCase().includes(searchText.toLowerCase()));

    const status = getStockStatus(item);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'low' && status.text === 'LOW STOCK') ||
      (statusFilter === 'out' && status.text === 'OUT OF STOCK') ||
      (statusFilter === 'ok' && status.text === 'OK');

    const matchesCategory =
      categoryFilter === 'all' ||
      (item.category === categoryFilter);

    const matchesBom = !bomFilter || bomComponents.has(item.product_id);

    return matchesSearch && matchesStatus && matchesCategory && matchesBom;
  });

  // Group inventory by category for grouped view
  const groupedInventory = useMemo(() => {
    const groups: { [key: string]: InventoryItem[] } = {};
    filteredInventory.forEach(item => {
      const category = item.category || 'Uncategorized';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });
    return groups;
  }, [filteredInventory]);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Inventory</h1>
        <Button icon={<DownloadOutlined />} onClick={handleExportInventory}>
          Export CSV
        </Button>
      </div>

      <Card>
        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size="large">
          <Input
            placeholder="Search by code, name, category, or supplier..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            size="large"
            allowClear
          />

          {/* Quick Filters */}
          <div>
            <span style={{ marginRight: 8, fontWeight: 500 }}>Quick Filters:</span>
            <Space wrap>
              <Tag
                color={categoryFilter === 'all' && statusFilter === 'all' ? 'blue' : 'default'}
                onClick={() => {
                  setCategoryFilter('all');
                  setStatusFilter('all');
                  setBomFilter(null);
                }}
                style={{ cursor: 'pointer' }}
              >
                All Items
              </Tag>
              <Tag
                color={categoryFilter === 'Springs' ? 'orange' : 'default'}
                onClick={() => setCategoryFilter(categoryFilter === 'Springs' ? 'all' : 'Springs')}
                style={{ cursor: 'pointer' }}
              >
                Springs ({inventory.filter(i => i.category === 'Springs').length})
              </Tag>
              <Tag
                color={categoryFilter === 'Hardware & Fasteners' ? 'purple' : 'default'}
                onClick={() => setCategoryFilter(categoryFilter === 'Hardware & Fasteners' ? 'all' : 'Hardware & Fasteners')}
                style={{ cursor: 'pointer' }}
              >
                Hardware ({inventory.filter(i => i.category === 'Hardware & Fasteners').length})
              </Tag>
              <Tag
                color={categoryFilter === 'L3 Components' ? 'blue' : 'default'}
                onClick={() => setCategoryFilter(categoryFilter === 'L3 Components' ? 'all' : 'L3 Components')}
                style={{ cursor: 'pointer' }}
              >
                L3 Components ({inventory.filter(i => i.category === 'L3 Components').length})
              </Tag>
              <Tag
                color={categoryFilter === 'Trigger Bodies' ? 'green' : 'default'}
                onClick={() => setCategoryFilter(categoryFilter === 'Trigger Bodies' ? 'all' : 'Trigger Bodies')}
                style={{ cursor: 'pointer' }}
              >
                Trigger Bodies ({inventory.filter(i => i.category === 'Trigger Bodies').length})
              </Tag>
            </Space>
          </div>

          {/* Filters Row 1 */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <span style={{ marginRight: 8, fontWeight: 500 }}>Status:</span>
              <Radio.Group
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                buttonStyle="solid"
                size="small"
              >
                <Radio.Button value="all">All</Radio.Button>
                <Radio.Button value="ok">OK</Radio.Button>
                <Radio.Button value="low">Low Stock</Radio.Button>
                <Radio.Button value="out">Out of Stock</Radio.Button>
              </Radio.Group>
            </div>

            <div>
              <span style={{ marginRight: 8, fontWeight: 500 }}>Category:</span>
              <Select
                value={categoryFilter}
                onChange={(value) => setCategoryFilter(value)}
                style={{ width: 180 }}
                size="small"
              >
                <Select.Option value="all">All Categories</Select.Option>
                {categories.map(cat => (
                  <Select.Option key={cat} value={cat}>{cat}</Select.Option>
                ))}
              </Select>
            </div>
          </div>

          {/* Filters Row 2 */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div>
              <span style={{ marginRight: 8, fontWeight: 500 }}>Filter by BOM:</span>
              <Select
                placeholder="Select finished good"
                style={{ width: 280 }}
                value={bomFilter}
                onChange={(value) => setBomFilter(value)}
                allowClear
                showSearch
                optionFilterProp="children"
                size="small"
              >
                {finishedGoods.map(fg => (
                  <Select.Option key={fg.id} value={fg.id}>
                    {fg.code} - {fg.name}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <div>
              <span style={{ marginRight: 8, fontWeight: 500 }}>View:</span>
              <Radio.Group
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                size="small"
                buttonStyle="solid"
              >
                <Radio.Button value="table">
                  <UnorderedListOutlined /> Table
                </Radio.Button>
                <Radio.Button value="grouped">
                  <AppstoreOutlined /> Grouped
                </Radio.Button>
              </Radio.Group>
            </div>
          </div>

          <div style={{ color: '#666', fontSize: '14px' }}>
            Showing {filteredInventory.length} of {inventory.length} items
            {(searchText || statusFilter !== 'all' || categoryFilter !== 'all' || bomFilter) && (
              <Button
                type="link"
                size="small"
                onClick={() => {
                  setSearchText('');
                  setStatusFilter('all');
                  setCategoryFilter('all');
                  setBomFilter(null);
                }}
              >
                Clear all filters
              </Button>
            )}
          </div>
        </Space>

        {/* Table or Grouped View */}
        {viewMode === 'table' ? (
          <Table
            dataSource={filteredInventory}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: filteredInventory.length,
              onChange: (page, newPageSize) => {
                setCurrentPage(page);
                if (newPageSize) setPageSize(newPageSize);
              },
              showSizeChanger: true,
              pageSizeOptions: ['10', '15', '20', '50', '100'],
              position: ['topRight', 'bottomRight'],
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
            }}
          />
        ) : (
          <Collapse defaultActiveKey={Object.keys(groupedInventory)}>
            {Object.entries(groupedInventory)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([category, items]) => (
                <Panel
                  header={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
                      <span style={{ fontSize: '16px', fontWeight: 500 }}>{category}</span>
                      <Badge count={items.length} style={{ backgroundColor: '#1890ff' }} />
                    </div>
                  }
                  key={category}
                >
                  <Table
                    dataSource={items}
                    columns={columns}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  />
                </Panel>
              ))}
          </Collapse>
        )}
      </Card>

      <Modal
        title={`Adjust Inventory: ${selectedItem?.product_name}`}
        open={modalVisible}
        onOk={handleSaveAdjustment}
        onCancel={() => setModalVisible(false)}
        width={500}
      >
        <div style={{ marginBottom: 16, padding: 12, background: '#f0f0f0', borderRadius: 4 }}>
          <p style={{ margin: 0 }}>
            <strong>Current On Hand:</strong> {selectedItem ? Math.round(typeof selectedItem.on_hand === 'string' ? parseFloat(selectedItem.on_hand) : selectedItem.on_hand).toLocaleString() : '0'}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Current Available:</strong> {selectedItem ? Math.round(typeof selectedItem.available === 'string' ? parseFloat(selectedItem.available) : selectedItem.available).toLocaleString() : '0'}
          </p>
        </div>

        <Form form={form} layout="vertical">
          <Form.Item label="Adjustment Type">
            <Radio.Group
              value={adjustmentMode}
              onChange={(e) => setAdjustmentMode(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="change">Change By Amount</Radio.Button>
              <Radio.Button value="set">Set To Value</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="quantity_change"
            label={adjustmentMode === 'change' ? 'Quantity Change' : 'New Quantity'}
            rules={[{ required: true, message: adjustmentMode === 'change' ? 'Please enter quantity change' : 'Please enter new quantity' }]}
            help={adjustmentMode === 'change'
              ? 'Enter positive number to add, negative to subtract'
              : 'Enter the exact quantity you want to set inventory to'}
          >
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="reason_type"
            label="Reason"
            rules={[{ required: true, message: 'Please select a reason' }]}
          >
            <Select
              placeholder="Select a reason"
              onChange={(value) => {
                setReasonType(value);
                if (value !== 'custom') {
                  form.setFieldValue('custom_reason', undefined);
                }
              }}
            >
              <Select.Option value="Physical count">Physical count</Select.Option>
              <Select.Option value="Cycle count adjustment">Cycle count adjustment</Select.Option>
              <Select.Option value="Damaged goods">Damaged goods</Select.Option>
              <Select.Option value="Scrap">Scrap</Select.Option>
              <Select.Option value="Found inventory">Found inventory</Select.Option>
              <Select.Option value="Correction">Correction</Select.Option>
              <Select.Option value="Return to supplier">Return to supplier</Select.Option>
              <Select.Option value="custom">Custom reason...</Select.Option>
            </Select>
          </Form.Item>

          {reasonType === 'custom' && (
            <Form.Item
              name="custom_reason"
              label="Custom Reason"
              rules={[{ required: true, message: 'Please enter custom reason' }]}
            >
              <Input placeholder="Enter your reason" />
            </Form.Item>
          )}
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Additional notes (optional)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Inventory;
