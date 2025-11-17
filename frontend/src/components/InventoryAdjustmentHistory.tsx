import { useEffect, useState } from 'react';
import { Card, Table, DatePicker, Select, Input, Button, Space, Tag } from 'antd';
import { SearchOutlined, DownloadOutlined, HistoryOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import { exportTableToCSV, getExportFilename } from '../utils/exportUtils';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface InventoryAdjustment {
  id: number;
  product_id: number;
  product_code: string;
  product_name: string;
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  reason: string;
  notes: string | null;
  adjustment_date: string;
  created_at: string;
  category?: string | null;
  supplier?: string | null;
}

function InventoryAdjustmentHistory() {
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [reasonFilter, setReasonFilter] = useState<string>('all');

  const loadAdjustments = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/inventory/adjustments/history');
      setAdjustments(response.data);
    } catch (error) {
      console.error('Error loading adjustment history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdjustments();
  }, []);

  const getAdjustmentTypeTag = (reason: string) => {
    if (reason.includes('PO Receipt')) {
      return <Tag color="green">PO Receipt</Tag>;
    } else if (reason.includes('Production Output')) {
      return <Tag color="purple">Production Output</Tag>;
    } else if (reason.includes('Production Consumption')) {
      return <Tag color="volcano">Production Consumption</Tag>;
    } else if (reason.includes('Physical count')) {
      return <Tag color="blue">Physical Count</Tag>;
    } else if (reason.includes('Scrap')) {
      return <Tag color="red">Scrap</Tag>;
    } else if (reason.includes('Receipt')) {
      return <Tag color="cyan">Receipt</Tag>;
    } else {
      return <Tag color="default">Manual Adjustment</Tag>;
    }
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'adjustment_date',
      key: 'adjustment_date',
      width: 150,
      render: (date: string) => dayjs(date).format('MMM D, YYYY HH:mm'),
      sorter: (a: InventoryAdjustment, b: InventoryAdjustment) =>
        dayjs(a.adjustment_date).unix() - dayjs(b.adjustment_date).unix(),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: 'Product Code',
      dataIndex: 'product_code',
      key: 'product_code',
      width: 130,
    },
    {
      title: 'Product Name',
      dataIndex: 'product_name',
      key: 'product_name',
      width: 180,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      render: (category: string | null) => category ? <Tag color="blue">{category}</Tag> : <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: 'Type',
      key: 'type',
      width: 150,
      render: (_: any, record: InventoryAdjustment) => getAdjustmentTypeTag(record.reason),
    },
    {
      title: 'Change',
      dataIndex: 'quantity_change',
      key: 'quantity_change',
      width: 120,
      align: 'right' as const,
      render: (value: number) => {
        const color = value >= 0 ? '#52c41a' : '#ff4d4f';
        const prefix = value >= 0 ? '+' : '';
        return (
          <span style={{ color, fontWeight: 'bold' }}>
            {prefix}{Math.round(value).toLocaleString()}
          </span>
        );
      },
      sorter: (a: InventoryAdjustment, b: InventoryAdjustment) =>
        a.quantity_change - b.quantity_change,
    },
    {
      title: 'Before',
      dataIndex: 'previous_quantity',
      key: 'previous_quantity',
      width: 100,
      align: 'right' as const,
      render: (value: number | null) => {
        if (value === null) return '-';
        return Math.round(value).toLocaleString();
      },
    },
    {
      title: 'After',
      dataIndex: 'new_quantity',
      key: 'new_quantity',
      width: 100,
      align: 'right' as const,
      render: (value: number) => Math.round(value).toLocaleString(),
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      width: 200,
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      width: 250,
      render: (notes: string | null) => {
        if (!notes) return '-';
        // Remove "Previous: X, New: Y" pattern from notes
        const cleanedNotes = notes.replace(/\s*Previous:\s*[\d.]+,\s*New:\s*[\d.]+\s*$/, '').trim();
        return cleanedNotes || '-';
      },
    },
  ];

  // Get unique reason types for filtering
  const reasonTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'Production', label: 'Production' },
    { value: 'PO Receipt', label: 'PO Receipts' },
    { value: 'Physical count', label: 'Physical Counts' },
    { value: 'Scrap', label: 'Scrap' },
    { value: 'Receipt', label: 'Receipts' },
    { value: 'Manual', label: 'Manual Adjustments' },
  ];

  // Filter adjustments based on search, date range, and reason
  const filteredAdjustments = adjustments.filter((adjustment) => {
    // Search filter
    const matchesSearch =
      searchText === '' ||
      adjustment.product_code.toLowerCase().includes(searchText.toLowerCase()) ||
      adjustment.product_name.toLowerCase().includes(searchText.toLowerCase()) ||
      adjustment.reason.toLowerCase().includes(searchText.toLowerCase());

    // Date range filter
    const adjustmentDate = dayjs(adjustment.adjustment_date);
    const matchesDateRange =
      !dateRange[0] || !dateRange[1] ||
      (adjustmentDate.isAfter(dateRange[0].startOf('day')) &&
        adjustmentDate.isBefore(dateRange[1].endOf('day')));

    // Reason filter
    const matchesReason =
      reasonFilter === 'all' ||
      (reasonFilter === 'Production' &&
        (adjustment.reason.includes('Production Output') ||
         adjustment.reason.includes('Production Consumption'))) ||
      (reasonFilter === 'Manual' &&
        !adjustment.reason.includes('PO Receipt') &&
        !adjustment.reason.includes('Physical count') &&
        !adjustment.reason.includes('Scrap') &&
        !adjustment.reason.includes('Receipt') &&
        !adjustment.reason.includes('Production Output') &&
        !adjustment.reason.includes('Production Consumption')) ||
      adjustment.reason.includes(reasonFilter);

    return matchesSearch && matchesDateRange && matchesReason;
  });

  const handleExport = () => {
    if (filteredAdjustments && filteredAdjustments.length > 0) {
      exportTableToCSV(
        filteredAdjustments,
        columns,
        getExportFilename('inventory_adjustment_history')
      );
    }
  };

  // Calculate summary statistics
  const totalAdjustments = filteredAdjustments.length;
  const totalIncreases = filteredAdjustments.filter(a => a.quantity_change > 0).length;
  const totalDecreases = filteredAdjustments.filter(a => a.quantity_change < 0).length;
  const totalPoReceipts = filteredAdjustments.filter(a => a.reason.includes('PO Receipt')).length;
  const totalProduction = filteredAdjustments.filter(a =>
    a.reason.includes('Production Output') || a.reason.includes('Production Consumption')
  ).length;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>
            <HistoryOutlined style={{ marginRight: 8 }} />
            Inventory Adjustment History
          </h1>
          <p style={{ color: '#666', fontSize: '14px', marginTop: 8 }}>
            Complete audit trail of all inventory changes including PO receipts and manual adjustments.
          </p>
        </div>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          Export CSV
        </Button>
      </div>

      {/* Summary Statistics */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Card size="small" style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
            {totalAdjustments}
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>Total Adjustments</div>
        </Card>
        <Card size="small" style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
            {totalIncreases}
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>Increases</div>
        </Card>
        <Card size="small" style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>
            {totalDecreases}
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>Decreases</div>
        </Card>
        <Card size="small" style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
            {totalPoReceipts}
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>PO Receipts</div>
        </Card>
        <Card size="small" style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#722ed1' }}>
            {totalProduction}
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>Production</div>
        </Card>
      </div>

      <Card>
        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size="large">
          <Input
            placeholder="Search by product code, name, or reason..."
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
                color={reasonFilter === 'all' && !dateRange[0] && !dateRange[1] ? 'blue' : 'default'}
                onClick={() => {
                  setReasonFilter('all');
                  setDateRange([null, null]);
                  setSearchText('');
                }}
                style={{ cursor: 'pointer' }}
              >
                All Adjustments
              </Tag>
              <Tag
                color={reasonFilter === 'PO Receipt' ? 'green' : 'default'}
                onClick={() => setReasonFilter(reasonFilter === 'PO Receipt' ? 'all' : 'PO Receipt')}
                style={{ cursor: 'pointer' }}
              >
                PO Receipts ({adjustments.filter(a => a.reason.includes('PO Receipt')).length})
              </Tag>
              <Tag
                color={reasonFilter === 'Production' ? 'purple' : 'default'}
                onClick={() => setReasonFilter(reasonFilter === 'Production' ? 'all' : 'Production')}
                style={{ cursor: 'pointer' }}
              >
                Production ({adjustments.filter(a =>
                  a.reason.includes('Production Output') || a.reason.includes('Production Consumption')
                ).length})
              </Tag>
              <Tag
                color={reasonFilter === 'Physical count' ? 'blue' : 'default'}
                onClick={() => setReasonFilter(reasonFilter === 'Physical count' ? 'all' : 'Physical count')}
                style={{ cursor: 'pointer' }}
              >
                Physical Counts ({adjustments.filter(a => a.reason.includes('Physical count')).length})
              </Tag>
              <Tag
                color={reasonFilter === 'Manual' ? 'default' : 'default'}
                onClick={() => setReasonFilter(reasonFilter === 'Manual' ? 'all' : 'Manual')}
                style={{ cursor: 'pointer' }}
              >
                Manual ({adjustments.filter(a =>
                  !a.reason.includes('PO Receipt') &&
                  !a.reason.includes('Physical count') &&
                  !a.reason.includes('Scrap') &&
                  !a.reason.includes('Receipt') &&
                  !a.reason.includes('Production Output') &&
                  !a.reason.includes('Production Consumption')
                ).length})
              </Tag>
            </Space>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <span style={{ marginRight: 8, fontWeight: 500 }}>Date Range:</span>
              <RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null])}
                style={{ width: 280 }}
                format="MMM D, YYYY"
                size="small"
              />
            </div>

            <div>
              <span style={{ marginRight: 8, fontWeight: 500 }}>Type:</span>
              <Select
                value={reasonFilter}
                onChange={setReasonFilter}
                style={{ width: 200 }}
                size="small"
              >
                {reasonTypes.map(type => (
                  <Option key={type.value} value={type.value}>
                    {type.label}
                  </Option>
                ))}
              </Select>
            </div>
          </div>

          <div style={{ color: '#666', fontSize: '14px' }}>
            Showing {filteredAdjustments.length} of {adjustments.length} adjustments
            {(searchText || reasonFilter !== 'all' || dateRange[0] || dateRange[1]) && (
              <Button
                type="link"
                size="small"
                onClick={() => {
                  setSearchText('');
                  setReasonFilter('all');
                  setDateRange([null, null]);
                }}
              >
                Clear all filters
              </Button>
            )}
          </div>
        </Space>

        <Table
          dataSource={filteredAdjustments}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (total) => `Total ${total} adjustments` }}
          scroll={{ x: 1400 }}
          size="small"
        />
      </Card>
    </div>
  );
}

export default InventoryAdjustmentHistory;
