import { useState } from 'react';
import { Layout, Menu } from 'antd';
import { DashboardOutlined, AppstoreOutlined, InboxOutlined, ShoppingOutlined, RocketOutlined, BarChartOutlined, ShoppingCartOutlined, HistoryOutlined } from '@ant-design/icons';
import Dashboard from './components/Dashboard';
import Products from './components/Products';
import Inventory from './components/Inventory';
import Sales from './components/Sales';
import WeeklyShipments from './components/WeeklyShipments';
import MaterialAnalysis from './components/MaterialAnalysis';
import PurchaseOrders from './components/PurchaseOrders';
import InventoryAdjustmentHistory from './components/InventoryAdjustmentHistory';

const { Header, Content, Sider } = Layout;

type MenuItem = {
  key: string;
  icon: React.ReactNode;
  label: string;
};

const items: MenuItem[] = [
  { key: 'dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: 'sales', icon: <ShoppingOutlined />, label: 'Sales/Shipping' },
  { key: 'weekly-shipments', icon: <RocketOutlined />, label: 'Weekly Goals' },
  { key: 'purchase-orders', icon: <ShoppingCartOutlined />, label: 'Purchase Orders' },
  { key: 'material-analysis', icon: <BarChartOutlined />, label: 'Daily Build Analysis' },
  { key: 'products', icon: <AppstoreOutlined />, label: 'Products' },
  { key: 'inventory', icon: <InboxOutlined />, label: 'Inventory' },
  { key: 'adjustment-history', icon: <HistoryOutlined />, label: 'Inventory Adjustments' },
];

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'products':
        return <Products />;
      case 'inventory':
        return <Inventory />;
      case 'adjustment-history':
        return <InventoryAdjustmentHistory />;
      case 'purchase-orders':
        return <PurchaseOrders />;
      case 'material-analysis':
        return <MaterialAnalysis />;
      case 'sales':
        return <Sales />;
      case 'weekly-shipments':
        return <WeeklyShipments />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: '#001529',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '200px',
        height: '64px',
        zIndex: 101,
        paddingLeft: '24px'
      }}>
        <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
          MRP System
        </div>
      </div>
      <Header style={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: '#001529',
        paddingLeft: '224px'
      }}>
        <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', marginRight: '40px', visibility: 'hidden' }}>
          MRP System
        </div>
      </Header>
      <Layout>
        <Sider
          width={200}
          style={{
            background: '#fff',
            position: 'fixed',
            left: 0,
            top: 64,
            bottom: 0,
            overflow: 'auto',
            zIndex: 100
          }}
        >
          <Menu
            mode="inline"
            selectedKeys={[currentPage]}
            style={{ height: '100%', borderRight: 0 }}
            items={items}
            onClick={({ key }) => setCurrentPage(key)}
          />
        </Sider>
        <Layout style={{ padding: '24px', marginLeft: '200px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: '#fff',
            }}
          >
            {renderContent()}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;
