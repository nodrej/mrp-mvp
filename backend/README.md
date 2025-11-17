# MRP System Backend

FastAPI-based backend for the MRP System MVP.

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Import L3 Trigger Data

```bash
python import_l3_data.py
```

This will create the database and populate it with your L3 Trigger data.

### 3. Start the Server

```bash
python main.py
```

The API will be available at: `http://localhost:8000`

### 4. Test the API

Open your browser to: `http://localhost:8000/docs`

This will show the interactive API documentation (Swagger UI).

## API Endpoints

### Products
- `GET /api/products` - List all products
- `POST /api/products` - Create new product
- `GET /api/products/{id}` - Get product details
- `PUT /api/products/{id}` - Update product
- `DELETE /api/products/{id}` - Delete product

### BOM
- `GET /api/products/{id}/bom` - Get BOM for product
- `POST /api/products/{id}/bom` - Save BOM

### Inventory
- `GET /api/inventory` - List all inventory
- `GET /api/inventory/{product_id}` - Get product inventory
- `POST /api/inventory/adjust` - Adjust inventory quantity

### Demand
- `GET /api/demand/{product_id}` - Get demand forecast
- `POST /api/demand` - Save demand forecast

### MRP
- `POST /api/mrp/calculate` - Run MRP calculation
- `GET /api/mrp/shortages` - Get shortage alerts
- `GET /api/dashboard` - Get dashboard data

## Database

SQLite database file: `./data/mrp.db`

To reset the database, simply delete this file and run `import_l3_data.py` again.

## Development

The API automatically reloads when you change files during development.

To see SQL queries, check the console output (SQLAlchemy echo is enabled).
