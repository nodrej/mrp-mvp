import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Button, Alert, Spin, Table, Progress, Tag, Tooltip, Space, Calendar, Badge, Modal, Tabs, Select, Form, Input, DatePicker, message } from 'antd';
import { WarningOutlined, CheckCircleOutlined, ReloadOutlined, RocketOutlined, DownloadOutlined, ClockCircleOutlined, DashboardOutlined, PlusOutlined, ShoppingCartOutlined, CalendarOutlined, HistoryOutlined, PauseCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { exportTableToCSV, getExportFilename } from '../utils/exportUtils';
import CreatePOModal from './CreatePOModal';

dayjs.extend(relativeTime);

interface DashboardData {
  total_products: number;
  total_components: number;
  total_inventory_value: number;
  low_stock_count: number;
  shortages: Array<{
    product_code: string;
    product_name: string;
    current_stock: number;
    projected_shortage_date: string;
    severity: string;
  }>;
}

interface ComponentAnalysis {
  component_id: number;
  component_code: string;
  component_name: string;
  current_stock: number;
  run_out_date: string | null;
  days_of_inventory: number;
  used_in_products: Array<{
    code: string;
    name: string;
    quantity_per: number;
  }>;
  daily_data: Array<{
    date: string;
    day_of_week: string;
    consumption: number;
    incoming_po: number;
    projected_inventory: number;
  }>;
  pending_pos?: Array<{
    po_id: number;
    po_number: string;
    quantity: number;
    expected_date: string;
    supplier: string;
    order_date: string;
  }>;
  has_pending_po?: boolean;
  reorder_point?: number;
  reorder_qty?: number;
  lead_time_days?: number;
  order_multiple?: number;
  minimum_order_qty?: number;
  critical_days?: number;
  warning_days?: number;
  caution_days?: number;
  is_stagnant?: boolean;
}

interface MaterialAnalysisData {
  start_date: string;
  components: ComponentAnalysis[];
}

interface WeeklyShipmentSummary {
  week_start: string;
  week_end: string;
  products: Array<{
    product_id: number;
    product_code: string;
    product_name: string;
    goal: number;
    shipped: number;
    progress: number;
    variance: number;
    status: string;
    daily_goal_today: number;
    today_shipped: number;
    shipped_before_today: number;
    daily_status: string;
    workdays_remaining: number;
  }>;
}

function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [materialAnalysis, setMaterialAnalysis] = useState<MaterialAnalysisData | null>(null);
  const [weeklyShipments, setWeeklyShipments] = useState<WeeklyShipmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<ComponentAnalysis | null>(null);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [selectedDateComponents, setSelectedDateComponents] = useState<ComponentAnalysis[]>([]);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);
  const [activeTab, setActiveTab] = useState<'projection' | 'history'>('projection');
  const [historyDays, setHistoryDays] = useState<number>(30);
  const [historyData, setHistoryData] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isPODetailModalOpen, setIsPODetailModalOpen] = useState(false);
  const [selectedPOs, setSelectedPOs] = useState<any[]>([]);
  const [selectedPOComponent, setSelectedPOComponent] = useState<ComponentAnalysis | null>(null);
  const [receivePOForm] = Form.useForm();
  const [componentDisplayCount, setComponentDisplayCount] = useState<number>(5);
  const [isTodayPOModalOpen, setIsTodayPOModalOpen] = useState(false);
  const [todayPOs, setTodayPOs] = useState<Array<{ component: ComponentAnalysis, pos: any[] }>>([]);
  const [allPendingPOs, setAllPendingPOs] = useState<any[]>([]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/dashboard');
      setData(response.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWeeklyShipments = async () => {
    try {
      const response = await axios.get('/api/weekly-shipments/current-week-summary');
      setWeeklyShipments(response.data);
    } catch (error) {
      console.error('Error loading weekly shipments:', error);
    }
  };

  const loadMaterialAnalysis = async () => {
    try {
      const response = await axios.get('/api/demand/daily-build-analysis', {
        params: { days: 90 }
      });
      setMaterialAnalysis(response.data);
    } catch (error) {
      console.error('Error loading material analysis:', error);
    }
  };

  const loadAllPendingPOs = async () => {
    try {
      const response = await axios.get('/api/purchase-orders', {
        params: { status: 'pending' }
      });
      setAllPendingPOs(response.data.purchase_orders || []);
    } catch (error) {
      console.error('Error loading pending POs:', error);
    }
  };

  const runMRP = async () => {
    try {
      setCalculating(true);
      await axios.post('/api/mrp/calculate', { days: 30 });
      await loadDashboard();
      await loadMaterialAnalysis();
    } catch (error) {
      console.error('Error running MRP:', error);
    } finally {
      setCalculating(false);
    }
  };

  const loadHistoryData = async () => {
    try {
      setLoadingHistory(true);
      const response = await axios.get('/api/mrp/material-analysis/history', {
        params: { days: historyDays }
      });
      setHistoryData(response.data);
    } catch (error) {
      console.error('Error loading history data:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handlePOBarClick = (component: ComponentAnalysis, date: string) => {
    // Find all POs for this component on this date
    const posForDate = component.pending_pos?.filter(po => {
      return dayjs(po.expected_date).format('YYYY-MM-DD') === dayjs(date).format('YYYY-MM-DD');
    }) || [];

    if (posForDate.length > 0) {
      setSelectedPOComponent(component);
      setSelectedPOs(posForDate);
      setIsPODetailModalOpen(true);
    }
  };

  const handleReceivePO = async (values: any, poId: number) => {
    try {
      await axios.post(`/api/purchase-orders/${poId}/receive`, {
        received_date: values.received_date.format('YYYY-MM-DD'),
        received_quantity: parseFloat(values.received_quantity),
        notes: values.notes,
      });
      message.success('Purchase order received and inventory updated');
      setIsPODetailModalOpen(false);
      setIsTodayPOModalOpen(false);
      receivePOForm.resetFields();
      loadMaterialAnalysis();
      loadAllPendingPOs(); // Reload to update the banner
    } catch (error: any) {
      console.error('Error receiving purchase order:', error);
      message.error(error.response?.data?.detail || 'Failed to receive purchase order');
    }
  };

  const handleShowTodayPOs = () => {
    const today = dayjs().format('YYYY-MM-DD');

    // Filter ALL pending POs (components and finished goods) for today or overdue
    const todayOrOverduePOs = allPendingPOs.filter(po => {
      const expectedDate = dayjs(po.expected_date).format('YYYY-MM-DD');
      return expectedDate <= today;
    });

    // Group POs by product and try to match with component data
    const posGrouped: Array<{ component: ComponentAnalysis | null, pos: any[], product_code: string, product_name: string }> = [];
    const posByProduct = new Map<number, any[]>();

    todayOrOverduePOs.forEach(po => {
      if (!posByProduct.has(po.product_id)) {
        posByProduct.set(po.product_id, []);
      }
      posByProduct.get(po.product_id)!.push(po);
    });

    // For each product, try to find matching component data
    posByProduct.forEach((pos, productId) => {
      const matchingComponent = materialAnalysis?.components.find(c => c.component_id === productId);
      const firstPO = pos[0];

      posGrouped.push({
        component: matchingComponent || null,
        pos: pos,
        product_code: firstPO.product_code || 'Unknown',
        product_name: firstPO.product_name || 'Unknown'
      });
    });

    setTodayPOs(posGrouped as any);
    setIsTodayPOModalOpen(true);
  };

  useEffect(() => {
    loadDashboard();
    loadWeeklyShipments();
    loadMaterialAnalysis();
    loadAllPendingPOs();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistoryData();
    }
  }, [activeTab, historyDays]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  const weeklyShipmentColumns = [
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
    },
    {
      title: 'Week Goal',
      dataIndex: 'goal',
      key: 'goal',
      render: (value: number) => value.toLocaleString(),
      align: 'right' as const,
      width: 100,
    },
    {
      title: 'Week Shipped',
      dataIndex: 'shipped',
      key: 'shipped',
      render: (value: number) => value.toLocaleString(),
      align: 'right' as const,
      width: 110,
    },
    {
      title: 'Daily Goal',
      dataIndex: 'daily_goal_today',
      key: 'daily_goal_today',
      render: (value: number) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
          {Math.round(value).toLocaleString()}
        </span>
      ),
      align: 'right' as const,
      width: 100,
    },
    {
      title: 'Today Shipped',
      dataIndex: 'today_shipped',
      key: 'today_shipped',
      render: (value: number) => Math.round(value).toLocaleString(),
      align: 'right' as const,
      width: 120,
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 150,
      render: (_: any, record: any) => {
        const status = record.progress >= 100 ? 'success' : record.progress >= 80 ? 'normal' : 'exception';
        return (
          <Progress
            percent={Math.min(record.progress, 100)}
            status={status}
            size="small"
          />
        );
      },
    },
    {
      title: 'Daily Status',
      dataIndex: 'daily_status',
      key: 'daily_status',
      width: 120,
      render: (daily_status: string) => {
        let icon = '';
        let color = '';
        let text = '';
        let bgColor = '';

        if (daily_status === 'complete') {
          icon = '✓';
          color = '#52c41a';
          text = 'Complete';
          bgColor = '#f6ffed';
        } else if (daily_status === 'on_pace') {
          icon = '✓';
          color = '#52c41a';
          text = 'On Pace';
          bgColor = '#f6ffed';
        } else if (daily_status === 'close') {
          icon = '△';
          color = '#faad14';
          text = 'Close';
          bgColor = '#fffbe6';
        } else if (daily_status === 'behind') {
          icon = '✗';
          color = '#ff4d4f';
          text = 'Behind';
          bgColor = '#fff2f0';
        } else if (daily_status === 'weekend') {
          icon = '—';
          color = '#999';
          text = 'Weekend';
          bgColor = '#fafafa';
        }

        return (
          <span style={{
            color,
            fontWeight: 'bold',
            backgroundColor: bgColor,
            padding: '4px 8px',
            borderRadius: '4px',
            display: 'inline-block'
          }}>
            {icon} {text}
          </span>
        );
      },
    },
    {
      title: 'Week Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => {
        let icon = '';
        let color = '';
        let text = '';
        let bgColor = '';

        if (status === 'complete') {
          icon = '✓';
          color = '#52c41a';
          text = 'Complete';
          bgColor = '#f6ffed';
        } else if (status === 'on_pace') {
          icon = '→';
          color = '#1890ff';
          text = 'On Track';
          bgColor = '#e6f7ff';
        } else {
          icon = '✗';
          color = '#ff4d4f';
          text = 'Behind';
          bgColor = '#fff2f0';
        }

        return (
          <span style={{
            color,
            fontWeight: 'bold',
            backgroundColor: bgColor,
            padding: '4px 8px',
            borderRadius: '4px',
            display: 'inline-block'
          }}>
            {icon} {text}
          </span>
        );
      },
    },
  ];

  const handleExportWeeklyShipments = () => {
    if (weeklyShipments && weeklyShipments.products && weeklyShipments.products.length > 0) {
      exportTableToCSV(
        weeklyShipments.products,
        weeklyShipmentColumns,
        getExportFilename('weekly_shipments')
      );
    }
  };

  // Helper function to determine urgency level and color
  const getUrgencyInfo = (days: number | null, criticalDays: number = 7, warningDays: number = 14, cautionDays: number = 30, isStagnant: boolean = false) => {
    // Stagnant components get muted gray styling
    if (isStagnant) {
      return { level: 'stagnant', color: '#8c8c8c', label: 'Inactive', bgColor: '#fafafa', borderColor: '#d9d9d9' };
    }

    if (days === null || days > 90) {
      return { level: 'ok', color: '#52c41a', label: 'OK', bgColor: '#f6ffed', borderColor: '#b7eb8f' };
    } else if (days < criticalDays) {
      return { level: 'critical', color: '#ff4d4f', label: 'URGENT', bgColor: '#fff2f0', borderColor: '#ffccc7' };
    } else if (days < warningDays) {
      return { level: 'warning', color: '#fa8c16', label: 'Warning', bgColor: '#fff7e6', borderColor: '#ffd591' };
    } else if (days < cautionDays) {
      return { level: 'caution', color: '#faad14', label: 'Caution', bgColor: '#fffbe6', borderColor: '#ffe58f' };
    } else {
      return { level: 'ok', color: '#52c41a', label: 'OK', bgColor: '#f6ffed', borderColor: '#b7eb8f' };
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>MRP Dashboard</h1>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={runMRP}
          loading={calculating}
          size="large"
        >
          Run MRP Calculation
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Products"
              value={data?.total_products || 0}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Components"
              value={data?.total_components || 0}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Inventory Items"
              value={data?.total_inventory_value || 0}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Low Stock Items"
              value={data?.low_stock_count || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: data?.low_stock_count ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      {weeklyShipments && weeklyShipments.products.length > 0 && (
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RocketOutlined style={{ fontSize: '18px' }} />
              <span>Current Week Shipment Status</span>
              <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666', marginLeft: '10px' }}>
                {dayjs(weeklyShipments.week_start).format('MMM D')} - {dayjs(weeklyShipments.week_end).format('MMM D, YYYY')}
              </span>
            </div>
          }
          extra={
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportWeeklyShipments}
              size="small"
            >
              Export CSV
            </Button>
          }
          style={{ marginTop: 24 }}
        >
          <Table
            dataSource={weeklyShipments.products}
            columns={weeklyShipmentColumns}
            rowKey="product_id"
            pagination={false}
            size="small"
            scroll={{ x: 1200 }}
          />
        </Card>
      )}

      {materialAnalysis && materialAnalysis.components && materialAnalysis.components.length > 0 && (
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DashboardOutlined style={{ fontSize: '18px' }} />
              <span>Material Inventory Analysis</span>
            </div>
          }
          style={{ marginTop: 24 }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as 'projection' | 'history')}
            items={[
              {
                key: 'projection',
                label: (
                  <span>
                    <DashboardOutlined /> Projection (90 Days)
                  </span>
                ),
                children: (() => {
            const urgentCount = materialAnalysis.components.filter(c => c.days_of_inventory < 7).length;
            const warningCount = materialAnalysis.components.filter(c => c.days_of_inventory >= 7 && c.days_of_inventory < 14).length;
            const cautionCount = materialAnalysis.components.filter(c => c.days_of_inventory >= 14 && c.days_of_inventory < 30).length;
            const okCount = materialAnalysis.components.filter(c => c.days_of_inventory >= 30).length;

            return (
              <>
                {/* Summary Metrics */}
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={6}>
                    <Card style={{ borderColor: '#ff4d4f', backgroundColor: '#fff2f0' }}>
                      <Statistic
                        title="Critical (< 7 days)"
                        value={urgentCount}
                        valueStyle={{ color: '#ff4d4f' }}
                        prefix={<WarningOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card style={{ borderColor: '#fa8c16', backgroundColor: '#fff7e6' }}>
                      <Statistic
                        title="Warning (7-14 days)"
                        value={warningCount}
                        valueStyle={{ color: '#fa8c16' }}
                        prefix={<ClockCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card style={{ borderColor: '#faad14', backgroundColor: '#fffbe6' }}>
                      <Statistic
                        title="Caution (14-30 days)"
                        value={cautionCount}
                        valueStyle={{ color: '#faad14' }}
                        prefix={<ClockCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card style={{ borderColor: '#52c41a', backgroundColor: '#f6ffed' }}>
                      <Statistic
                        title="OK (> 30 days)"
                        value={okCount}
                        valueStyle={{ color: '#52c41a' }}
                        prefix={<CheckCircleOutlined />}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* Quick Action Banner - POs Arriving Today/Overdue */}
                {(() => {
                  const today = dayjs().format('YYYY-MM-DD');
                  let todayCount = 0;
                  let overdueCount = 0;

                  // Check ALL pending POs (both components and finished goods)
                  allPendingPOs.forEach(po => {
                    const expectedDate = dayjs(po.expected_date).format('YYYY-MM-DD');
                    if (expectedDate === today) {
                      todayCount++;
                    } else if (expectedDate < today) {
                      overdueCount++;
                    }
                  });

                  const totalActionable = todayCount + overdueCount;

                  if (totalActionable > 0) {
                    return (
                      <Alert
                        message={
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ fontSize: '16px' }}>
                                {overdueCount > 0 ? '⚠️ Action Required: ' : '📦 '}
                                {overdueCount > 0 && `${overdueCount} Overdue PO${overdueCount > 1 ? 's' : ''}`}
                                {overdueCount > 0 && todayCount > 0 && ' + '}
                                {todayCount > 0 && `${todayCount} PO${todayCount > 1 ? 's' : ''} Expected Today`}
                              </strong>
                              <div style={{ fontSize: '13px', marginTop: 4, color: '#666' }}>
                                Click to review and receive purchase orders
                              </div>
                            </div>
                            <Button
                              type="primary"
                              size="large"
                              onClick={handleShowTodayPOs}
                              icon={<ShoppingCartOutlined />}
                            >
                              Review & Receive ({totalActionable})
                            </Button>
                          </div>
                        }
                        type={overdueCount > 0 ? 'error' : 'info'}
                        showIcon={false}
                        style={{
                          marginBottom: 24,
                          padding: '16px 24px',
                          cursor: 'pointer'
                        }}
                        onClick={handleShowTodayPOs}
                      />
                    );
                  }
                  return null;
                })()}

                {/* Priority Cards - Top N Most Urgent */}
                {materialAnalysis.components.filter(c => c.run_out_date !== null).slice(0, componentDisplayCount).length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h3 style={{ marginBottom: 16 }}>
                      {componentDisplayCount === 5 ? 'Top 5 Most Urgent Components' :
                       componentDisplayCount === 10 ? 'Top 10 Most Urgent Components' :
                       'All Urgent Components'}
                    </h3>
                    <Row gutter={[16, 16]}>
                      {materialAnalysis.components
                        .filter(c => c.run_out_date !== null)
                        .slice(0, componentDisplayCount)
                        .map((component) => {
                          const urgency = getUrgencyInfo(
                            component.days_of_inventory,
                            component.critical_days,
                            component.warning_days,
                            component.caution_days,
                            component.is_stagnant
                          );
                          const runOutDate = component.run_out_date ? dayjs(component.run_out_date) : null;

                          // Get next days with weekend indicators
                          const daysWithWeekends: Array<{ type: 'day' | 'weekend', data?: any, date?: string }> = [];
                          let workdayCount = 0;
                          let dayIndex = 0;

                          while (workdayCount < 14 && dayIndex < component.daily_data.length) {
                            const day = component.daily_data[dayIndex];
                            const dayOfWeek = dayjs(day.date).day();

                            if (dayOfWeek === 0 || dayOfWeek === 6) {
                              // Weekend - add a separator
                              daysWithWeekends.push({ type: 'weekend', date: day.date });
                            } else {
                              // Workday - add the data
                              daysWithWeekends.push({ type: 'day', data: day });
                              workdayCount++;
                            }
                            dayIndex++;
                          }

                          const workdays = daysWithWeekends.filter(d => d.type === 'day').map(d => d.data);
                          const maxProjected = Math.max(...workdays.map(d => Math.abs(d.projected_inventory)), component.current_stock);

                          return (
                            <Col span={24} key={component.component_id}>
                              <Card
                                size="small"
                                style={{
                                  borderLeft: `4px solid ${urgency.color}`,
                                  overflow: 'hidden',
                                }}
                              >
                                {/* Status Banner */}
                                {!component.has_pending_po && component.days_of_inventory < 14 && (
                                  <div style={{
                                    backgroundColor: urgency.color,
                                    color: 'white',
                                    padding: '6px 12px',
                                    marginBottom: 12,
                                    fontWeight: 'bold',
                                    fontSize: '12px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                  }}>
                                    <span>⚠️ ACTION REQUIRED - No PO on order</span>
                                    <Tag color="white" style={{ color: urgency.color, fontWeight: 'bold', margin: 0 }}>
                                      {urgency.label}
                                    </Tag>
                                  </div>
                                )}

                                <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
                                  <Col span={6}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      {/* PO Status Indicator */}
                                      {component.has_pending_po ? (
                                        <span title="Has pending PO" style={{ fontSize: '20px' }}>🟢</span>
                                      ) : component.days_of_inventory < 7 ? (
                                        <span title="No PO - Critical" style={{ fontSize: '20px' }}>🔴</span>
                                      ) : (
                                        <span title="No PO - Warning" style={{ fontSize: '20px' }}>🟡</span>
                                      )}
                                      <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '18px' }}>
                                          {component.component_code}
                                        </div>
                                        <div style={{ color: '#666', fontSize: '13px' }}>
                                          {component.component_name}
                                        </div>
                                      </div>
                                    </div>
                                  </Col>
                                  <Col span={3}>
                                    <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>Current Stock</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '18px' }}>
                                      {Math.round(component.current_stock).toLocaleString()}
                                    </div>
                                  </Col>
                                  <Col span={3}>
                                    <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>Days Left</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '20px', color: urgency.color }}>
                                      {component.days_of_inventory}
                                    </div>
                                  </Col>
                                  <Col span={4}>
                                    <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>Run Out Date</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: urgency.color }}>
                                      {runOutDate ? runOutDate.format('MMM D, YYYY') : 'N/A'}
                                    </div>
                                  </Col>
                                  <Col span={4}>
                                    <Tooltip title={component.used_in_products.map(p => `${p.code} (${p.quantity_per}x)`).join(', ')}>
                                      <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>Used In</div>
                                      <div style={{ fontSize: '15px', fontWeight: '500' }}>
                                        {component.used_in_products.length} product(s)
                                      </div>
                                    </Tooltip>
                                  </Col>
                                  <Col span={4}>
                                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                      {/* Show existing POs with countdown */}
                                      {component.pending_pos && component.pending_pos.length > 0 && (
                                        <div style={{ marginBottom: 8 }}>
                                          <Tag color="green" style={{ fontSize: '11px', marginBottom: 4 }}>
                                            ✓ PO {component.pending_pos[0].po_number}
                                          </Tag>
                                          <div style={{ fontSize: '12px', color: '#52c41a', fontWeight: 'bold' }}>
                                            Arrives {dayjs(component.pending_pos[0].expected_date).format('MMM D')} ({dayjs(component.pending_pos[0].expected_date).diff(dayjs(), 'day')}d)
                                          </div>
                                        </div>
                                      )}
                                      {/* Always show Create PO button */}
                                      <Button
                                        type="primary"
                                        size="small"
                                        icon={<PlusOutlined />}
                                        onClick={() => {
                                          setSelectedComponent(component);
                                          setIsPOModalOpen(true);
                                        }}
                                        block
                                      >
                                        Create PO
                                      </Button>
                                    </Space>
                                  </Col>
                                </Row>

                                {/* Mini Timeline - Next 14 Workdays */}
                                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                                  <div style={{ fontSize: '11px', color: '#999', marginBottom: 8, textTransform: 'uppercase', fontWeight: 'bold' }}>
                                    14 Workday Projection (Mon-Fri)
                                  </div>
                                  <div style={{ display: 'flex', gap: 2, height: '70px', alignItems: 'center', position: 'relative' }}>
                                    {/* Zero line for negative values */}
                                    <div style={{
                                      position: 'absolute',
                                      left: 0,
                                      right: 0,
                                      top: '50%',
                                      height: '1px',
                                      backgroundColor: '#d9d9d9',
                                      zIndex: 1
                                    }} />

                                    {daysWithWeekends.map((item, idx) => {
                                      if (item.type === 'weekend') {
                                        // Weekend separator - show a thin line
                                        return (
                                          <div key={`weekend-${idx}`} style={{
                                            width: '2px',
                                            height: '60px',
                                            backgroundColor: '#e0e0e0',
                                            alignSelf: 'center',
                                            position: 'relative',
                                            zIndex: 2
                                          }}>
                                            <div style={{
                                              position: 'absolute',
                                              bottom: '-16px',
                                              left: '50%',
                                              transform: 'translateX(-50%)',
                                              fontSize: '8px',
                                              color: '#bbb',
                                              whiteSpace: 'nowrap'
                                            }}>
                                              {dayjs(item.date).format('ddd')}
                                            </div>
                                          </div>
                                        );
                                      }

                                      const day = item.data!;
                                      const workdayIdx = daysWithWeekends.slice(0, idx).filter(d => d.type === 'day').length;
                                      const isPositive = day.projected_inventory >= 0;
                                      const absInventory = Math.abs(day.projected_inventory);
                                      const barHeight = maxProjected > 0 ? (absInventory / maxProjected) * 100 : 0;
                                      const hasPO = day.incoming_po > 0;
                                      const isToday = workdayIdx === 0;

                                      return (
                                        <Tooltip
                                          key={idx}
                                          title={
                                            <div style={{ fontSize: '11px' }}>
                                              <div><strong>{dayjs(day.date).format('MMM D (ddd)')}</strong></div>
                                              <div>Consumption: {day.consumption.toLocaleString()}</div>
                                              {hasPO && <div style={{ color: '#52c41a' }}>PO Arrival: +{day.incoming_po.toLocaleString()}</div>}
                                              <div>Projected: {Math.round(day.projected_inventory).toLocaleString()}</div>
                                            </div>
                                          }
                                        >
                                          <div style={{
                                            flex: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            height: '100%',
                                            position: 'relative',
                                            zIndex: 3
                                          }}>
                                            <div style={{
                                              display: 'flex',
                                              flexDirection: 'column',
                                              alignItems: 'center',
                                              width: '100%'
                                            }}>
                                              {/* Positive inventory - bar extends upward */}
                                              {isPositive && (
                                                <>
                                                  <div style={{
                                                    width: '100%',
                                                    height: `${barHeight / 2}%`,
                                                    maxHeight: '30px',
                                                    backgroundColor: isToday ? '#1890ff' : '#91d5ff',
                                                    borderRadius: '2px 2px 0 0',
                                                    minHeight: barHeight > 0 ? '4px' : '0',
                                                    transition: 'all 0.3s ease',
                                                    position: 'relative'
                                                  }}>
                                                    {hasPO && (
                                                      <div
                                                        style={{
                                                          position: 'absolute',
                                                          top: '-10px',
                                                          left: 0,
                                                          right: 0,
                                                          height: '8px',
                                                          backgroundColor: '#faad14',
                                                          borderRadius: '2px 2px 0 0',
                                                          cursor: 'pointer'
                                                        }}
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handlePOBarClick(component, day.date);
                                                        }}
                                                      />
                                                    )}
                                                  </div>
                                                </>
                                              )}

                                              {/* Negative inventory - bar extends downward */}
                                              {!isPositive && (
                                                <>
                                                  <div style={{
                                                    width: '100%',
                                                    height: `${barHeight / 2}%`,
                                                    maxHeight: '30px',
                                                    backgroundColor: '#ff4d4f',
                                                    borderRadius: '0 0 2px 2px',
                                                    minHeight: barHeight > 0 ? '4px' : '2px',
                                                    transition: 'all 0.3s ease',
                                                    position: 'relative'
                                                  }}>
                                                    {hasPO && (
                                                      <div
                                                        style={{
                                                          position: 'absolute',
                                                          top: '-10px',
                                                          left: 0,
                                                          right: 0,
                                                          height: '8px',
                                                          backgroundColor: '#faad14',
                                                          borderRadius: '2px 2px 0 0',
                                                          cursor: 'pointer'
                                                        }}
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handlePOBarClick(component, day.date);
                                                        }}
                                                      />
                                                    )}
                                                  </div>
                                                </>
                                              )}
                                            </div>

                                            <div style={{
                                              fontSize: '9px',
                                              color: isToday ? '#1890ff' : '#999',
                                              fontWeight: isToday ? 'bold' : 'normal',
                                              marginTop: 6,
                                              position: 'absolute',
                                              bottom: '-20px'
                                            }}>
                                              {dayjs(day.date).format('D')}
                                            </div>
                                          </div>
                                        </Tooltip>
                                      );
                                    })}
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, fontSize: '10px', color: '#999' }}>
                                    <span>Today</span>
                                    <span>{dayjs(workdays[workdays.length - 1]?.date).format('MMM D')}</span>
                                  </div>
                                </div>
                              </Card>
                            </Col>
                          );
                        })}
                    </Row>

                    {/* Expansion Button */}
                    {(() => {
                      const totalComponents = materialAnalysis.components.filter(c => c.run_out_date !== null).length;

                      if (componentDisplayCount === 5 && totalComponents > 5) {
                        return (
                          <div style={{ textAlign: 'center', marginTop: 16 }}>
                            <Button
                              type="default"
                              onClick={() => setComponentDisplayCount(10)}
                              style={{ minWidth: '200px' }}
                            >
                              Show Next 5 Components
                            </Button>
                          </div>
                        );
                      } else if (componentDisplayCount === 10 && totalComponents > 10) {
                        return (
                          <div style={{ textAlign: 'center', marginTop: 16 }}>
                            <Button
                              type="default"
                              onClick={() => setComponentDisplayCount(totalComponents)}
                              style={{ minWidth: '200px' }}
                            >
                              Show All {totalComponents - 10} Remaining Components
                            </Button>
                          </div>
                        );
                      } else if (componentDisplayCount > 10) {
                        return (
                          <div style={{ textAlign: 'center', marginTop: 16 }}>
                            <Button
                              type="default"
                              onClick={() => setComponentDisplayCount(5)}
                              style={{ minWidth: '200px' }}
                            >
                              Show Top 5 Only
                            </Button>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}

                {/* Calendar View */}
                <div style={{ marginTop: 24, marginBottom: 24 }}>
                  <h3 style={{ marginBottom: 16 }}>
                    <CalendarOutlined style={{ marginRight: 8 }} />
                    Component Run-Out Calendar
                  </h3>
                  <Card>
                    {(() => {
                      // Build a map of dates to components that run out on that date
                      const runOutsByDate = new Map<string, ComponentAnalysis[]>();

                      materialAnalysis.components.forEach(comp => {
                        if (comp.run_out_date) {
                          const dateKey = dayjs(comp.run_out_date).format('YYYY-MM-DD');
                          if (!runOutsByDate.has(dateKey)) {
                            runOutsByDate.set(dateKey, []);
                          }
                          runOutsByDate.get(dateKey)!.push(comp);
                        }
                      });

                      const dateCellRender = (value: dayjs.Dayjs) => {
                        const dateKey = value.format('YYYY-MM-DD');
                        const components = runOutsByDate.get(dateKey) || [];

                        if (components.length === 0) return null;

                        // Sort by urgency (most urgent first)
                        const sortedComponents = components.sort((a, b) => a.days_of_inventory - b.days_of_inventory);

                        // Show top 4 components, with "+X more" indicator
                        const displayComponents = sortedComponents.slice(0, 4);
                        const remainingCount = sortedComponents.length - 4;

                        return (
                          <div style={{
                            padding: '4px 2px',
                            fontSize: '11px',
                            lineHeight: '1.4',
                            overflow: 'hidden'
                          }}>
                            {displayComponents.map((comp, idx) => {
                              const urgency = getUrgencyInfo(
                                comp.days_of_inventory,
                                comp.critical_days,
                                comp.warning_days,
                                comp.caution_days,
                                comp.is_stagnant
                              );
                              const criticalThreshold = comp.critical_days || 7;
                              const warningThreshold = comp.warning_days || 14;
                              const icon = comp.days_of_inventory < criticalThreshold ? '🔴' : comp.days_of_inventory < warningThreshold ? '🟡' : '🟠';

                              return (
                                <div
                                  key={comp.component_id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '2px 4px',
                                    marginBottom: idx < displayComponents.length - 1 ? '2px' : '0',
                                    backgroundColor: urgency.bgColor,
                                    borderRadius: '3px',
                                    fontSize: '10px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}
                                  title={`${comp.component_code} - ${comp.component_name} (${comp.days_of_inventory} days left)`}
                                >
                                  <span style={{ fontSize: '9px' }}>{icon}</span>
                                  <span style={{
                                    fontWeight: 'bold',
                                    color: urgency.color,
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}>
                                    {comp.component_code}
                                  </span>
                                  <span style={{
                                    fontSize: '9px',
                                    color: urgency.color,
                                    fontWeight: 'bold'
                                  }}>
                                    {comp.days_of_inventory}d
                                  </span>
                                </div>
                              );
                            })}
                            {remainingCount > 0 && (
                              <div style={{
                                fontSize: '9px',
                                color: '#999',
                                textAlign: 'center',
                                marginTop: '2px',
                                fontStyle: 'italic'
                              }}>
                                +{remainingCount} more
                              </div>
                            )}
                          </div>
                        );
                      };

                      const onSelect = (value: dayjs.Dayjs) => {
                        const dateKey = value.format('YYYY-MM-DD');
                        const components = runOutsByDate.get(dateKey) || [];

                        if (components.length > 0) {
                          // Sort by urgency
                          const sortedComponents = components.sort((a, b) => a.days_of_inventory - b.days_of_inventory);
                          setSelectedDateComponents(sortedComponents);
                          setSelectedDate(value);
                          setIsDateModalOpen(true);
                        }
                      };

                      return (
                        <Calendar
                          dateCellRender={dateCellRender}
                          onSelect={onSelect}
                          fullscreen={true}
                        />
                      );
                    })()}
                  </Card>
                </div>

                {/* Timeline Visualization */}
                <div style={{ marginTop: 24 }}>
                  <h3 style={{ marginBottom: 16 }}>Inventory Runway Timeline (All Components)</h3>
                  <div style={{ backgroundColor: '#fafafa', padding: '16px', borderRadius: '8px' }}>
                    {materialAnalysis.components.map((component) => {
                      const urgency = getUrgencyInfo(
                        component.days_of_inventory,
                        component.critical_days,
                        component.warning_days,
                        component.caution_days,
                        component.is_stagnant
                      );
                      const maxDays = 90;
                      const barWidth = component.run_out_date
                        ? Math.min((component.days_of_inventory / maxDays) * 100, 100)
                        : 100;

                      return (
                        <div
                          key={component.component_id}
                          style={{
                            marginBottom: '12px',
                            padding: '12px',
                            backgroundColor: 'white',
                            borderRadius: '6px',
                            border: `1px solid ${urgency.borderColor}`,
                          }}
                        >
                          <Row gutter={8} align="middle">
                            <Col span={4}>
                              <div style={{ fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {component.is_stagnant && (
                                  <Tooltip title="Not part of any active production goals">
                                    <PauseCircleOutlined style={{ color: '#8c8c8c', fontSize: '14px' }} />
                                  </Tooltip>
                                )}
                                {component.component_code}
                              </div>
                              <div style={{ fontSize: '11px', color: '#999' }}>
                                Stock: {Math.round(component.current_stock).toLocaleString()}
                              </div>
                            </Col>
                            <Col span={16}>
                              <div style={{ position: 'relative', height: '30px' }}>
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '100%',
                                    height: '8px',
                                    backgroundColor: '#f0f0f0',
                                    borderRadius: '4px',
                                  }}
                                />
                                <Tooltip
                                  title={
                                    component.is_stagnant
                                      ? 'No active production goals set for products using this component'
                                      : component.run_out_date
                                      ? `Runs out on ${dayjs(component.run_out_date).format('MMM D, YYYY')} (${component.days_of_inventory} days)`
                                      : 'Sufficient inventory for 90+ days'
                                  }
                                >
                                  <div
                                    style={{
                                      position: 'absolute',
                                      left: 0,
                                      top: '50%',
                                      transform: 'translateY(-50%)',
                                      width: `${barWidth}%`,
                                      height: '16px',
                                      backgroundColor: urgency.color,
                                      borderRadius: '8px',
                                      transition: 'width 0.3s ease',
                                      cursor: 'pointer',
                                    }}
                                  />
                                </Tooltip>
                              </div>
                            </Col>
                            <Col span={4} style={{ textAlign: 'right' }}>
                              <Tag color={urgency.color} style={{ fontWeight: 'bold' }}>
                                {component.run_out_date ? `${component.days_of_inventory}d` : '90+ days'}
                              </Tag>
                            </Col>
                          </Row>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()
              },
              {
                key: 'history',
                label: (
                  <span>
                    <HistoryOutlined /> History
                  </span>
                ),
                children: (() => {
                  if (loadingHistory) {
                    return (
                      <div style={{ textAlign: 'center', padding: '50px' }}>
                        <Spin size="large" />
                      </div>
                    );
                  }

                  if (!historyData || !historyData.components || historyData.components.length === 0) {
                    return (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                          <Select
                            value={historyDays}
                            onChange={setHistoryDays}
                            style={{ width: 150 }}
                            options={[
                              { label: 'Last 30 Days', value: 30 },
                              { label: 'Last 60 Days', value: 60 },
                              { label: 'Last 90 Days', value: 90 },
                            ]}
                          />
                        </div>
                        <Alert
                          message="No History Data"
                          description="No historical inventory data available for the selected time period."
                          type="info"
                          showIcon
                        />
                      </div>
                    );
                  }

                  // Calculate summary metrics
                  const totalEvents = historyData.components.reduce((sum: number, comp: any) =>
                    sum + comp.daily_history.reduce((eventSum: number, day: any) =>
                      eventSum + day.events.length, 0), 0);

                  const componentsWithActivity = historyData.components.filter((comp: any) =>
                    comp.daily_history.some((d: any) => d.events.length > 0)
                  ).length;

                  // Calculate net inventory change
                  const totalNetChange = historyData.components.reduce((sum: number, comp: any) => {
                    const startLevel = comp.daily_history[0]?.inventory_level || 0;
                    const endLevel = comp.current_stock;
                    return sum + (endLevel - startLevel);
                  }, 0);

                  // Find components with significant changes (>30%)
                  const criticalChanges = historyData.components.filter((comp: any) => {
                    const startLevel = comp.daily_history[0]?.inventory_level || 0;
                    const endLevel = comp.current_stock;
                    if (startLevel === 0) return false;
                    const percentChange = Math.abs(((endLevel - startLevel) / startLevel) * 100);
                    return percentChange >= 30;
                  }).length;

                  // Get most recent event
                  let mostRecentEvent: any = null;
                  let mostRecentDate: Date | null = null;
                  historyData.components.forEach((comp: any) => {
                    comp.daily_history.forEach((day: any) => {
                      if (day.events.length > 0) {
                        const dayDate = new Date(day.date);
                        if (!mostRecentDate || dayDate > mostRecentDate) {
                          mostRecentDate = dayDate;
                          mostRecentEvent = { component: comp, date: day.date, events: day.events };
                        }
                      }
                    });
                  });

                  // Collect all events with dates and components for the timeline
                  const allEvents: any[] = [];
                  historyData.components.forEach((comp: any) => {
                    comp.daily_history.forEach((day: any) => {
                      day.events.forEach((event: any) => {
                        allEvents.push({
                          component_code: comp.component_code,
                          component_name: comp.component_name,
                          date: day.date,
                          ...event
                        });
                      });
                    });
                  });

                  // Sort events by date (most recent first) and take top 20
                  allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                  const recentEvents = allEvents.slice(0, 20);

                  // Group events by date for timeline
                  const eventsByDate = new Map<string, any[]>();
                  recentEvents.forEach(event => {
                    const dateKey = dayjs(event.date).format('YYYY-MM-DD');
                    if (!eventsByDate.has(dateKey)) {
                      eventsByDate.set(dateKey, []);
                    }
                    eventsByDate.get(dateKey)!.push(event);
                  });

                  // Prepare component summary table data
                  const componentSummaryData = historyData.components.map((comp: any) => {
                    const startLevel = comp.daily_history[0]?.inventory_level || 0;
                    const endLevel = comp.current_stock;
                    const netChange = endLevel - startLevel;
                    const percentChange = startLevel !== 0 ? ((netChange / startLevel) * 100) : 0;
                    const eventCount = comp.daily_history.reduce((sum: number, day: any) => sum + day.events.length, 0);

                    // Count event types
                    const eventTypes = { po_receipt: 0, consumption: 0, production: 0, adjustment: 0 };
                    comp.daily_history.forEach((day: any) => {
                      day.events.forEach((event: any) => {
                        if (event.type === 'po_receipt') eventTypes.po_receipt++;
                        else if (event.type === 'production_consumption') eventTypes.consumption++;
                        else if (event.type === 'production_output') eventTypes.production++;
                        else eventTypes.adjustment++;
                      });
                    });

                    return {
                      component_id: comp.component_id,
                      component_code: comp.component_code,
                      component_name: comp.component_name,
                      start_inventory: startLevel,
                      current_inventory: endLevel,
                      net_change: netChange,
                      percent_change: percentChange,
                      event_count: eventCount,
                      event_types: eventTypes,
                      daily_history: comp.daily_history
                    };
                  });

                  // Event type icon helper
                  const getEventIcon = (type: string) => {
                    switch (type) {
                      case 'po_receipt': return '📦';
                      case 'production_consumption': return '🔻';
                      case 'production_output': return '🔺';
                      case 'adjustment': return '📝';
                      case 'physical_count': return '📋';
                      case 'scrap': return '🗑️';
                      default: return '📝';
                    }
                  };

                  const getEventColor = (type: string) => {
                    switch (type) {
                      case 'po_receipt': return '#52c41a';
                      case 'production_consumption': return '#ff4d4f';
                      case 'production_output': return '#722ed1';
                      default: return '#faad14';
                    }
                  };

                  const getEventLabel = (type: string) => {
                    switch (type) {
                      case 'po_receipt': return 'PO Receipt';
                      case 'production_consumption': return 'Consumption';
                      case 'production_output': return 'Production';
                      case 'physical_count': return 'Physical Count';
                      case 'scrap': return 'Scrap';
                      default: return 'Adjustment';
                    }
                  };

                  // Component summary table columns
                  const componentSummaryColumns = [
                    {
                      title: 'Component',
                      key: 'component',
                      width: 250,
                      render: (record: any) => (
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{record.component_code}</div>
                          <div style={{ fontSize: '12px', color: '#666' }}>{record.component_name}</div>
                        </div>
                      ),
                      sorter: (a: any, b: any) => a.component_code.localeCompare(b.component_code),
                    },
                    {
                      title: 'Start Inv.',
                      dataIndex: 'start_inventory',
                      key: 'start_inventory',
                      align: 'right' as const,
                      width: 100,
                      render: (value: number) => Math.round(value).toLocaleString(),
                      sorter: (a: any, b: any) => a.start_inventory - b.start_inventory,
                    },
                    {
                      title: 'Current Inv.',
                      dataIndex: 'current_inventory',
                      key: 'current_inventory',
                      align: 'right' as const,
                      width: 110,
                      render: (value: number) => (
                        <strong style={{ color: '#1890ff' }}>{Math.round(value).toLocaleString()}</strong>
                      ),
                      sorter: (a: any, b: any) => a.current_inventory - b.current_inventory,
                    },
                    {
                      title: 'Net Change',
                      key: 'change',
                      align: 'right' as const,
                      width: 120,
                      render: (record: any) => {
                        const change = record.net_change;
                        const percent = record.percent_change;
                        const color = change > 0 ? '#52c41a' : change < 0 ? '#ff4d4f' : '#666';
                        const arrow = change > 0 ? '↗' : change < 0 ? '↘' : '→';
                        return (
                          <div style={{ color }}>
                            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                              {change > 0 ? '+' : ''}{Math.round(change).toLocaleString()} {arrow}
                            </div>
                            <div style={{ fontSize: '11px' }}>
                              ({percent > 0 ? '+' : ''}{percent.toFixed(1)}%)
                            </div>
                          </div>
                        );
                      },
                      sorter: (a: any, b: any) => a.net_change - b.net_change,
                    },
                    {
                      title: 'Events',
                      dataIndex: 'event_count',
                      key: 'event_count',
                      align: 'center' as const,
                      width: 80,
                      render: (value: number) => (
                        <Tag color={value > 0 ? 'blue' : 'default'}>{value}</Tag>
                      ),
                      sorter: (a: any, b: any) => a.event_count - b.event_count,
                    },
                    {
                      title: 'Event Breakdown',
                      key: 'event_breakdown',
                      width: 200,
                      render: (record: any) => {
                        const types = record.event_types;
                        return (
                          <div style={{ fontSize: '11px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {types.po_receipt > 0 && <span>📦 {types.po_receipt}</span>}
                            {types.consumption > 0 && <span>🔻 {types.consumption}</span>}
                            {types.production > 0 && <span>🔺 {types.production}</span>}
                            {types.adjustment > 0 && <span>📝 {types.adjustment}</span>}
                          </div>
                        );
                      }
                    },
                    {
                      title: 'Trend',
                      key: 'trend',
                      width: 150,
                      render: (record: any) => {
                        const maxLevel = Math.max(...record.daily_history.map((d: any) => d.inventory_level), 1);
                        return (
                          <div style={{ display: 'flex', gap: 1, height: '30px', alignItems: 'flex-end' }}>
                            {record.daily_history.map((day: any, idx: number) => {
                              const barHeight = maxLevel > 0 ? (Math.max(0, day.inventory_level) / maxLevel) * 100 : 0;
                              return (
                                <div
                                  key={idx}
                                  style={{
                                    flex: 1,
                                    height: `${barHeight}%`,
                                    backgroundColor: '#1890ff',
                                    minHeight: barHeight > 0 ? '2px' : '0',
                                    opacity: 0.6
                                  }}
                                />
                              );
                            })}
                          </div>
                        );
                      }
                    }
                  ];

                  return (
                    <div>
                      {/* Header with date range selector */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <span style={{ fontSize: '14px', color: '#666' }}>
                          Historical inventory levels and events
                        </span>
                        <Select
                          value={historyDays}
                          onChange={setHistoryDays}
                          style={{ width: 150 }}
                          options={[
                            { label: 'Last 30 Days', value: 30 },
                            { label: 'Last 60 Days', value: 60 },
                            { label: 'Last 90 Days', value: 90 },
                          ]}
                        />
                      </div>

                      {/* Quick Stats Cards */}
                      <Row gutter={16} style={{ marginBottom: 24 }}>
                        <Col span={6}>
                          <Card size="small" style={{ borderColor: '#1890ff', backgroundColor: '#e6f7ff' }}>
                            <Statistic
                              title="Components with Activity"
                              value={componentsWithActivity}
                              suffix={`/ ${historyData.components.length}`}
                              valueStyle={{ color: '#1890ff', fontSize: '24px' }}
                            />
                          </Card>
                        </Col>
                        <Col span={6}>
                          <Card size="small" style={{ borderColor: totalNetChange >= 0 ? '#52c41a' : '#ff4d4f', backgroundColor: totalNetChange >= 0 ? '#f6ffed' : '#fff2f0' }}>
                            <Statistic
                              title="Total Net Change"
                              value={Math.abs(Math.round(totalNetChange))}
                              prefix={totalNetChange >= 0 ? '+' : '-'}
                              valueStyle={{ color: totalNetChange >= 0 ? '#52c41a' : '#ff4d4f', fontSize: '24px' }}
                            />
                          </Card>
                        </Col>
                        <Col span={6}>
                          <Card size="small" style={{ borderColor: '#faad14', backgroundColor: '#fffbe6' }}>
                            <Statistic
                              title="Critical Changes"
                              value={criticalChanges}
                              suffix="components"
                              valueStyle={{ color: '#faad14', fontSize: '24px' }}
                            />
                            <div style={{ fontSize: '11px', color: '#666', marginTop: 4 }}>±30% or more</div>
                          </Card>
                        </Col>
                        <Col span={6}>
                          <Card size="small" style={{ borderColor: '#722ed1', backgroundColor: '#f9f0ff' }}>
                            <Statistic
                              title="Total Events"
                              value={totalEvents}
                              valueStyle={{ color: '#722ed1', fontSize: '24px' }}
                            />
                            {mostRecentEvent && (
                              <div style={{ fontSize: '11px', color: '#666', marginTop: 4 }}>
                                Last: {dayjs(mostRecentEvent.date).fromNow()}
                              </div>
                            )}
                          </Card>
                        </Col>
                      </Row>

                      {/* Recent Activity Timeline */}
                      <Card
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ClockCircleOutlined style={{ fontSize: '16px' }} />
                            <span>Recent Activity</span>
                            <span style={{ fontSize: '12px', color: '#666', fontWeight: 'normal' }}>
                              (Last 20 events)
                            </span>
                          </div>
                        }
                        size="small"
                        style={{ marginBottom: 24 }}
                      >
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                          {Array.from(eventsByDate.entries()).map(([dateKey, events]) => {
                            const date = dayjs(dateKey);
                            const isToday = date.isSame(dayjs(), 'day');
                            const isYesterday = date.isSame(dayjs().subtract(1, 'day'), 'day');

                            let dateLabel = date.format('dddd, MMM D');
                            if (isToday) dateLabel = 'Today, ' + date.format('MMM D');
                            else if (isYesterday) dateLabel = 'Yesterday, ' + date.format('MMM D');

                            return (
                              <div key={dateKey} style={{ marginBottom: 16 }}>
                                <div style={{
                                  fontSize: '13px',
                                  fontWeight: 'bold',
                                  color: '#1890ff',
                                  marginBottom: 8,
                                  paddingBottom: 4,
                                  borderBottom: '1px solid #f0f0f0'
                                }}>
                                  {dateLabel}
                                </div>
                                <div style={{ paddingLeft: 8 }}>
                                  {events.map((event, idx) => (
                                    <div
                                      key={idx}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 12,
                                        marginBottom: 8,
                                        padding: '8px',
                                        backgroundColor: '#fafafa',
                                        borderRadius: '4px',
                                        borderLeft: `3px solid ${getEventColor(event.type)}`
                                      }}
                                    >
                                      <div style={{ fontSize: '18px', lineHeight: '1' }}>
                                        {getEventIcon(event.type)}
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                                          <Tag color={getEventColor(event.type)} style={{ margin: 0, fontSize: '11px' }}>
                                            {getEventLabel(event.type)}
                                          </Tag>
                                          <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
                                            {event.component_code}
                                          </span>
                                          <span style={{ fontSize: '12px', color: '#666' }}>
                                            {event.component_name}
                                          </span>
                                        </div>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: event.quantity_change > 0 ? '#52c41a' : '#ff4d4f' }}>
                                          {event.quantity_change > 0 ? '+' : ''}{Math.round(event.quantity_change).toLocaleString()} units
                                        </div>
                                        {event.reason && (
                                          <div style={{ fontSize: '12px', color: '#666', marginTop: 2 }}>
                                            {event.reason}
                                          </div>
                                        )}
                                        {event.notes && (
                                          <div style={{ fontSize: '11px', color: '#999', marginTop: 2, fontStyle: 'italic' }}>
                                            Note: {event.notes}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </Card>

                      {/* Component Summary Table */}
                      <Card
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <DashboardOutlined style={{ fontSize: '16px' }} />
                            <span>Component Summary</span>
                          </div>
                        }
                        size="small"
                      >
                        <Table
                          dataSource={componentSummaryData}
                          columns={componentSummaryColumns}
                          rowKey="component_id"
                          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Total ${total} components` }}
                          size="small"
                          scroll={{ x: 1200 }}
                        />
                      </Card>
                    </div>
                  );
                })()
              }
            ]}
          />
        </Card>
      )}

      {/* PO Creation Modal */}
      <CreatePOModal
        isOpen={isPOModalOpen}
        onClose={() => {
          setIsPOModalOpen(false);
          setSelectedComponent(null);
        }}
        onSuccess={() => {
          loadMaterialAnalysis();
        }}
        componentId={selectedComponent?.component_id}
        componentCode={selectedComponent?.component_code}
        componentName={selectedComponent?.component_name}
        suggestedQuantity={selectedComponent?.reorder_qty}
        suggestedDate={selectedComponent?.run_out_date || undefined}
        leadTimeDays={selectedComponent?.lead_time_days}
      />

      {/* Date Components Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarOutlined />
            <span>Components Running Out on {selectedDate?.format('MMMM D, YYYY')}</span>
          </div>
        }
        open={isDateModalOpen}
        onCancel={() => setIsDateModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsDateModalOpen(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#fafafa', borderRadius: 4 }}>
            <strong>{selectedDateComponents.length}</strong> component{selectedDateComponents.length !== 1 ? 's' : ''} will run out on this date
          </div>

          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {selectedDateComponents.map((comp) => {
              const urgency = getUrgencyInfo(
                comp.days_of_inventory,
                comp.critical_days,
                comp.warning_days,
                comp.caution_days,
                comp.is_stagnant
              );
              const criticalThreshold = comp.critical_days || 7;
              const warningThreshold = comp.warning_days || 14;
              const icon = comp.days_of_inventory < criticalThreshold ? '🔴' : comp.days_of_inventory < warningThreshold ? '🟡' : '🟠';

              return (
                <Card
                  key={comp.component_id}
                  size="small"
                  style={{
                    borderLeft: `4px solid ${urgency.color}`,
                    backgroundColor: urgency.bgColor
                  }}
                >
                  <Row gutter={16} align="middle">
                    <Col span={1}>
                      <span style={{ fontSize: '20px' }}>{icon}</span>
                    </Col>
                    <Col span={5}>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                        {comp.component_code}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {comp.component_name}
                      </div>
                    </Col>
                    <Col span={4}>
                      <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>Current Stock</div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                        {Math.round(comp.current_stock).toLocaleString()}
                      </div>
                    </Col>
                    <Col span={3}>
                      <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>Days Left</div>
                      <div style={{ fontWeight: 'bold', fontSize: '16px', color: urgency.color }}>
                        {comp.days_of_inventory}
                      </div>
                    </Col>
                    <Col span={5}>
                      <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>Used In</div>
                      <div style={{ fontSize: '12px' }}>
                        {comp.used_in_products.map(p => p.code).join(', ')}
                      </div>
                    </Col>
                    <Col span={3}>
                      <Tag color={urgency.color} style={{ fontWeight: 'bold' }}>
                        {urgency.label}
                      </Tag>
                    </Col>
                    <Col span={3}>
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          setSelectedComponent(comp);
                          setIsPOModalOpen(true);
                          setIsDateModalOpen(false);
                        }}
                        block
                      >
                        Create PO
                      </Button>
                    </Col>
                  </Row>
                </Card>
              );
            })}
          </Space>
        </div>
      </Modal>

      {/* PO Detail Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCartOutlined />
            <span>Purchase Order Details - {selectedPOComponent?.component_code}</span>
          </div>
        }
        open={isPODetailModalOpen}
        onCancel={() => {
          setIsPODetailModalOpen(false);
          setSelectedPOs([]);
          setSelectedPOComponent(null);
          receivePOForm.resetFields();
        }}
        footer={null}
        width={700}
      >
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#fafafa', borderRadius: 4 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
              {selectedPOComponent?.component_name}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Current Stock: {selectedPOComponent?.current_stock?.toLocaleString()} |
              Days of Inventory: {selectedPOComponent?.days_of_inventory}
            </div>
          </div>

          {selectedPOs.length === 1 ? (
            // Single PO - show receive form directly
            <Card size="small">
              <div style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>PO Number</div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{selectedPOs[0].po_number}</div>
                  </Col>
                  <Col span={12}>
                    <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>Supplier</div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{selectedPOs[0].supplier || 'N/A'}</div>
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 12 }}>
                  <Col span={8}>
                    <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>Quantity</div>
                    <div style={{ fontWeight: 'bold' }}>{selectedPOs[0].quantity.toLocaleString()}</div>
                  </Col>
                  <Col span={8}>
                    <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>Order Date</div>
                    <div>{dayjs(selectedPOs[0].order_date).format('MMM D, YYYY')}</div>
                  </Col>
                  <Col span={8}>
                    <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>Expected Date</div>
                    <div>{dayjs(selectedPOs[0].expected_date).format('MMM D, YYYY')}</div>
                  </Col>
                </Row>
              </div>

              <Form
                form={receivePOForm}
                layout="vertical"
                onFinish={(values) => handleReceivePO(values, selectedPOs[0].po_id)}
                initialValues={{
                  received_date: dayjs(),
                  received_quantity: selectedPOs[0].quantity
                }}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="received_date"
                      label="Received Date"
                      rules={[{ required: true, message: 'Please select received date' }]}
                    >
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="received_quantity"
                      label="Received Quantity"
                      rules={[{ required: true, message: 'Please enter quantity' }]}
                    >
                      <Input type="number" />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="notes" label="Notes">
                  <Input.TextArea rows={2} placeholder="Optional notes about this receipt" />
                </Form.Item>
                <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit">
                      Receive This PO
                    </Button>
                    <Button onClick={() => {
                      setIsPODetailModalOpen(false);
                      receivePOForm.resetFields();
                    }}>
                      Cancel
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </Card>
          ) : (
            // Multiple POs - show list to select from
            <div>
              <div style={{ marginBottom: 12, fontWeight: 'bold' }}>
                {selectedPOs.length} Purchase Orders Expected on {dayjs(selectedPOs[0]?.expected_date).format('MMM D, YYYY')}
              </div>
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {selectedPOs.map((po) => (
                  <Card
                    key={po.po_id}
                    size="small"
                    style={{ cursor: 'pointer' }}
                    hoverable
                    onClick={() => {
                      setSelectedPOs([po]);
                      receivePOForm.setFieldsValue({
                        received_date: dayjs(),
                        received_quantity: po.quantity
                      });
                    }}
                  >
                    <Row gutter={16} align="middle">
                      <Col span={8}>
                        <div style={{ fontSize: '11px', color: '#999' }}>PO Number</div>
                        <div style={{ fontWeight: 'bold' }}>{po.po_number}</div>
                      </Col>
                      <Col span={8}>
                        <div style={{ fontSize: '11px', color: '#999' }}>Supplier</div>
                        <div>{po.supplier || 'N/A'}</div>
                      </Col>
                      <Col span={4}>
                        <div style={{ fontSize: '11px', color: '#999' }}>Quantity</div>
                        <div style={{ fontWeight: 'bold' }}>{po.quantity.toLocaleString()}</div>
                      </Col>
                      <Col span={4}>
                        <Button type="primary" size="small" block>
                          Select
                        </Button>
                      </Col>
                    </Row>
                  </Card>
                ))}
              </Space>
            </div>
          )}
        </div>
      </Modal>

      {/* Today's POs Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCartOutlined />
            <span>Purchase Orders - Today & Overdue</span>
          </div>
        }
        open={isTodayPOModalOpen}
        onCancel={() => {
          setIsTodayPOModalOpen(false);
          setTodayPOs([]);
        }}
        footer={[
          <Button key="close" onClick={() => setIsTodayPOModalOpen(false)}>
            Close
          </Button>
        ]}
        width={900}
      >
        <div style={{ marginTop: 16 }}>
          {todayPOs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              No purchase orders arriving today or overdue
            </div>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {todayPOs.map(({ component, pos, product_code, product_name }, index) => (
                <Card
                  key={component?.component_id || `product-${index}`}
                  size="small"
                  title={
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                        {component ? `${component.component_code} - ${component.component_name}` : `${product_code} - ${product_name}`}
                      </div>
                      {component && (
                        <div style={{ fontSize: '12px', color: '#666', fontWeight: 'normal', marginTop: 4 }}>
                          Current Stock: {component.current_stock?.toLocaleString()} |
                          Days of Inventory: {component.days_of_inventory}
                        </div>
                      )}
                    </div>
                  }
                >
                  <Space direction="vertical" style={{ width: '100%' }} size="small">
                    {pos.map(po => {
                      const expectedDate = dayjs(po.expected_date);
                      const isOverdue = expectedDate.isBefore(dayjs(), 'day');
                      const isToday = expectedDate.isSame(dayjs(), 'day');

                      return (
                        <Card
                          key={po.po_id}
                          size="small"
                          style={{
                            borderLeft: isOverdue ? '4px solid #ff4d4f' : isToday ? '4px solid #1890ff' : '4px solid #52c41a',
                            cursor: 'pointer'
                          }}
                          hoverable
                          onClick={() => {
                            setSelectedPOComponent(component);
                            setSelectedPOs([po]);
                            receivePOForm.setFieldsValue({
                              received_date: dayjs(),
                              received_quantity: po.quantity
                            });
                            setIsTodayPOModalOpen(false);
                            setIsPODetailModalOpen(true);
                          }}
                        >
                          <Row gutter={16} align="middle">
                            <Col span={1}>
                              {isOverdue && <span style={{ fontSize: '20px' }}>🔴</span>}
                              {isToday && <span style={{ fontSize: '20px' }}>📦</span>}
                            </Col>
                            <Col span={5}>
                              <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>PO Number</div>
                              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{po.po_number}</div>
                            </Col>
                            <Col span={5}>
                              <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>Supplier</div>
                              <div>{po.supplier || 'N/A'}</div>
                            </Col>
                            <Col span={3}>
                              <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>Quantity</div>
                              <div style={{ fontWeight: 'bold' }}>{po.quantity.toLocaleString()}</div>
                            </Col>
                            <Col span={4}>
                              <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>Order Date</div>
                              <div>{dayjs(po.order_date).format('MMM D, YYYY')}</div>
                            </Col>
                            <Col span={4}>
                              <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' }}>Expected Date</div>
                              <div style={{ color: isOverdue ? '#ff4d4f' : isToday ? '#1890ff' : '#666' }}>
                                {expectedDate.format('MMM D, YYYY')}
                                {isOverdue && ' (OVERDUE)'}
                                {isToday && ' (TODAY)'}
                              </div>
                            </Col>
                            <Col span={2}>
                              <Button type="primary" size="small" block>
                                Receive
                              </Button>
                            </Col>
                          </Row>
                        </Card>
                      );
                    })}
                  </Space>
                </Card>
              ))}
            </Space>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default Dashboard;
