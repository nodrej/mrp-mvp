import { Modal, Form, Input, DatePicker, InputNumber, message } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import { useEffect } from 'react';

interface CreatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  componentId?: number;
  componentCode?: string;
  componentName?: string;
  suggestedQuantity?: number;
  suggestedDate?: string;
  leadTimeDays?: number;
}

function CreatePOModal({
  isOpen,
  onClose,
  onSuccess,
  componentId,
  componentCode,
  componentName,
  suggestedQuantity,
  suggestedDate,
  leadTimeDays = 0
}: CreatePOModalProps) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (isOpen && componentId) {
      // Generate PO number
      const poNumber = `PO-${Date.now()}`;

      // Calculate suggested order date (today or run_out_date - lead_time)
      const today = dayjs();
      let orderDate = today;
      let expectedDate = today.add(leadTimeDays, 'day');

      if (suggestedDate) {
        const runOutDate = dayjs(suggestedDate);
        const suggestedOrderDate = runOutDate.subtract(leadTimeDays, 'day');

        // If suggested order date is in the past, use today
        if (suggestedOrderDate.isAfter(today)) {
          orderDate = suggestedOrderDate;
        }
        expectedDate = orderDate.add(leadTimeDays, 'day');
      }

      form.setFieldsValue({
        po_number: poNumber,
        product_id: componentId,
        order_date: orderDate,
        expected_date: expectedDate,
        quantity: suggestedQuantity || 0,
        supplier: '',
        notes: `Auto-generated PO for ${componentCode || 'component'}`
      });
    }
  }, [isOpen, componentId, componentCode, componentName, suggestedQuantity, suggestedDate, leadTimeDays, form]);

  const handleCreate = async (values: any) => {
    try {
      await axios.post('/api/purchase-orders', {
        po_number: values.po_number,
        product_id: values.product_id,
        order_date: values.order_date.format('YYYY-MM-DD'),
        expected_date: values.expected_date.format('YYYY-MM-DD'),
        quantity: parseFloat(values.quantity),
        supplier: values.supplier || '',
        notes: values.notes || '',
      });
      message.success(`Purchase order ${values.po_number} created successfully`);
      form.resetFields();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating purchase order:', error);
      message.error(error.response?.data?.detail || 'Failed to create purchase order');
    }
  };

  return (
    <Modal
      title={`Create Purchase Order${componentCode ? ` - ${componentCode}` : ''}`}
      open={isOpen}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      onOk={() => form.submit()}
      okText="Create PO"
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleCreate}
        style={{ marginTop: 16 }}
      >
        <Form.Item
          name="po_number"
          label="PO Number"
          rules={[{ required: true, message: 'Please enter PO number' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item name="product_id" hidden>
          <Input type="hidden" />
        </Form.Item>

        {componentName && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            <strong>Component:</strong> {componentCode} - {componentName}
          </div>
        )}

        <Form.Item
          name="quantity"
          label="Quantity"
          rules={[{ required: true, message: 'Please enter quantity' }]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            precision={0}
          />
        </Form.Item>

        <Form.Item
          name="order_date"
          label="Order Date"
          rules={[{ required: true, message: 'Please select order date' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="expected_date"
          label="Expected Delivery Date"
          rules={[{ required: true, message: 'Please select expected delivery date' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="supplier"
          label="Supplier"
        >
          <Input placeholder="Enter supplier name (optional)" />
        </Form.Item>

        <Form.Item
          name="notes"
          label="Notes"
        >
          <Input.TextArea
            rows={3}
            placeholder="Enter any additional notes (optional)"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default CreatePOModal;
