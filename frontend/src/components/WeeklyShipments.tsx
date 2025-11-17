import { useEffect, useState, useCallback } from 'react';
import { Card, Select, Button, Table, InputNumber, message, Progress, Row, Col, Statistic, Space, DatePicker, Segmented } from 'antd';
import { SaveOutlined, RocketOutlined, CheckCircleOutlined, WarningOutlined, LeftOutlined, RightOutlined, CalendarOutlined, BarChartOutlined, TrophyOutlined, FireOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ComposedChart, Area, ReferenceLine } from 'recharts';

dayjs.extend(isoWeek);

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

interface WeekRow {
  week_start_date: string;
  goal: number;
  shipped: number;
  shipped_before_today?: number;
  notes: string;
}

function WeeklyShipments() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [shipmentData, setShipmentData] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [startDate, setStartDate] = useState<Dayjs>(dayjs().startOf('isoWeek').subtract(2, 'week'));
  const [numWeeks, setNumWeeks] = useState<number>(16);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [viewMode, setViewMode] = useState<'entry' | 'analytics'>('entry');
  const [savedEntryStartDate, setSavedEntryStartDate] = useState<Dayjs | null>(null);
  const [savedEntryNumWeeks, setSavedEntryNumWeeks] = useState<number | null>(null);

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

  const loadShipments = async (productId: number, start: Dayjs, weeks: number) => {
    try {
      setLoading(true);

      // Generate the week starts we want
      const weekStarts = [];
      for (let i = 0; i < weeks; i++) {
        weekStarts.push(start.add(i, 'week').format('YYYY-MM-DD'));
      }

      const response = await axios.get(
        `/api/weekly-shipments/${productId}?weeks=${weeks}&start_date=${start.format('YYYY-MM-DD')}`
      );

      // Get data from API
      const apiData = response.data.shipments || response.data;
      const dataMap = new Map(apiData.map((item: WeekRow) => [item.week_start_date, item]));

      // Create full dataset with calculated weeks, filling in missing data
      const fullData = weekStarts.map(weekStart => {
        if (dataMap.has(weekStart)) {
          return dataMap.get(weekStart);
        } else {
          return {
            week_start_date: weekStart,
            goal: 0,
            shipped: 0,
            notes: ''
          };
        }
      });

      setShipmentData(fullData);
      setHasUnsavedChanges(false);
    } catch (error) {
      message.error('Error loading weekly shipments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      loadShipments(selectedProductId, startDate, numWeeks);
    }
  }, [selectedProductId, startDate, numWeeks]);

  // Auto-save function with debounce
  const autoSave = useCallback(
    debounce(async (productId: number, data: WeekRow[]) => {
      try {
        setAutoSaving(true);
        await axios.post('/api/weekly-shipments', {
          product_id: productId,
          weeks: data.map((row) => ({
            week_start_date: row.week_start_date,
            goal: row.goal,
            shipped: row.shipped,
            notes: row.notes || ''
          })),
        });
        setHasUnsavedChanges(false);
        message.success('Auto-saved', 1);
      } catch (error) {
        message.error('Error auto-saving data');
      } finally {
        setAutoSaving(false);
      }
    }, 1500),
    []
  );

  const handleFieldChange = (weekStart: string, field: 'goal', value: number | null) => {
    const newData = shipmentData.map((row) =>
      row.week_start_date === weekStart ? { ...row, [field]: value || 0 } : row
    );
    setShipmentData(newData);
    setHasUnsavedChanges(true);

    // Trigger auto-save
    if (selectedProductId) {
      autoSave(selectedProductId, newData);
    }
  };

  const handleManualSave = async () => {
    if (!selectedProductId) return;

    try {
      await axios.post('/api/weekly-shipments', {
        product_id: selectedProductId,
        weeks: shipmentData.map((row) => ({
          week_start_date: row.week_start_date,
          goal: row.goal,
          shipped: row.shipped,
          notes: row.notes || ''
        })),
      });
      setHasUnsavedChanges(false);
      message.success('Saved successfully');
    } catch (error) {
      message.error('Error saving data');
    }
  };

  const navigateWeeks = (direction: 'prev' | 'next') => {
    const change = direction === 'prev' ? -numWeeks : numWeeks;
    setStartDate(prev => prev.add(change, 'week'));
  };

  const goToToday = () => {
    setStartDate(dayjs().startOf('isoWeek').subtract(2, 'week'));
  };

  const handleDateChange = (date: Dayjs | null) => {
    if (date) {
      setStartDate(date.startOf('isoWeek'));
    }
  };

  // Calculate summary statistics
  const totalGoal = shipmentData.reduce((sum, row) => sum + (row.goal || 0), 0);
  const totalShipped = shipmentData.reduce((sum, row) => sum + (row.shipped || 0), 0);
  const overallProgress = totalGoal > 0 ? (totalShipped / totalGoal) * 100 : 0;
  const weeksOnTrack = shipmentData.filter(row => row.goal > 0 && row.shipped >= row.goal).length;
  const weeksBehind = shipmentData.filter(row => row.goal > 0 && row.shipped < row.goal).length;

  const columns = [
    {
      title: 'Week Starting',
      dataIndex: 'week_start_date',
      key: 'week_start_date',
      render: (date: string) => {
        const weekStart = dayjs(date);
        const weekEnd = weekStart.add(6, 'days');
        const isCurrentWeek = weekStart.isSame(dayjs().startOf('isoWeek'), 'day');
        const isPast = weekStart.isBefore(dayjs(), 'week');

        return (
          <div>
            <div style={{
              fontWeight: isCurrentWeek ? 'bold' : 'normal',
              color: isCurrentWeek ? '#1890ff' : isPast ? '#999' : 'inherit'
            }}>
              {isCurrentWeek && '→ '}Week of {weekStart.format('MMM D')}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {weekStart.format('MMM D')} - {weekEnd.format('MMM D, YYYY')}
            </div>
          </div>
        );
      },
      width: 200,
      fixed: 'left' as const,
    },
    {
      title: 'Goal',
      dataIndex: 'goal',
      key: 'goal',
      render: (goal: number, record: WeekRow) => (
        <InputNumber
          value={goal}
          onChange={(value) => handleFieldChange(record.week_start_date, 'goal', value)}
          style={{ width: '100%' }}
          min={0}
          precision={0}
        />
      ),
      width: 120,
      align: 'right' as const,
    },
    {
      title: 'Shipped',
      dataIndex: 'shipped',
      key: 'shipped',
      render: (shipped: number) => (
        <div style={{
          textAlign: 'right',
          padding: '4px 11px',
          color: shipped > 0 ? '#1890ff' : '#999',
          fontWeight: shipped > 0 ? 'bold' : 'normal',
          fontSize: '14px'
        }}>
          {Math.round(shipped).toLocaleString()}
        </div>
      ),
      width: 120,
      align: 'right' as const,
    },
    {
      title: 'Daily Goal',
      key: 'daily_goal',
      render: (_: any, record: WeekRow) => {
        const weekStart = dayjs(record.week_start_date);
        const isCurrentWeek = weekStart.isSame(dayjs().startOf('isoWeek'), 'day');

        if (!isCurrentWeek || record.goal === 0) {
          return <span style={{ color: '#999' }}>-</span>;
        }

        const today = dayjs();
        const today_weekday = today.day(); // Sunday=0, Monday=1, ..., Saturday=6

        // Only show daily goal on weekdays (Saturday=6, Sunday=0)
        if (today_weekday === 0 || today_weekday === 6) {
          return <span style={{ color: '#999' }}>Weekend</span>;
        }

        // Calculate workdays remaining (including today)
        // Monday=1 -> 5 days left, Tuesday=2 -> 4 days, Wed=3 -> 3 days, Thu=4 -> 2 days, Fri=5 -> 1 day
        const workdays_remaining = 6 - today_weekday;

        // Calculate how much is still needed for the week (excluding today's shipments)
        // Use shipped_before_today if available (only for current week), otherwise use total shipped
        const shipped_so_far = record.shipped_before_today !== undefined && record.shipped_before_today !== null
          ? record.shipped_before_today
          : record.shipped;
        const remaining_needed = Math.max(0, record.goal - shipped_so_far);

        // Dynamic daily goal is the catch-up target (remaining / days left including today)
        const daily_goal = workdays_remaining > 0 ? remaining_needed / workdays_remaining : 0;

        return (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 'bold', color: '#1890ff' }}>
              {Math.round(daily_goal).toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#666' }}>
              ({workdays_remaining}d left)
            </div>
          </div>
        );
      },
      width: 110,
      align: 'right' as const,
    },
    {
      title: 'Variance',
      key: 'variance',
      render: (_: any, record: WeekRow) => {
        const variance = record.shipped - record.goal;
        if (record.goal === 0) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        const color = variance >= 0 ? 'green' : 'red';
        const sign = variance >= 0 ? '+' : '';
        return (
          <span style={{ color, fontWeight: 'bold' }}>
            {sign}{variance}
          </span>
        );
      },
      width: 100,
      align: 'center' as const,
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_: any, record: WeekRow) => {
        const percent = record.goal > 0 ? (record.shipped / record.goal) * 100 : 0;
        const status = percent >= 100 ? 'success' : percent >= 80 ? 'normal' : 'exception';
        return (
          <div>
            <Progress
              percent={Math.min(percent, 100)}
              status={status}
              size="small"
              format={(pct) => `${pct?.toFixed(0)}%`}
            />
            {record.goal > 0 && (
              <div style={{ fontSize: '11px', color: '#666', marginTop: 4 }}>
                {record.shipped} / {record.goal} units
              </div>
            )}
          </div>
        );
      },
      width: 200,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: WeekRow) => {
        if (record.goal === 0) {
          return <span style={{ color: '#999' }}>No Goal Set</span>;
        }
        if (record.shipped >= record.goal) {
          return <span style={{ color: 'green', fontWeight: 'bold' }}>✓ Complete</span>;
        } else if (record.shipped >= record.goal * 0.8) {
          return <span style={{ color: 'orange', fontWeight: 'bold' }}>△ Close</span>;
        } else {
          return <span style={{ color: 'red', fontWeight: 'bold' }}>✗ Behind</span>;
        }
      },
      width: 120,
      align: 'center' as const,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Weekly Goals</h1>
        <Space>
          {autoSaving && <span style={{ color: '#1890ff' }}>Auto-saving...</span>}
          {hasUnsavedChanges && !autoSaving && <span style={{ color: '#faad14' }}>Unsaved changes</span>}
          <Button
            icon={<SaveOutlined />}
            onClick={handleManualSave}
            disabled={!selectedProductId || !hasUnsavedChanges}
          >
            Save Now
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16, backgroundColor: '#e6f7ff', borderColor: '#91d5ff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '16px' }}>ℹ️</span>
          <div>
            <strong>Note:</strong> The "Shipped" column is automatically calculated from daily entries in the Sales/Shipping tab.
            Only the "Goal" column is editable here.
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Segmented
            value={viewMode}
            onChange={(value) => {
              const newMode = value as 'entry' | 'analytics';
              if (newMode === 'analytics') {
                // Save current entry view settings
                setSavedEntryStartDate(startDate);
                setSavedEntryNumWeeks(numWeeks);
                // Switch to last 12 weeks for analytics
                setStartDate(dayjs().startOf('isoWeek').subtract(11, 'week'));
                setNumWeeks(12);
              } else if (newMode === 'entry') {
                // Restore entry view settings
                if (savedEntryStartDate) {
                  setStartDate(savedEntryStartDate);
                }
                if (savedEntryNumWeeks) {
                  setNumWeeks(savedEntryNumWeeks);
                }
              }
              setViewMode(newMode);
            }}
            options={[
              { label: 'Data Entry', value: 'entry', icon: <CalendarOutlined /> },
              { label: 'Analytics', value: 'analytics', icon: <BarChartOutlined /> },
            ]}
            size="large"
          />
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={12}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontWeight: 'bold' }}>Product:</span>
              <Select
                style={{ width: 350 }}
                value={selectedProductId}
                onChange={setSelectedProductId}
                options={products.map((p) => ({
                  value: p.id,
                  label: `${p.code} - ${p.name}`,
                }))}
              />
            </div>
          </Col>
          <Col span={12}>
            <Space style={{ float: 'right' }}>
              <span style={{ fontWeight: 'bold' }}>View:</span>
              <Select
                style={{ width: 120 }}
                value={numWeeks}
                onChange={setNumWeeks}
                options={[
                  { value: 4, label: '4 Weeks' },
                  { value: 8, label: '8 Weeks' },
                  { value: 12, label: '12 Weeks' },
                  { value: 16, label: '16 Weeks' },
                  { value: 26, label: '26 Weeks' },
                  { value: 52, label: '52 Weeks' },
                ]}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {viewMode === 'entry' && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={16} align="middle">
              <Col>
                <Space>
                  <Button
                    icon={<LeftOutlined />}
                    onClick={() => navigateWeeks('prev')}
                  >
                    Previous {numWeeks} Weeks
                  </Button>
                  <Button
                    icon={<CalendarOutlined />}
                    onClick={goToToday}
                  >
                    Go to Current Week
                  </Button>
                  <Button
                    icon={<RightOutlined />}
                    onClick={() => navigateWeeks('next')}
                  >
                    Next {numWeeks} Weeks
                  </Button>
                </Space>
              </Col>
              <Col flex="auto">
                <div style={{ textAlign: 'right' }}>
                  <Space>
                    <span style={{ fontWeight: 'bold' }}>Jump to Week:</span>
                    <DatePicker
                      value={startDate}
                      onChange={handleDateChange}
                      format="MMM D, YYYY"
                      picker="week"
                    />
                  </Space>
                </div>
              </Col>
            </Row>
            <div style={{ marginTop: 12, textAlign: 'center', color: '#666' }}>
              Viewing: {startDate.format('MMM D, YYYY')} - {startDate.add(numWeeks - 1, 'week').add(6, 'days').format('MMM D, YYYY')}
            </div>
          </Card>

          {shipmentData.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title={`Total Goal (${numWeeks} weeks)`}
                value={totalGoal}
                prefix={<RocketOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Shipped"
                value={totalShipped}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: totalShipped >= totalGoal ? '#3f8600' : undefined }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Overall Progress"
                value={overallProgress.toFixed(1)}
                suffix="%"
                valueStyle={{ color: overallProgress >= 100 ? '#3f8600' : overallProgress >= 80 ? '#cf8600' : '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Weeks On Track"
                value={`${weeksOnTrack} / ${weeksOnTrack + weeksBehind}`}
                prefix={<WarningOutlined />}
                valueStyle={{ color: weeksOnTrack >= weeksBehind ? '#3f8600' : '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        <Table
          dataSource={shipmentData}
          columns={columns}
          rowKey="week_start_date"
          loading={loading}
          pagination={false}
          scroll={{ x: 900 }}
          rowClassName={(record) => {
            const weekStart = dayjs(record.week_start_date);
            if (weekStart.isSame(dayjs().startOf('isoWeek'), 'day')) {
              return 'current-week-row';
            }
            return '';
          }}
        />
      </Card>
        </>
      )}

      {viewMode === 'analytics' && (
        <>
          {/* Analytics Dashboard */}
          {loading ? (
            <Card>Loading analytics...</Card>
          ) : shipmentData.length === 0 ? (
            <Card>No data available for analytics. Please select a product and date range.</Card>
          ) : (() => {
            // Prepare chart data
            const chartData = shipmentData
              .filter(row => row.goal > 0 || row.shipped > 0)
              .map(row => ({
                week: dayjs(row.week_start_date).format('MMM D'),
                fullDate: row.week_start_date,
                goal: Number(row.goal),
                shipped: Number(row.shipped),
                variance: Number(row.shipped) - Number(row.goal),
                achievement: row.goal > 0 ? ((row.shipped / row.goal) * 100) : 0
              }));

            // Calculate analytics metrics
            const weeksWithGoals = shipmentData.filter(row => row.goal > 0);
            const totalGoalAnalytics = weeksWithGoals.reduce((sum, row) => sum + Number(row.goal), 0);
            const totalShippedAnalytics = weeksWithGoals.reduce((sum, row) => sum + Number(row.shipped), 0);
            const achievementRate = totalGoalAnalytics > 0 ? ((totalShippedAnalytics / totalGoalAnalytics) * 100) : 0;

            // Calculate streak
            let currentStreak = 0;
            let bestStreak = 0;
            let tempStreak = 0;

            for (const row of weeksWithGoals) {
              if (row.shipped >= row.goal) {
                tempStreak++;
                bestStreak = Math.max(bestStreak, tempStreak);
              } else {
                tempStreak = 0;
              }
            }

            // Current streak (from most recent weeks)
            for (let i = weeksWithGoals.length - 1; i >= 0; i--) {
              if (weeksWithGoals[i].shipped >= weeksWithGoals[i].goal) {
                currentStreak++;
              } else {
                break;
              }
            }

            // Best and worst weeks
            const rankedWeeks = [...weeksWithGoals]
              .filter(row => row.goal > 0)
              .map(row => ({
                week: dayjs(row.week_start_date).format('MMM D, YYYY'),
                goal: row.goal,
                shipped: row.shipped,
                achievement: ((row.shipped / row.goal) * 100),
                variance: row.shipped - row.goal
              }))
              .sort((a, b) => b.achievement - a.achievement);

            const bestWeeks = rankedWeeks.slice(0, 5);
            const worstWeeks = [...rankedWeeks].reverse().slice(0, 5);

            // Monthly summary
            const monthlyData = new Map<string, { goal: number; shipped: number; weeks: number }>();

            weeksWithGoals.forEach(row => {
              const month = dayjs(row.week_start_date).format('YYYY-MM');
              const existing = monthlyData.get(month) || { goal: 0, shipped: 0, weeks: 0 };
              monthlyData.set(month, {
                goal: existing.goal + Number(row.goal),
                shipped: existing.shipped + Number(row.shipped),
                weeks: existing.weeks + 1
              });
            });

            const monthlySummary = Array.from(monthlyData.entries())
              .map(([month, data]) => ({
                month: dayjs(month + '-01').format('MMMM YYYY'),
                monthSort: month, // Keep the YYYY-MM format for sorting
                goal: data.goal,
                shipped: data.shipped,
                achievement: parseFloat(((data.shipped / data.goal) * 100).toFixed(1)),
                weeks: data.weeks
              }))
              .sort((a, b) => b.monthSort.localeCompare(a.monthSort)); // Most recent first

            return (
              <>
                {/* Key Metrics Cards */}
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="Achievement Rate"
                        value={achievementRate.toFixed(1)}
                        suffix="%"
                        prefix={<TrophyOutlined />}
                        valueStyle={{
                          color: achievementRate >= 100 ? '#3f8600' : achievementRate >= 90 ? '#cf8600' : '#cf1322'
                        }}
                      />
                      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                        {totalShippedAnalytics.toLocaleString()} / {totalGoalAnalytics.toLocaleString()} units
                      </div>
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="Current Streak"
                        value={currentStreak}
                        suffix={currentStreak === 1 ? 'week' : 'weeks'}
                        prefix={<FireOutlined />}
                        valueStyle={{ color: currentStreak > 0 ? '#3f8600' : '#999' }}
                      />
                      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                        Best: {bestStreak} {bestStreak === 1 ? 'week' : 'weeks'}
                      </div>
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="Weeks On Target"
                        value={weeksWithGoals.filter(r => r.shipped >= r.goal).length}
                        suffix={`/ ${weeksWithGoals.length}`}
                        prefix={<CheckCircleOutlined />}
                        valueStyle={{
                          color: weeksWithGoals.filter(r => r.shipped >= r.goal).length >= weeksWithGoals.length / 2
                            ? '#3f8600'
                            : '#cf1322'
                        }}
                      />
                      <div style={{ marginTop: 8, fontSize: 12, color: '#cf8600' }}>
                        Close (90%+): {weeksWithGoals.filter(r => {
                          const achievement = r.goal > 0 ? (r.shipped / r.goal) * 100 : 0;
                          return achievement >= 90 && achievement < 100;
                        }).length}
                      </div>
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card>
                      <Statistic
                        title="Average Weekly Goal"
                        value={weeksWithGoals.length > 0 ? Math.round(totalGoalAnalytics / weeksWithGoals.length) : 0}
                        prefix={<RocketOutlined />}
                      />
                      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                        Across {weeksWithGoals.length} weeks
                      </div>
                    </Card>
                  </Col>
                </Row>

                {/* Performance Trends Chart */}
                <Card title="Performance Trends" style={{ marginBottom: 24 }}>
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="week"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval={0}
                      />
                      <YAxis yAxisId="left" label={{ value: 'Units', angle: -90, position: 'insideLeft' }} />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        label={{ value: 'Variance', angle: 90, position: 'insideRight' }}
                      />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div style={{
                                backgroundColor: 'white',
                                padding: 12,
                                border: '1px solid #ccc',
                                borderRadius: 4
                              }}>
                                <p style={{ margin: 0, fontWeight: 'bold' }}>{payload[0].payload.fullDate}</p>
                                <p style={{ margin: '4px 0', color: '#1890ff' }}>
                                  Goal: {payload[0].payload.goal.toLocaleString()}
                                </p>
                                <p style={{ margin: '4px 0', color: '#52c41a' }}>
                                  Shipped: {payload[0].payload.shipped.toLocaleString()}
                                </p>
                                <p style={{ margin: '4px 0', color: payload[0].payload.variance >= 0 ? '#52c41a' : '#ff4d4f' }}>
                                  Variance: {payload[0].payload.variance >= 0 ? '+' : ''}{payload[0].payload.variance}
                                </p>
                                <p style={{ margin: '4px 0' }}>
                                  Achievement: {payload[0].payload.achievement.toFixed(1)}%
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <ReferenceLine yAxisId="right" y={0} stroke="#666" strokeDasharray="3 3" />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="goal"
                        stroke="#1890ff"
                        strokeWidth={2}
                        name="Goal"
                        dot={{ r: 4 }}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="shipped"
                        stroke="#52c41a"
                        strokeWidth={2}
                        name="Shipped"
                        dot={{ r: 4 }}
                      />
                      <Bar
                        yAxisId="right"
                        dataKey="variance"
                        name="Variance"
                        fill="#8884d8"
                        opacity={0.6}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>

                {/* Monthly Summary */}
                {monthlySummary.length > 0 && (
                  <Card title="Monthly Summary" style={{ marginBottom: 24 }}>
                    <Table
                      dataSource={monthlySummary}
                      pagination={false}
                      size="small"
                      columns={[
                        {
                          title: 'Month',
                          dataIndex: 'month',
                          key: 'month',
                          sorter: (a, b) => a.monthSort.localeCompare(b.monthSort),
                          defaultSortOrder: 'descend' as const,
                        },
                        {
                          title: 'Weeks',
                          dataIndex: 'weeks',
                          key: 'weeks',
                          align: 'center' as const,
                          sorter: (a, b) => a.weeks - b.weeks,
                        },
                        {
                          title: 'Total Goal',
                          dataIndex: 'goal',
                          key: 'goal',
                          align: 'right' as const,
                          render: (val: number) => val.toLocaleString(),
                          sorter: (a, b) => a.goal - b.goal,
                        },
                        {
                          title: 'Total Shipped',
                          dataIndex: 'shipped',
                          key: 'shipped',
                          align: 'right' as const,
                          render: (val: number) => val.toLocaleString(),
                          sorter: (a, b) => a.shipped - b.shipped,
                        },
                        {
                          title: 'Achievement',
                          dataIndex: 'achievement',
                          key: 'achievement',
                          align: 'center' as const,
                          render: (val: number) => {
                            return (
                              <span style={{
                                color: val >= 100 ? '#3f8600' : val >= 90 ? '#cf8600' : '#cf1322',
                                fontWeight: 'bold'
                              }}>
                                {val.toFixed(1)}%
                              </span>
                            );
                          },
                          sorter: (a, b) => a.achievement - b.achievement,
                        },
                      ]}
                    />
                  </Card>
                )}

                {/* Best and Worst Weeks */}
                <Row gutter={16}>
                  <Col xs={24} lg={12}>
                    <Card title={<span><TrophyOutlined style={{ color: '#52c41a', marginRight: 8 }} />Top 5 Best Weeks</span>} style={{ marginBottom: 24 }}>
                      <Table
                        dataSource={bestWeeks}
                        pagination={false}
                        size="small"
                        columns={[
                          {
                            title: 'Week',
                            dataIndex: 'week',
                            key: 'week',
                          },
                          {
                            title: 'Shipped',
                            dataIndex: 'shipped',
                            key: 'shipped',
                            align: 'right' as const,
                            render: (val: number) => val.toLocaleString(),
                          },
                          {
                            title: 'Goal',
                            dataIndex: 'goal',
                            key: 'goal',
                            align: 'right' as const,
                            render: (val: number) => val.toLocaleString(),
                          },
                          {
                            title: 'Rate',
                            dataIndex: 'achievement',
                            key: 'achievement',
                            align: 'center' as const,
                            render: (val: number) => (
                              <span style={{ color: '#3f8600', fontWeight: 'bold' }}>
                                {val.toFixed(0)}%
                              </span>
                            ),
                          },
                        ]}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card title={<span><WarningOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />Bottom 5 Weeks</span>} style={{ marginBottom: 24 }}>
                      <Table
                        dataSource={worstWeeks}
                        pagination={false}
                        size="small"
                        columns={[
                          {
                            title: 'Week',
                            dataIndex: 'week',
                            key: 'week',
                          },
                          {
                            title: 'Shipped',
                            dataIndex: 'shipped',
                            key: 'shipped',
                            align: 'right' as const,
                            render: (val: number) => val.toLocaleString(),
                          },
                          {
                            title: 'Goal',
                            dataIndex: 'goal',
                            key: 'goal',
                            align: 'right' as const,
                            render: (val: number) => val.toLocaleString(),
                          },
                          {
                            title: 'Rate',
                            dataIndex: 'achievement',
                            key: 'achievement',
                            align: 'center' as const,
                            render: (val: number) => (
                              <span style={{ color: '#cf1322', fontWeight: 'bold' }}>
                                {val.toFixed(0)}%
                              </span>
                            ),
                          },
                        ]}
                      />
                    </Card>
                  </Col>
                </Row>
              </>
            );
          })()}
        </>
      )}

      <style>{`
        .current-week-row {
          background-color: #e6f7ff !important;
        }
        .current-week-row:hover {
          background-color: #bae7ff !important;
        }
      `}</style>
    </div>
  );
}

export default WeeklyShipments;
