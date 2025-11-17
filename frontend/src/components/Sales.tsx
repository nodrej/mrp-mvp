import { useEffect, useState, useCallback } from 'react';
import { Card, Select, Button, Table, InputNumber, message, Statistic, Row, Col, Segmented, Alert, Space } from 'antd';
import { SaveOutlined, ShoppingOutlined, BarChartOutlined, CalendarOutlined, RiseOutlined, DownloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { exportTableToCSV, getExportFilename } from '../utils/exportUtils';

// Simple debounce function
function debounce<T extends (...args: any[]) => any>(func: T, delay: number) {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

interface Product {
  id: number;
  code: string;
  name: string;
}

interface SalesRow {
  date: string;
  quantity: number;
  notes: string;
}

interface ProductSummary {
  product_id: number;
  product_code: string;
  product_name: string;
  total_sold: number;
}

function Sales() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [salesData, setSalesData] = useState<SalesRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [summaryData, setSummaryData] = useState<ProductSummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'entry' | 'analytics'>('entry');
  const [daysFilter, setDaysFilter] = useState<number>(30);

  const loadProducts = async () => {
    try {
      const response = await axios.get('/api/products');
      const finishedGoods = response.data.filter((p: any) => p.type === 'finished_good');
      setProducts(finishedGoods);
      if (finishedGoods.length > 0) {
        setSelectedProductId(finishedGoods[0].id);
      }
    } catch (error) {
      message.error('Error loading products');
    }
  };

  const loadSales = async (productId: number) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/sales/${productId}?days=${daysFilter}`);
      const existingSales = response.data.sales || response.data;

      // Generate full date range from today back to daysFilter days ago
      const dateRange: SalesRow[] = [];
      for (let i = 0; i < daysFilter; i++) {
        const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
        const existingRecord = existingSales.find((s: SalesRow) => s.date === date);
        dateRange.push({
          date,
          quantity: existingRecord?.quantity || 0,
          notes: existingRecord?.notes || ''
        });
      }

      // Sort by date descending (most recent first)
      dateRange.sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix());

      setSalesData(dateRange);
      setHasUnsavedChanges(false);
    } catch (error) {
      message.error('Error loading sales history');
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      setSummaryLoading(true);
      const response = await axios.get(`/api/sales/summary?days=${daysFilter}`);
      setSummaryData(response.data.summary || []);
    } catch (error) {
      message.error('Error loading sales summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (selectedProductId && viewMode === 'entry') {
      loadSales(selectedProductId);
    }
  }, [selectedProductId, daysFilter, viewMode]);

  useEffect(() => {
    if (viewMode === 'analytics') {
      loadSummary();
    }
  }, [viewMode, daysFilter]);

  // Auto-save function with debounce
  const autoSave = useCallback(
    debounce(async (productId: number, data: SalesRow[]) => {
      try {
        setAutoSaving(true);
        await axios.post('/api/sales', {
          product_id: productId,
          sales_data: data.map((row) => ({
            sale_date: row.date,
            quantity_sold: row.quantity,
            notes: row.notes || ''
          })),
        });
        setHasUnsavedChanges(false);
        message.success('Auto-saved', 1);

        // Refresh data after auto-save to get updated inventory info
        if (viewMode === 'analytics') {
          loadSummary();
        }
      } catch (error) {
        message.error('Error auto-saving data');
      } finally {
        setAutoSaving(false);
      }
    }, 1500),
    [viewMode]
  );

  const handleQuantityChange = (date: string, value: number | null) => {
    const newData = salesData.map((row) =>
      row.date === date ? { ...row, quantity: value || 0 } : row
    );
    setSalesData(newData);
    setHasUnsavedChanges(true);

    // Trigger auto-save
    if (selectedProductId) {
      autoSave(selectedProductId, newData);
    }
  };

  const handleSave = async () => {
    if (!selectedProductId) return;

    try {
      setSaving(true);
      await axios.post('/api/sales', {
        product_id: selectedProductId,
        sales_data: salesData.map((row) => ({
          sale_date: row.date,
          quantity_sold: row.quantity,
          notes: row.notes || ''
        })),
      });
      setHasUnsavedChanges(false);
      message.success('Sales history saved successfully');

      // Refresh data after save
      loadSales(selectedProductId);
      if (viewMode === 'analytics') {
        loadSummary();
      }
    } catch (error) {
      message.error('Error saving sales history');
    } finally {
      setSaving(false);
    }
  };

  const handleExportEntry = () => {
    if (salesData && salesData.length > 0) {
      const selectedProduct = products.find(p => p.id === selectedProductId);
      const productName = selectedProduct ? `${selectedProduct.code}_sales` : 'sales';
      exportTableToCSV(
        salesData.map(row => ({
          date: dayjs(row.date).format('YYYY-MM-DD'),
          day: dayjs(row.date).format('dddd'),
          quantity: row.quantity
        })),
        entryColumns,
        getExportFilename(productName)
      );
    }
  };

  const handleExportSummary = () => {
    if (summaryData && summaryData.length > 0) {
      exportTableToCSV(
        summaryData,
        summaryColumns,
        getExportFilename('sales_summary')
      );
    }
  };

  // Calculate summary statistics for entry view
  const totalSales = salesData.reduce((sum, row) => sum + (row.quantity || 0), 0);
  const averageSales = salesData.length > 0 ? totalSales / salesData.length : 0;
  const salesDays = salesData.filter(row => row.quantity > 0).length;
  const maxDailySales = Math.max(...salesData.map(row => row.quantity || 0), 0);

  // Calculate summary statistics for analytics view
  const totalUnitsAllProducts = summaryData.reduce((sum, row) => sum + row.total_sold, 0);
  const productsWithSales = summaryData.filter(row => row.total_sold > 0).length;

  const entryColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => dayjs(date).format('ddd, MMM D, YYYY'),
      width: 200,
    },
    {
      title: 'Day',
      dataIndex: 'date',
      key: 'day',
      render: (date: string) => {
        const day = dayjs(date).format('dddd');
        const isWeekend = dayjs(date).day() === 0 || dayjs(date).day() === 6;
        return <span style={{ color: isWeekend ? '#999' : undefined }}>{day}</span>;
      },
      width: 120,
    },
    {
      title: 'Quantity Sold',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (quantity: number, record: SalesRow) => (
        <InputNumber
          value={quantity}
          onChange={(value) => handleQuantityChange(record.date, value)}
          style={{ width: '100%' }}
          min={0}
        />
      ),
      width: 150,
      align: 'right' as const,
    },
  ];

  const summaryColumns = [
    {
      title: 'Product Code',
      dataIndex: 'product_code',
      key: 'product_code',
      width: 150,
      sorter: (a: ProductSummary, b: ProductSummary) => a.product_code.localeCompare(b.product_code),
    },
    {
      title: 'Product Name',
      dataIndex: 'product_name',
      key: 'product_name',
      width: 300,
    },
    {
      title: `Total Sold (Last ${daysFilter} Days)`,
      dataIndex: 'total_sold',
      key: 'total_sold',
      width: 200,
      align: 'right' as const,
      render: (value: number) => (
        <span style={{ fontWeight: value > 0 ? 'bold' : 'normal', color: value > 0 ? '#1890ff' : '#999' }}>
          {Math.round(value).toLocaleString()}
        </span>
      ),
      sorter: (a: ProductSummary, b: ProductSummary) => a.total_sold - b.total_sold,
      defaultSortOrder: 'descend' as const,
    },
    {
      title: 'Avg Daily Sales',
      key: 'avg_daily',
      width: 150,
      align: 'right' as const,
      render: (_: any, record: ProductSummary) => {
        const avg = record.total_sold / daysFilter;
        return (
          <span style={{ color: avg > 0 ? '#52c41a' : '#999' }}>
            {Math.round(avg).toLocaleString()}
          </span>
        );
      },
      sorter: (a: ProductSummary, b: ProductSummary) =>
        (a.total_sold / daysFilter) - (b.total_sold / daysFilter),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Sales/Shipping</h1>
        <Space>
          {viewMode === 'entry' && (
            <>
              {autoSaving && <span style={{ color: '#1890ff' }}>Auto-saving...</span>}
              {hasUnsavedChanges && !autoSaving && <span style={{ color: '#faad14' }}>Unsaved changes</span>}
              <Button
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
                disabled={!selectedProductId || !hasUnsavedChanges}
              >
                Save Now
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExportEntry}
                disabled={salesData.length === 0}
              >
                Export CSV
              </Button>
            </>
          )}
          {viewMode === 'analytics' && (
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportSummary}
              disabled={summaryData.length === 0}
            >
              Export CSV
            </Button>
          )}
        </Space>
      </div>

      <Alert
        message="Sales Data Impact"
        description="Sales history is used to calculate demand forecasts and automatically deducts inventory for shipped products and their BOM components. Changes are auto-saved 1.5 seconds after you stop typing."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Segmented
            value={viewMode}
            onChange={(value) => setViewMode(value as 'entry' | 'analytics')}
            options={[
              { label: 'Data Entry', value: 'entry', icon: <CalendarOutlined /> },
              { label: 'Analytics', value: 'analytics', icon: <BarChartOutlined /> },
            ]}
            size="large"
          />

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>Time Period:</span>
            <Segmented
              value={daysFilter}
              onChange={(value) => setDaysFilter(value as number)}
              options={[
                { label: '7 Days', value: 7 },
                { label: '30 Days', value: 30 },
                { label: '60 Days', value: 60 },
                { label: '90 Days', value: 90 },
              ]}
            />
          </div>
        </div>
      </Card>

      {viewMode === 'entry' && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontWeight: 'bold' }}>Select Product:</span>
              <Select
                style={{ width: 400 }}
                value={selectedProductId}
                onChange={setSelectedProductId}
                options={products.map((p) => ({
                  value: p.id,
                  label: `${p.code} - ${p.name}`,
                }))}
              />
            </div>
          </Card>

          {salesData.length > 0 && (
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Card>
                  <Statistic
                    title={`Total Units Sold (${daysFilter}d)`}
                    value={totalSales}
                    prefix={<ShoppingOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Average Daily Sales"
                    value={Math.round(averageSales)}
                    prefix={<RiseOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Days with Sales"
                    value={salesDays}
                    suffix={`/ ${salesData.length}`}
                    valueStyle={{ color: salesDays > 0 ? '#1890ff' : '#999' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Max Daily Sales"
                    value={maxDailySales}
                    valueStyle={{ color: '#fa8c16' }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          <Card>
            <Table
              dataSource={salesData}
              columns={entryColumns}
              rowKey="date"
              loading={loading}
              pagination={{ pageSize: 30 }}
              size="small"
            />
          </Card>
        </>
      )}

      {viewMode === 'analytics' && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card>
                <Statistic
                  title={`Total Units Sold (${daysFilter}d)`}
                  value={totalUnitsAllProducts}
                  prefix={<ShoppingOutlined />}
                  valueStyle={{ color: '#1890ff', fontSize: 32 }}
                />
                <div style={{ fontSize: '12px', color: '#666', marginTop: 8 }}>
                  Across all products
                </div>
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Products with Sales"
                  value={productsWithSales}
                  suffix={`/ ${summaryData.length}`}
                  valueStyle={{ color: '#52c41a', fontSize: 32 }}
                />
                <div style={{ fontSize: '12px', color: '#666', marginTop: 8 }}>
                  Active products
                </div>
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Avg Daily (All Products)"
                  value={Math.round(totalUnitsAllProducts / daysFilter)}
                  prefix={<RiseOutlined />}
                  valueStyle={{ color: '#fa8c16', fontSize: 32 }}
                />
                <div style={{ fontSize: '12px', color: '#666', marginTop: 8 }}>
                  Combined average
                </div>
              </Card>
            </Col>
          </Row>

          <Card title={`Sales Summary - Last ${daysFilter} Days`}>
            <Table
              dataSource={summaryData}
              columns={summaryColumns}
              rowKey="product_id"
              loading={summaryLoading}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              size="small"
            />
          </Card>
        </>
      )}
    </div>
  );
}

export default Sales;
