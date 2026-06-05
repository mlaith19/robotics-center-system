-- Create center_settings table
CREATE TABLE IF NOT EXISTS center_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  center_name VARCHAR(255),
  logo TEXT,
  phone VARCHAR(50),
  whatsapp VARCHAR(50),
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings row
INSERT INTO center_settings (id, center_name, logo, phone, whatsapp, address)
VALUES (1, '', '', '', '', '')
ON CONFLICT (id) DO NOTHING;
