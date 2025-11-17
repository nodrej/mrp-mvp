import { useEffect, useState, useMemo } from 'react';
import { Table, Button, Card, Tag, Space, Modal, Form, Input, Select, InputNumber, message, Radio, Checkbox, Collapse, Badge, Tooltip, Dropdown } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, DownloadOutlined, SearchOutlined, AppstoreOutlined, UnorderedListOutlined, MoreOutlined, EyeOutlined } from '@ant-design/icons';
import axios from 'axios';
import { exportTableToCSV, getExportFilename } from '../utils/exportUtils';

const { Panel } = Collapse;

interface Product {
  id: number;
  code: string;
  name: string;
  type: string;
  uom: string;
  reorder_point: number;
  reorder_qty: number;
  lead_time_days: number;
  safety_stock: number;
  order_multiple: number;
  minimum_order_qty: number;
  critical_days: number;
  warning_days: number;
  caution_days: number;
  category: string | null;
  supplier: string | null;
  tags: string | null;
  is_active: boolean;
}

interface BOMLine {
  component_product_id: number;
  component_code: string;
  component_name: string;
  quantity_per: number;
}

function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [bomModalVisible, setBomModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [bom, setBom] = useState<BOMLine[]>([]);
  const [editingBom, setEditingBom] = useState(false);
  const [bomSaving, setBomSaving] = useState(false);

  // Filter states
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [leadTimeFilter, setLeadTimeFilter] = useState<string>('all');
  const [showSharedOnly, setShowSharedOnly] = useState(false);
  const [bomFilter, setBomFilter] = useState<number | null>(null);
  const [bomComponents, setBomComponents] = useState<Set<number>>(new Set());

  // UI states
  const [viewMode, setViewMode] = useState<'table' | 'grouped'>('grouped');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [form] = Form.useForm();

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/products');
      setProducts(response.data);
    } catch (error) {
      message.error('Error loading products');
    } finally {
      setLoading(false);
    }
  };

  const loadBOM = async (productId: number) => {
    try {
      const response = await axios.get(`/api/products/${productId}/bom`);
      setBom(response.data.components || response.data);
    } catch (error) {
      message.error('Error loading BOM');
    }
  };

  const loadBomForFilter = async (productId: number) => {
    try {
      const response = await axios.get(`/api/products/${productId}/bom`);
      const bomData = response.data.components || response.data;
      const componentIds = new Set(bomData.map((item: any) => item.component_product_id));
      setBomComponents(componentIds);
    } catch (error) {
      console.error('Error loading BOM for filter:', error);
      setBomComponents(new Set());
    }
  };

  useEffect(() => {
    if (bomFilter) {
      loadBomForFilter(bomFilter);
    } else {
      setBomComponents(new Set());
    }
  }, [bomFilter]);

  useEffect(() => {
    loadProducts();
  }, []);

  // Calculate usage count for each component (how many products use it)
  const componentUsage = useMemo(() => {
    const usage = new Map<number, number>();
    products.forEach(product => {
      if (product.type === 'finished_good' || product.type === 'sub_assembly') {
        // Would need to load BOMs to calculate accurately, for now just mark potential parents
      }
    });
    return usage;
  }, [products]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [products]);

  const handleAddProduct = () => {
    form.resetFields();
    setSelectedProduct(null);
    setModalVisible(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    form.setFieldsValue({
      ...product,
      tags: product.tags ? JSON.parse(product.tags).join(', ') : '',
    });
    setModalVisible(true);
  };

  const handleSaveProduct = async () => {
    try {
      const values = await form.validateFields();

      // Convert tags from comma-separated string to JSON array
      if (values.tags) {
        const tagsArray = values.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
        values.tags = JSON.stringify(tagsArray);
      }

      if (selectedProduct) {
        await axios.put(`/api/products/${selectedProduct.id}`, values);
        message.success('Product updated successfully');
      } else {
        await axios.post('/api/products', values);
        message.success('Product created successfully');
      }
      setModalVisible(false);
      loadProducts();
    } catch (error) {
      message.error('Error saving product');
    }
  };

  const handleDeleteProduct = (product: Product) => {
    Modal.confirm({
      title: 'Delete Product',
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to delete "${product.name}" (${product.code})? This will perform a soft delete and the product will no longer be active.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await axios.delete(`/api/products/${product.id}`);
          message.success('Product deleted successfully');
          loadProducts();
        } catch (error) {
          message.error('Error deleting product. It may be in use by other records.');
        }
      },
    });
  };

  const handleViewBOM = async (product: Product) => {
    setSelectedProduct(product);
    await loadBOM(product.id);
    setEditingBom(false);
    setBomModalVisible(true);
  };

  const handleAddBOMLine = () => {
    const newLine: BOMLine = {
      component_product_id: 0,
      component_code: '',
      component_name: '',
      quantity_per: 1,
    };
    setBom([...bom, newLine]);
  };

  const handleRemoveBOMLine = (index: number) => {
    const newBom = bom.filter((_, i) => i !== index);
    setBom(newBom);
  };

  const handleBOMQuantityChange = (index: number, value: number | null) => {
    const newBom = [...bom];
    newBom[index].quantity_per = value || 0;
    setBom(newBom);
  };

  const handleBOMComponentChange = (index: number, productId: number) => {
    const selectedComponent = products.find((p) => p.id === productId);
    if (selectedComponent) {
      const newBom = [...bom];
      newBom[index].component_product_id = selectedComponent.id;
      newBom[index].component_code = selectedComponent.code;
      newBom[index].component_name = selectedComponent.name;
      setBom(newBom);
    }
  };

  const handleSaveBOM = async () => {
    if (!selectedProduct) return;

    try {
      setBomSaving(true);
      await axios.post(`/api/products/${selectedProduct.id}/bom`, {
        components: bom.map((line) => ({
          component_product_id: line.component_product_id,
          quantity_per: line.quantity_per,
        })),
      });
      message.success('BOM saved successfully');
      setEditingBom(false);
      await loadBOM(selectedProduct.id);
    } catch (error) {
      message.error('Error saving BOM');
    } finally {
      setBomSaving(false);
    }
  };

  const handleExportProducts = () => {
    if (filteredProducts && filteredProducts.length > 0) {
      exportTableToCSV(
        filteredProducts,
        columns,
        getExportFilename('products')
      );
    }
  };

  // Enhanced filtering logic
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Search filter
      if (searchText) {
        const search = searchText.toLowerCase();
        const matchesSearch =
          product.code.toLowerCase().includes(search) ||
          product.name.toLowerCase().includes(search) ||
          (product.category && product.category.toLowerCase().includes(search)) ||
          (product.supplier && product.supplier.toLowerCase().includes(search));
        if (!matchesSearch) return false;
      }

      // Type filter
      const matchesType =
        productTypeFilter === 'all' ||
        (productTypeFilter === 'finished_good' && product.type === 'finished_good') ||
        (productTypeFilter === 'sub_assembly' && product.type === 'sub_assembly') ||
        (productTypeFilter === 'component' && product.type === 'component');
      if (!matchesType) return false;

      // Category filter
      const matchesCategory =
        categoryFilter === 'all' ||
        (product.category === categoryFilter);
      if (!matchesCategory) return false;

      // Lead time filter
      const matchesLeadTime =
        leadTimeFilter === 'all' ||
        (leadTimeFilter === 'short' && product.lead_time_days <= 7) ||
        (leadTimeFilter === 'medium' && product.lead_time_days > 7 && product.lead_time_days <= 30) ||
        (leadTimeFilter === 'long' && product.lead_time_days > 30 && product.lead_time_days <= 60) ||
        (leadTimeFilter === 'very_long' && product.lead_time_days > 60);
      if (!matchesLeadTime) return false;

      // BOM filter
      const matchesBom = !bomFilter || bomComponents.has(product.id);
      if (!matchesBom) return false;

      return true;
    });
  }, [products, searchText, productTypeFilter, categoryFilter, leadTimeFilter, bomFilter, bomComponents]);

  // Group products by category for grouped view
  const groupedProducts = useMemo(() => {
    const groups: { [key: string]: Product[] } = {};
    filteredProducts.forEach(product => {
      const category = product.category || 'Uncategorized';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(product);
    });
    return groups;
  }, [filteredProducts]);

  const getLeadTimeColor = (days: number) => {
    if (days <= 7) return '#52c41a';
    if (days <= 30) return '#faad14';
    if (days <= 60) return '#fa8c16';
    return '#f5222d';
  };

  const getLeadTimeBadge = (days: number) => {
    if (days <= 7) return { text: 'Short', color: 'green' };
    if (days <= 30) return { text: 'Medium', color: 'orange' };
    if (days <= 60) return { text: 'Long', color: 'volcano' };
    return { text: 'Very Long', color: 'red' };
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 180,
      render: (category: string | null) => category ? <Tag color="blue">{category}</Tag> : <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (type: string) => {
        let color = 'green';
        let label = 'Component';
        if (type === 'finished_good') {
          color = 'blue';
          label = 'Finished Good';
        } else if (type === 'sub_assembly') {
          color = 'purple';
          label = 'Sub-Assembly';
        }
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: 'Lead Time',
      dataIndex: 'lead_time_days',
      key: 'lead_time_days',
      width: 110,
      render: (days: number) => {
        const badge = getLeadTimeBadge(days);
        return (
          <Tooltip title={`${days} days`}>
            <Tag color={badge.color} style={{ minWidth: 70, textAlign: 'center' }}>
              {days}d
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Supplier',
      dataIndex: 'supplier',
      key: 'supplier',
      width: 150,
      render: (supplier: string | null) => supplier || <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      fixed: 'right' as const,
      render: (_: any, record: Product) => {
        const menuItems = [
          {
            key: 'edit',
            label: 'Edit Product',
            icon: <EditOutlined />,
            onClick: () => handleEditProduct(record),
          },
        ];

        // Only add BOM option for finished goods and sub-assemblies
        if (record.type === 'finished_good' || record.type === 'sub_assembly') {
          menuItems.push({
            key: 'bom',
            label: 'View BOM',
            icon: <EyeOutlined />,
            onClick: () => handleViewBOM(record),
          });
        }

        menuItems.push(
          {
            key: 'divider',
            type: 'divider' as const,
          } as any,
          {
            key: 'delete',
            label: 'Delete',
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => handleDeleteProduct(record),
          }
        );

        return (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={['click']}
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        );
      },
    },
  ];

  const componentOptions = products
    .filter((p) => p.type === 'component' || p.type === 'sub_assembly')
    .map((p) => ({
      value: p.id,
      label: `${p.code} - ${p.name}`,
    }));

  const bomColumns = [
    {
      title: 'Component',
      dataIndex: 'component_code',
      key: 'component',
      render: (code: string, record: BOMLine, index: number) => {
        if (editingBom) {
          return (
            <Select
              style={{ width: '100%' }}
              value={record.component_product_id || undefined}
              onChange={(value) => handleBOMComponentChange(index, value)}
              options={componentOptions}
              placeholder="Select component"
              showSearch
              optionFilterProp="label"
            />
          );
        }
        return `${code} - ${record.component_name}`;
      },
    },
    {
      title: 'Quantity Per',
      dataIndex: 'quantity_per',
      key: 'quantity_per',
      width: 150,
      render: (val: number | string, record: BOMLine, index: number) => {
        if (editingBom) {
          const num = typeof val === 'string' ? parseFloat(val) : val;
          return (
            <InputNumber
              style={{ width: '100%' }}
              value={num}
              onChange={(value) => handleBOMQuantityChange(index, value)}
              min={0}
              step={0.01}
            />
          );
        }
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return Math.round(num).toLocaleString();
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_: any, record: BOMLine, index: number) => {
        if (editingBom) {
          return (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleRemoveBOMLine(index)}
            />
          );
        }
        return null;
      },
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Products & BOM</h1>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExportProducts}>
            Export CSV
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddProduct}>
            Add Product
          </Button>
        </Space>
      </div>

      <Card>
        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size="large">
          {/* Search Bar */}
          <Input
            placeholder="Search by code, name, category, or supplier..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            size="large"
            style={{ width: '100%' }}
          />

          {/* Quick Filters */}
          <div>
            <span style={{ marginRight: 8, fontWeight: 500 }}>Quick Filters:</span>
            <Space wrap>
              <Tag
                color={categoryFilter === 'all' && leadTimeFilter === 'all' ? 'blue' : 'default'}
                onClick={() => {
                  setCategoryFilter('all');
                  setLeadTimeFilter('all');
                  setProductTypeFilter('all');
                }}
                style={{ cursor: 'pointer' }}
              >
                All Products
              </Tag>
              <Tag
                color={leadTimeFilter === 'very_long' ? 'red' : 'default'}
                onClick={() => setLeadTimeFilter(leadTimeFilter === 'very_long' ? 'all' : 'very_long')}
                style={{ cursor: 'pointer' }}
              >
                Long Lead ({products.filter(p => p.lead_time_days > 60).length})
              </Tag>
              <Tag
                color={categoryFilter === 'Springs' ? 'orange' : 'default'}
                onClick={() => setCategoryFilter(categoryFilter === 'Springs' ? 'all' : 'Springs')}
                style={{ cursor: 'pointer' }}
              >
                Springs ({products.filter(p => p.category === 'Springs').length})
              </Tag>
              <Tag
                color={categoryFilter === 'Hardware & Fasteners' ? 'purple' : 'default'}
                onClick={() => setCategoryFilter(categoryFilter === 'Hardware & Fasteners' ? 'all' : 'Hardware & Fasteners')}
                style={{ cursor: 'pointer' }}
              >
                Hardware ({products.filter(p => p.category === 'Hardware & Fasteners').length})
              </Tag>
            </Space>
          </div>

          {/* Filters Row 1 */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <span style={{ marginRight: 8, fontWeight: 500 }}>Type:</span>
              <Radio.Group
                value={productTypeFilter}
                onChange={(e) => setProductTypeFilter(e.target.value)}
                buttonStyle="solid"
                size="small"
              >
                <Radio.Button value="all">All</Radio.Button>
                <Radio.Button value="finished_good">Finished Goods</Radio.Button>
                <Radio.Button value="sub_assembly">Sub-Assemblies</Radio.Button>
                <Radio.Button value="component">Components</Radio.Button>
              </Radio.Group>
            </div>

            <div>
              <span style={{ marginRight: 8, fontWeight: 500 }}>Category:</span>
              <Select
                value={categoryFilter}
                onChange={(value) => setCategoryFilter(value)}
                style={{ width: 200 }}
                size="small"
              >
                <Select.Option value="all">All Categories</Select.Option>
                {categories.map(cat => (
                  <Select.Option key={cat} value={cat}>{cat}</Select.Option>
                ))}
              </Select>
            </div>

            <div>
              <span style={{ marginRight: 8, fontWeight: 500 }}>Lead Time:</span>
              <Select
                value={leadTimeFilter}
                onChange={(value) => setLeadTimeFilter(value)}
                style={{ width: 150 }}
                size="small"
              >
                <Select.Option value="all">All Lead Times</Select.Option>
                <Select.Option value="short">Short (≤7d)</Select.Option>
                <Select.Option value="medium">Medium (8-30d)</Select.Option>
                <Select.Option value="long">Long (31-60d)</Select.Option>
                <Select.Option value="very_long">Very Long (&gt;60d)</Select.Option>
              </Select>
            </div>
          </div>

          {/* Filters Row 2 */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div>
              <span style={{ marginRight: 8, fontWeight: 500 }}>Filter by BOM:</span>
              <Select
                placeholder="Select a finished good"
                style={{ width: 300 }}
                value={bomFilter}
                onChange={(value) => setBomFilter(value)}
                allowClear
                showSearch
                optionFilterProp="children"
                size="small"
              >
                {products
                  .filter(p => p.type === 'finished_good')
                  .map(fg => (
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

          {/* Results Count */}
          <div style={{ color: '#666', fontSize: '14px' }}>
            Showing {filteredProducts.length} of {products.length} products
            {(searchText || categoryFilter !== 'all' || leadTimeFilter !== 'all' || bomFilter) && (
              <Button
                type="link"
                size="small"
                onClick={() => {
                  setSearchText('');
                  setCategoryFilter('all');
                  setLeadTimeFilter('all');
                  setBomFilter(null);
                  setProductTypeFilter('all');
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
            dataSource={filteredProducts}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: filteredProducts.length,
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
          <Collapse defaultActiveKey={Object.keys(groupedProducts)}>
            {Object.entries(groupedProducts)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([category, prods]) => (
                <Panel
                  header={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
                      <span style={{ fontSize: '16px', fontWeight: 500 }}>{category}</span>
                      <Badge count={prods.length} style={{ backgroundColor: '#1890ff' }} />
                    </div>
                  }
                  key={category}
                >
                  <Table
                    dataSource={prods}
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

      {/* Product Form Modal */}
      <Modal
        title={selectedProduct ? 'Edit Product' : 'Add Product'}
        open={modalVisible}
        onOk={handleSaveProduct}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Form.Item name="code" label="Product Code" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="type" label="Type" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="finished_good">Finished Good</Select.Option>
                <Select.Option value="sub_assembly">Sub-Assembly</Select.Option>
                <Select.Option value="component">Component</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item name="name" label="Product Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <Form.Item name="uom" label="Unit of Measure" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="category" label="Category">
              <Select allowClear>
                {categories.map(cat => (
                  <Select.Option key={cat} value={cat}>{cat}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="supplier" label="Supplier">
              <Input />
            </Form.Item>
          </div>

          <Form.Item name="tags" label="Tags" tooltip="Comma-separated tags (e.g., long-lead, critical)">
            <Input placeholder="long-lead, critical, shared-component" />
          </Form.Item>

          <div style={{ background: '#f5f5f5', padding: '16px', marginBottom: '16px', borderRadius: '4px' }}>
            <h4 style={{ marginTop: 0, marginBottom: '12px' }}>MRP Planning Parameters</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Form.Item name="reorder_point" label="Reorder Point">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
              <Form.Item name="reorder_qty" label="Reorder Quantity">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
              <Form.Item name="lead_time_days" label="Lead Time (days)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
              <Form.Item name="safety_stock" label="Safety Stock">
                <InputNumber style={{ width: '100%' }} min={0} defaultValue={0} />
              </Form.Item>
              <Form.Item name="order_multiple" label="Order Multiple">
                <InputNumber style={{ width: '100%' }} min={1} defaultValue={1} />
              </Form.Item>
              <Form.Item name="minimum_order_qty" label="Minimum Order Qty">
                <InputNumber style={{ width: '100%' }} min={0} defaultValue={0} />
              </Form.Item>
            </div>
          </div>

          <div style={{ background: '#fff7e6', padding: '16px', borderRadius: '4px', border: '1px solid #ffd591' }}>
            <h4 style={{ marginTop: 0, marginBottom: '12px' }}>Urgency Thresholds</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <Form.Item name="critical_days" label="Critical Days" initialValue={7}>
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
              <Form.Item name="warning_days" label="Warning Days" initialValue={14}>
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
              <Form.Item name="caution_days" label="Caution Days" initialValue={30}>
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </div>
          </div>
        </Form>
      </Modal>

      {/* BOM Modal */}
      <Modal
        title={`BOM for ${selectedProduct?.name}`}
        open={bomModalVisible}
        onCancel={() => {
          setBomModalVisible(false);
          setEditingBom(false);
        }}
        footer={
          editingBom
            ? [
                <Button
                  key="add"
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={handleAddBOMLine}
                >
                  Add Component
                </Button>,
                <Button key="cancel" onClick={() => setEditingBom(false)}>
                  Cancel
                </Button>,
                <Button
                  key="save"
                  type="primary"
                  loading={bomSaving}
                  onClick={handleSaveBOM}
                >
                  Save BOM
                </Button>,
              ]
            : [
                <Button
                  key="edit"
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => setEditingBom(true)}
                >
                  Edit BOM
                </Button>,
                <Button key="close" onClick={() => setBomModalVisible(false)}>
                  Close
                </Button>,
              ]
        }
        width={800}
      >
        <Table
          dataSource={bom}
          columns={bomColumns}
          rowKey={(record) => record.component_product_id ? `bom-${record.component_product_id}` : `bom-new-${Math.random()}`}
          pagination={false}
        />
      </Modal>
    </div>
  );
}

export default Products;
