import { useEffect, useState } from 'react';
import { Card, Table, Tag, Spin, Alert, Statistic, Row, Col, Collapse, Button } from 'antd';
import { WarningOutlined, ClockCircleOutlined, CheckCircleOutlined, BarsOutlined, DownloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { exportTableToCSV, getExportFilename } from '../utils/exportUtils';

const { Panel } = Collapse;

interface UsedInProduct {
  code: string;
  name: string;
  quantity_per: number;
}

interface DailyData {
  date: string;
  day_of_week: string;
  consumption: number;
  incoming_po: number;
  projected_inventory: number;
}

interface Component {
  component_id: number;
  component_code: string;
  component_name: string;
  current_stock: number;
  run_out_date: string | null;
  days_of_inventory: number;
  used_in_products: UsedInProduct[];
  daily_data: DailyData[];
}

interface BuildAnalysisData {
  start_date: string;
  components: Component[];
}

function MaterialAnalysis() {
  const [data, setData] = useState<BuildAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);

  const loadBuildAnalysis = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/demand/daily-build-analysis');
      setData(response.data);
    } catch (error) {
      console.error('Error loading build analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuildAnalysis();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data || !data.components || data.components.length === 0) {
    return (
      <div>
        <h1>Daily Build Analysis</h1>
        <Alert
          message="No Component Data Available"
          description="No components found with demand forecast. Please ensure you have products with BOMs and demand forecast entries."
          type="info"
          showIcon
        />
      </div>
    );
  }

  // Calculate summary statistics
  const criticalComponents = data.components.filter(c => c.days_of_inventory <= 7).length;
  const warningComponents = data.components.filter(c => c.days_of_inventory > 7 && c.days_of_inventory <= 30).length;
  const healthyComponents = data.components.filter(c => c.days_of_inventory > 30).length;

  const handleExportComponents = () => {
    if (data && data.components && data.components.length > 0) {
      exportTableToCSV(
        data.components,
        componentColumns,
        getExportFilename('daily_build_analysis')
      );
    }
  };

  const getUrgencyColor = (days: number): string => {
    if (days <= 0) return 'red';
    if (days <= 7) return 'red';
    if (days <= 30) return 'orange';
    return 'green';
  };

  const getUrgencyTag = (days: number, runOutDate: string | null): JSX.Element => {
    if (!runOutDate) {
      return <Tag color="green">Sufficient</Tag>;
    }

    const color = getUrgencyColor(days);
    let text = '';
    let icon = null;

    if (days <= 0) {
      text = 'OUT OF STOCK';
      icon = <WarningOutlined />;
    } else if (days <= 7) {
      text = `CRITICAL - ${days}d`;
      icon = <WarningOutlined />;
    } else if (days <= 30) {
      text = `${days} days`;
      icon = <ClockCircleOutlined />;
    } else {
      text = `${days} days`;
      icon = <CheckCircleOutlined />;
    }

    return (
      <Tag color={color} icon={icon}>
        {text}
      </Tag>
    );
  };

  const componentColumns = [
    {
      title: 'Component Code',
      dataIndex: 'component_code',
      key: 'component_code',
      width: 150,
      fixed: 'left' as const,
      sorter: (a: Component, b: Component) => a.component_code.localeCompare(b.component_code),
    },
    {
      title: 'Component Name',
      dataIndex: 'component_name',
      key: 'component_name',
      width: 250,
    },
    {
      title: 'Current Stock',
      dataIndex: 'current_stock',
      key: 'current_stock',
      width: 130,
      align: 'right' as const,
      render: (value: number) => Math.round(value).toLocaleString(),
      sorter: (a: Component, b: Component) => a.current_stock - b.current_stock,
    },
    {
      title: 'Days of Inventory',
      dataIndex: 'days_of_inventory',
      key: 'days_of_inventory',
      width: 150,
      align: 'center' as const,
      render: (_: any, record: Component) => getUrgencyTag(record.days_of_inventory, record.run_out_date),
      sorter: (a: Component, b: Component) => a.days_of_inventory - b.days_of_inventory,
      defaultSortOrder: 'ascend' as const,
    },
    {
      title: 'Run Out Date',
      dataIndex: 'run_out_date',
      key: 'run_out_date',
      width: 150,
      render: (date: string | null) => {
        if (!date) return <span style={{ color: '#52c41a' }}>No shortage</span>;

        const runOutDate = dayjs(date);
        const daysUntil = runOutDate.diff(dayjs(), 'day');
        const color = getUrgencyColor(daysUntil);

        return (
          <span style={{ color, fontWeight: daysUntil <= 7 ? 'bold' : 'normal' }}>
            {runOutDate.format('MMM D, YYYY')}
          </span>
        );
      },
      sorter: (a: Component, b: Component) => {
        if (!a.run_out_date) return 1;
        if (!b.run_out_date) return -1;
        return dayjs(a.run_out_date).unix() - dayjs(b.run_out_date).unix();
      },
    },
    {
      title: 'Used In Products',
      key: 'used_in_products',
      width: 200,
      render: (_: any, record: Component) => (
        <div>
          {record.used_in_products.slice(0, 2).map((product, idx) => (
            <div key={idx} style={{ fontSize: '12px' }}>
              {product.code} ({product.quantity_per}x)
            </div>
          ))}
          {record.used_in_products.length > 2 && (
            <div style={{ fontSize: '11px', color: '#666' }}>
              +{record.used_in_products.length - 2} more
            </div>
          )}
        </div>
      ),
    },
  ];

  const dailyColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 150,
      render: (date: string, record: DailyData) => (
        <span>
          <strong>{dayjs(date).format('MMM D')}</strong> ({record.day_of_week})
        </span>
      ),
    },
    {
      title: 'Consumption',
      dataIndex: 'consumption',
      key: 'consumption',
      width: 120,
      align: 'right' as const,
      render: (value: number) => (
        <span style={{ color: value > 0 ? '#1890ff' : '#999' }}>
          {value > 0 ? `-${Math.round(value).toLocaleString()}` : '0'}
        </span>
      ),
    },
    {
      title: 'Incoming PO',
      dataIndex: 'incoming_po',
      key: 'incoming_po',
      width: 120,
      align: 'right' as const,
      render: (value: number) => {
        if (!value || value === 0) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        return (
          <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
            +{Math.round(value).toLocaleString()}
          </span>
        );
      },
    },
    {
      title: 'Projected Inventory',
      dataIndex: 'projected_inventory',
      key: 'projected_inventory',
      width: 150,
      align: 'right' as const,
      render: (value: number) => {
        const color = value < 0 ? 'red' : value < 500 ? 'orange' : 'green';
        return (
          <span style={{ color, fontWeight: value < 0 ? 'bold' : 'normal' }}>
            {Math.round(value).toLocaleString()}
          </span>
        );
      },
    },
  ];

  const expandedRowRender = (record: Component) => {
    return (
      <div style={{ padding: '16px', background: '#fafafa' }}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <h4>Used In Products:</h4>
            {record.used_in_products.map((product, idx) => (
              <Tag key={idx} color="blue" style={{ marginBottom: 4 }}>
                {product.code} - {product.name} ({product.quantity_per}x per unit)
              </Tag>
            ))}
          </Col>
        </Row>

        <h4>Daily Consumption Projection (Next 90 Days):</h4>
        <Table
          dataSource={record.daily_data}
          columns={dailyColumns}
          rowKey="date"
          pagination={{ pageSize: 30 }}
          size="small"
          scroll={{ y: 400 }}
          rowClassName={(record: DailyData) => {
            if (record.projected_inventory < 0) return 'shortage-row';
            return '';
          }}
        />

        <style>{`
          .shortage-row {
            background-color: #fff2f0 !important;
          }
          .shortage-row:hover > td {
            background-color: #ffccc7 !important;
          }
        `}</style>
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1>Daily Build Analysis</h1>
        <p style={{ color: '#666', fontSize: '14px' }}>
          Component-by-component breakdown showing daily consumption and projected inventory levels.
          Analysis based on current stock and demand forecast.
        </p>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Critical Components"
              value={criticalComponents}
              prefix={<WarningOutlined />}
              suffix={`/ ${data.components.length}`}
              valueStyle={{ color: criticalComponents > 0 ? '#cf1322' : '#3f8600' }}
            />
            <div style={{ fontSize: '12px', color: '#666', marginTop: 8 }}>
              7 days or less inventory
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Warning Components"
              value={warningComponents}
              prefix={<ClockCircleOutlined />}
              suffix={`/ ${data.components.length}`}
              valueStyle={{ color: warningComponents > 0 ? '#fa8c16' : '#3f8600' }}
            />
            <div style={{ fontSize: '12px', color: '#666', marginTop: 8 }}>
              8-30 days inventory
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Healthy Components"
              value={healthyComponents}
              prefix={<CheckCircleOutlined />}
              suffix={`/ ${data.components.length}`}
              valueStyle={{ color: '#3f8600' }}
            />
            <div style={{ fontSize: '12px', color: '#666', marginTop: 8 }}>
              30+ days inventory
            </div>
          </Card>
        </Col>
      </Row>

      {criticalComponents > 0 && (
        <Alert
          message={`${criticalComponents} critical component${criticalComponents > 1 ? 's' : ''} require immediate attention!`}
          description="Components with 7 days or less inventory are marked as CRITICAL. Review shortage dates and place orders immediately."
          type="error"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarsOutlined style={{ fontSize: '18px' }} />
            <span>Component Consumption Timeline</span>
            <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666', marginLeft: '10px' }}>
              Starting {dayjs(data.start_date).format('MMM D, YYYY')}
            </span>
          </div>
        }
        extra={
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportComponents}
            size="small"
          >
            Export CSV
          </Button>
        }
      >
        <Table
          dataSource={data.components}
          columns={componentColumns}
          rowKey="component_id"
          expandable={{
            expandedRowRender,
            expandRowByClick: true,
          }}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1200 }}
          size="small"
        />
      </Card>
    </div>
  );
}

export default MaterialAnalysis;
