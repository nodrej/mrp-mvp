import { useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, DatePicker, Select, message, Space, Tag, Popconfirm, Radio } from 'antd';
import { PlusOutlined, CheckOutlined, DeleteOutlined, DownloadOutlined, InboxOutlined, EditOutlined, UndoOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { exportTableToCSV, getExportFilename } from '../utils/exportUtils';

interface Product {
  id: number;
  code: string;
  name: string;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  product_id: number;
  product_code?: string;
  product_name?: string;
  order_date: string;
  expected_date: string;
  quantity: number;
  status: string;
  received_date?: string;
  received_quantity?: number;
  supplier?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

function PurchaseOrders() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [counts, setCounts] = useState({ pending: 0, received: 0, all: 0 });
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [receiveForm] = Form.useForm();

  const loadPurchaseOrders = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await axios.get('/api/purchase-orders', { params });
      setPurchaseOrders(response.data.purchase_orders);
      setCounts(response.data.counts);
    } catch (error) {
      console.error('Error loading purchase orders:', error);
      message.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await axios.get('/api/products');
      setProducts(response.data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  useEffect(() => {
    loadProducts();
    loadPurchaseOrders();
  }, [statusFilter]);

  const handleCreate = async (values: any) => {
    try {
      await axios.post('/api/purchase-orders', {
        po_number: values.po_number,
        product_id: values.product_id,
        order_date: values.order_date.format('YYYY-MM-DD'),
        expected_date: values.expected_date.format('YYYY-MM-DD'),
        quantity: parseFloat(values.quantity),
        supplier: values.supplier,
        notes: values.notes,
      });
      message.success('Purchase order created successfully');
      setIsModalOpen(false);
      form.resetFields();
      loadPurchaseOrders();
    } catch (error: any) {
      console.error('Error creating purchase order:', error);
      message.error(error.response?.data?.detail || 'Failed to create purchase order');
    }
  };

  const handleEdit = (po: PurchaseOrder) => {
    setSelectedPO(po);
    editForm.setFieldsValue({
      po_number: po.po_number,
      product_id: po.product_id,
      quantity: po.quantity,
      supplier: po.supplier,
      order_date: dayjs(po.order_date),
      expected_date: dayjs(po.expected_date),
      notes: po.notes,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (values: any) => {
    if (!selectedPO) return;

    try {
      await axios.put(`/api/purchase-orders/${selectedPO.id}`, {
        po_number: values.po_number,
        product_id: values.product_id,
        order_date: values.order_date.format('YYYY-MM-DD'),
        expected_date: values.expected_date.format('YYYY-MM-DD'),
        quantity: parseFloat(values.quantity),
        supplier: values.supplier,
        notes: values.notes,
      });
      message.success('Purchase order updated successfully');
      setIsEditModalOpen(false);
      setSelectedPO(null);
      editForm.resetFields();
      loadPurchaseOrders();
    } catch (error: any) {
      console.error('Error updating purchase order:', error);
      message.error(error.response?.data?.detail || 'Failed to update purchase order');
    }
  };

  const handleReceive = async (values: any) => {
    if (!selectedPO) return;

    try {
      await axios.post(`/api/purchase-orders/${selectedPO.id}/receive`, {
        received_date: values.received_date.format('YYYY-MM-DD'),
        received_quantity: parseFloat(values.received_quantity),
        notes: values.notes,
      });
      message.success('Purchase order received and inventory updated');
      setIsReceiveModalOpen(false);
      setSelectedPO(null);
      receiveForm.resetFields();
      loadPurchaseOrders();
    } catch (error: any) {
      console.error('Error receiving purchase order:', error);
      message.error(error.response?.data?.detail || 'Failed to receive purchase order');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/purchase-orders/${id}`);
      message.success('Purchase order deleted');
      loadPurchaseOrders();
    } catch (error: any) {
      console.error('Error deleting purchase order:', error);
      message.error(error.response?.data?.detail || 'Failed to delete purchase order');
    }
  };

  const handleUndoReceipt = async (id: number) => {
    try {
      const response = await axios.post(`/api/purchase-orders/${id}/undo-receipt`);
      message.success(`Receipt undone successfully. Inventory adjusted by ${response.data.reversed_quantity}`);
      loadPurchaseOrders();
    } catch (error: any) {
      console.error('Error undoing purchase order receipt:', error);
      message.error(error.response?.data?.detail || 'Failed to undo purchase order receipt');
    }
  };

  const openReceiveModal = (po: PurchaseOrder) => {
    setSelectedPO(po);
    receiveForm.setFieldsValue({
      received_date: dayjs(),
      received_quantity: po.quantity,
    });
    setIsReceiveModalOpen(true);
  };

  const handleExport = () => {
    if (purchaseOrders.length > 0) {
      exportTableToCSV(
        purchaseOrders,
        columns,
        getExportFilename('purchase_orders')
      );
    }
  };

  const getStatusTag = (status: string) => {
    const statusColors: { [key: string]: string } = {
      pending: 'blue',
      received: 'green',
      cancelled: 'red',
    };
    return <Tag color={statusColors[status] || 'default'}>{status.toUpperCase()}</Tag>;
  };

  const getDateColor = (dateStr: string, status: string) => {
    if (status !== 'pending') return undefined;

    const date = dayjs(dateStr);
    const today = dayjs();
    const daysUntil = date.diff(today, 'day');

    if (daysUntil < 0) return '#cf1322'; // Overdue - red
    if (daysUntil <= 7) return '#fa8c16'; // Due soon - orange
    return undefined; // Future - default
  };

  const columns = [
    {
      title: 'PO Number',
      dataIndex: 'po_number',
      key: 'po_number',
      width: 150,
      fixed: 'left' as const,
      sorter: (a: PurchaseOrder, b: PurchaseOrder) => a.po_number.localeCompare(b.po_number),
    },
    {
      title: 'Product',
      key: 'product',
      width: 250,
      render: (_: any, record: PurchaseOrder) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.product_code}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.product_name}</div>
        </div>
      ),
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
      align: 'right' as const,
      render: (value: number) => Math.round(value).toLocaleString(),
    },
    {
      title: 'Supplier',
      dataIndex: 'supplier',
      key: 'supplier',
      width: 180,
      render: (value: string) => value || <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: 'Order Date',
      dataIndex: 'order_date',
      key: 'order_date',
      width: 120,
      render: (date: string) => dayjs(date).format('MMM D, YYYY'),
      sorter: (a: PurchaseOrder, b: PurchaseOrder) => dayjs(a.order_date).unix() - dayjs(b.order_date).unix(),
    },
    {
      title: 'Expected Date',
      dataIndex: 'expected_date',
      key: 'expected_date',
      width: 150,
      render: (date: string, record: PurchaseOrder) => {
        const color = getDateColor(date, record.status);
        return (
          <span style={{ color, fontWeight: color ? 'bold' : 'normal' }}>
            {dayjs(date).format('MMM D, YYYY')}
          </span>
        );
      },
      sorter: (a: PurchaseOrder, b: PurchaseOrder) => dayjs(a.expected_date).unix() - dayjs(b.expected_date).unix(),
      defaultSortOrder: 'ascend' as const,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center' as const,
      render: (status: string) => getStatusTag(status),
      sorter: (a: PurchaseOrder, b: PurchaseOrder) => a.status.localeCompare(b.status),
    },
    {
      title: 'Received',
      key: 'received',
      width: 180,
      render: (_: any, record: PurchaseOrder) => {
        if (record.status !== 'received') return <span style={{ color: '#999' }}>-</span>;
        return (
          <div>
            <div>{dayjs(record.received_date).format('MMM D, YYYY')}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Qty: {record.received_quantity ? Math.round(record.received_quantity).toLocaleString() : 0}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: PurchaseOrder) => (
        <Space>
          {record.status === 'pending' && (
            <>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              >
                Edit
              </Button>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => openReceiveModal(record)}
              >
                Receive
              </Button>
              <Popconfirm
                title="Delete this purchase order?"
                description="This action cannot be undone."
                onConfirm={() => handleDelete(record.id)}
                okText="Yes"
                cancelText="No"
              >
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>
            </>
          )}
          {record.status === 'received' && (
            <Popconfirm
              title="Undo this purchase order receipt?"
              description={`This will reverse the inventory adjustment and set the PO back to pending status.`}
              onConfirm={() => handleUndoReceipt(record.id)}
              okText="Yes, Undo"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button
                size="small"
                icon={<UndoOutlined />}
                danger
              >
                Undo Receipt
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1>Purchase Orders</h1>
        <p style={{ color: '#666', fontSize: '14px' }}>
          Track incoming inventory orders and receive shipments when they arrive.
        </p>
      </div>

      <Card
        title="Purchase Orders"
        extra={
          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={purchaseOrders.length === 0}
            >
              Export CSV
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsModalOpen(true)}
            >
              Create Purchase Order
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <span style={{ marginRight: 12, fontWeight: 500 }}>Filter by Status:</span>
              <Radio.Group
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                buttonStyle="solid"
              >
                <Radio.Button value="pending">
                  Pending ({counts.pending})
                </Radio.Button>
                <Radio.Button value="received">
                  Received ({counts.received})
                </Radio.Button>
                <Radio.Button value="all">
                  All Orders ({counts.all})
                </Radio.Button>
              </Radio.Group>
            </div>
          </Space>
        </div>

        <Table
          dataSource={purchaseOrders}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1450 }}
          size="small"
        />
      </Card>

      {/* Create PO Modal */}
      <Modal
        title="Create Purchase Order"
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            label="PO Number"
            name="po_number"
            rules={[{ required: true, message: 'Please enter PO number' }]}
          >
            <Input placeholder="e.g., PO-2025-001" />
          </Form.Item>

          <Form.Item
            label="Product"
            name="product_id"
            rules={[{ required: true, message: 'Please select a product' }]}
          >
            <Select
              showSearch
              placeholder="Select product"
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={products.map(p => ({
                value: p.id,
                label: `${p.code} - ${p.name}`,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="Quantity"
            name="quantity"
            rules={[{ required: true, message: 'Please enter quantity' }]}
          >
            <Input type="number" min={0} step={0.01} />
          </Form.Item>

          <Form.Item
            label="Supplier"
            name="supplier"
          >
            <Input placeholder="Supplier name" />
          </Form.Item>

          <Form.Item
            label="Order Date"
            name="order_date"
            rules={[{ required: true, message: 'Please select order date' }]}
            initialValue={dayjs()}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="Expected Delivery Date"
            name="expected_date"
            rules={[{ required: true, message: 'Please select expected date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="Notes"
            name="notes"
          >
            <Input.TextArea rows={3} placeholder="Additional notes..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit PO Modal */}
      <Modal
        title={`Edit Purchase Order: ${selectedPO?.po_number}`}
        open={isEditModalOpen}
        onCancel={() => {
          setIsEditModalOpen(false);
          setSelectedPO(null);
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        width={600}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleUpdate}
        >
          <Form.Item
            label="PO Number"
            name="po_number"
            rules={[{ required: true, message: 'Please enter PO number' }]}
          >
            <Input placeholder="e.g., PO-2025-001" />
          </Form.Item>

          <Form.Item
            label="Product"
            name="product_id"
            rules={[{ required: true, message: 'Please select a product' }]}
          >
            <Select
              showSearch
              placeholder="Select product"
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={products.map(p => ({
                value: p.id,
                label: `${p.code} - ${p.name}`,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="Quantity"
            name="quantity"
            rules={[{ required: true, message: 'Please enter quantity' }]}
          >
            <Input type="number" min={0} step={1} />
          </Form.Item>

          <Form.Item
            label="Supplier"
            name="supplier"
          >
            <Input placeholder="Supplier name" />
          </Form.Item>

          <Form.Item
            label="Order Date"
            name="order_date"
            rules={[{ required: true, message: 'Please select order date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="Expected Delivery Date"
            name="expected_date"
            rules={[{ required: true, message: 'Please select expected date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="Notes"
            name="notes"
          >
            <Input.TextArea rows={3} placeholder="Additional notes..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Receive PO Modal */}
      <Modal
        title={`Receive Purchase Order: ${selectedPO?.po_number}`}
        open={isReceiveModalOpen}
        onCancel={() => {
          setIsReceiveModalOpen(false);
          setSelectedPO(null);
          receiveForm.resetFields();
        }}
        onOk={() => receiveForm.submit()}
        width={500}
      >
        {selectedPO && (
          <>
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <div><strong>Product:</strong> {selectedPO.product_code} - {selectedPO.product_name}</div>
              <div><strong>Ordered Quantity:</strong> {Math.round(selectedPO.quantity).toLocaleString()}</div>
              <div><strong>Expected Date:</strong> {dayjs(selectedPO.expected_date).format('MMM D, YYYY')}</div>
            </div>

            <Form
              form={receiveForm}
              layout="vertical"
              onFinish={handleReceive}
            >
              <Form.Item
                label="Received Date"
                name="received_date"
                rules={[{ required: true, message: 'Please select received date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                label="Received Quantity"
                name="received_quantity"
                rules={[{ required: true, message: 'Please enter received quantity' }]}
              >
                <Input type="number" min={0} step={0.01} />
              </Form.Item>

              <Form.Item
                label="Notes"
                name="notes"
              >
                <Input.TextArea rows={2} placeholder="Receipt notes..." />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
}

export default PurchaseOrders;
