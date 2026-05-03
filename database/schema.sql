-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUMs
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('customer', 'ops', 'admin', 'rider');
    CREATE TYPE shipment_status AS ENUM (
        'BOOKED', 
        'PICKED', 
        'IN_WAREHOUSE', 
        'IN_TRANSIT', 
        'OUT_FOR_DELIVERY', 
        'DELIVERED', 
        'FAILED', 
        'RETURNED'
    );
    CREATE TYPE payment_type AS ENUM ('COD', 'PREPAID');
    CREATE TYPE sheet_status AS ENUM ('CREATED', 'DISPATCHED', 'RECEIVED');
    CREATE TYPE run_sheet_status AS ENUM ('CREATED', 'IN_PROGRESS', 'COMPLETED');
    CREATE TYPE item_delivery_status AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'RETURNED');
    CREATE TYPE financial_status AS ENUM ('PENDING', 'SUBMITTED', 'VERIFIED');
    CREATE TYPE invoice_status AS ENUM ('PAID', 'UNPAID', 'PARTIAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Branches
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT,
    status BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    id_card_number TEXT,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL,
    status BOOLEAN DEFAULT true,
    company_name TEXT,
    pickup_address TEXT,
    cnic TEXT,
    bank_account_no TEXT,
    account_title TEXT,
    bank_branch_name TEXT,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User-Branch Mapping (For Ops and Riders)
CREATE TABLE IF NOT EXISTS user_branch_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    UNIQUE(user_id, branch_id)
);

-- Shipments
CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_id TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES users(id),
    
    sender_name TEXT NOT NULL,
    sender_phone TEXT NOT NULL,
    sender_address TEXT NOT NULL,
    
    receiver_name TEXT NOT NULL,
    receiver_phone TEXT NOT NULL,
    receiver_address TEXT NOT NULL,
    
    weight FLOAT DEFAULT 0,
    parcel_type TEXT,
    
    payment_type payment_type NOT NULL DEFAULT 'COD',
    cod_amount FLOAT DEFAULT 0,
    service_charges FLOAT DEFAULT 0,
    
    origin_branch_id UUID REFERENCES branches(id),
    destination_branch_id UUID REFERENCES branches(id),
    current_branch_id UUID REFERENCES branches(id),
    
    status shipment_status DEFAULT 'BOOKED',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Consolidated Shipment Updates (History & Tracking)
CREATE TABLE IF NOT EXISTS shipment_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    status shipment_status NOT NULL,
    location TEXT,
    updated_by UUID REFERENCES users(id),
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bulk Shipments
CREATE TABLE IF NOT EXISTS bulk_shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES users(id),
    file_name TEXT,
    total_rows INT DEFAULT 0,
    processed_rows INT DEFAULT 0,
    failed_rows INT DEFAULT 0,
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bulk Shipment Errors
CREATE TABLE IF NOT EXISTS bulk_shipment_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bulk_id UUID REFERENCES bulk_shipments(id) ON DELETE CASCADE,
    row_number INT,
    error_message TEXT,
    row_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Labels
CREATE TABLE IF NOT EXISTS shipment_labels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID UNIQUE REFERENCES shipments(id) ON DELETE CASCADE,
    label_url TEXT,
    printed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Warehouse Entry
CREATE TABLE IF NOT EXISTS warehouse_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    received_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Loading Sheets (Transit)
CREATE TABLE IF NOT EXISTS loading_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_branch_id UUID REFERENCES branches(id),
    to_branch_id UUID REFERENCES branches(id),
    vehicle_no TEXT,
    status sheet_status DEFAULT 'CREATED',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loading_sheet_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loading_sheet_id UUID REFERENCES loading_sheets(id) ON DELETE CASCADE,
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    UNIQUE(loading_sheet_id, shipment_id)
);

-- Run Sheets (Local Delivery)
CREATE TABLE IF NOT EXISTS run_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id),
    rider_id UUID REFERENCES users(id),
    date DATE DEFAULT CURRENT_DATE,
    status run_sheet_status DEFAULT 'CREATED',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS run_sheet_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_sheet_id UUID REFERENCES run_sheets(id) ON DELETE CASCADE,
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    delivery_status item_delivery_status DEFAULT 'PENDING',
    remarks TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(run_sheet_id, shipment_id)
);

-- Financials: COD Collections (Rider to Ops)
CREATE TABLE IF NOT EXISTS cod_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rider_id UUID REFERENCES users(id),
    branch_id UUID REFERENCES branches(id),
    run_sheet_id UUID REFERENCES run_sheets(id),
    expected_amount FLOAT DEFAULT 0,
    collected_amount FLOAT DEFAULT 0,
    status financial_status DEFAULT 'PENDING',
    verified_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Financials: HO Payments (Ops to Admin/HO)
CREATE TABLE IF NOT EXISTS ho_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id),
    amount FLOAT NOT NULL,
    reference_no TEXT,
    verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Invoices (For Customer Charges)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES users(id),
    total_service_charges FLOAT DEFAULT 0,
    total_cod_collected FLOAT DEFAULT 0,
    net_payable FLOAT DEFAULT 0, -- (COD - Charges)
    status invoice_status DEFAULT 'UNPAID',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Customer Payouts (Admin to Customer)
CREATE TABLE IF NOT EXISTS customer_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES users(id),
    invoice_id UUID REFERENCES invoices(id),
    amount FLOAT NOT NULL,
    payment_method TEXT,
    reference_no TEXT,
    payout_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Refresh Tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    entity_name TEXT,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_shipments_updated_at ON shipments;
CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_id ON shipments(tracking_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_customer_id ON shipments(customer_id);
CREATE INDEX IF NOT EXISTS idx_shipments_dest_branch ON shipments(destination_branch_id);
CREATE INDEX IF NOT EXISTS idx_run_sheets_rider ON run_sheets(rider_id);
CREATE INDEX IF NOT EXISTS idx_run_sheets_date ON run_sheets(date);
CREATE INDEX IF NOT EXISTS idx_shipment_updates_shipment_id ON shipment_updates(shipment_id);

-- Tariffs
CREATE TABLE IF NOT EXISTS tariffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tariff_type VARCHAR(50) DEFAULT 'STANDARD',
    start_weight DECIMAL(10,2) NOT NULL,
    end_weight DECIMAL(10,2) NOT NULL,
    additional_factor DECIMAL(10,2) DEFAULT 0,
    rate DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
