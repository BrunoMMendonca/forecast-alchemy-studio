-- =====================================================
-- Create sop_cycle_configs Table Only
-- DBeaver Compatible - Simple and Safe
-- =====================================================

-- Drop the existing empty table first
DROP TABLE IF EXISTS sop_cycle_configs;

-- Create the complete sop_cycle_configs table
CREATE TABLE sop_cycle_configs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    division_id INTEGER,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    day_type TEXT NOT NULL DEFAULT 'regular' CHECK (day_type IN ('regular', 'working')),
    start_day INTEGER NOT NULL CHECK (start_day >= 1 AND start_day <= 31),
    start_month INTEGER CHECK (start_month >= 1 AND start_month <= 12),
    cut_off_days INTEGER NOT NULL DEFAULT 3 CHECK (cut_off_days >= 0 AND cut_off_days <= 30),
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    auto_generate BOOLEAN DEFAULT TRUE,
    generate_from_date DATE NOT NULL,
    generate_count INTEGER NOT NULL DEFAULT 12 CHECK (generate_count >= 1 AND generate_count <= 60),
    working_days_config JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by INTEGER,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by INTEGER
);

-- Add foreign key constraints
ALTER TABLE sop_cycle_configs 
ADD CONSTRAINT fk_sop_cycle_configs_company_id 
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE sop_cycle_configs 
ADD CONSTRAINT fk_sop_cycle_configs_division_id 
    FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE CASCADE;

ALTER TABLE sop_cycle_configs 
ADD CONSTRAINT fk_sop_cycle_configs_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id);

ALTER TABLE sop_cycle_configs 
ADD CONSTRAINT fk_sop_cycle_configs_updated_by 
    FOREIGN KEY (updated_by) REFERENCES users(id);

-- Add unique constraint
ALTER TABLE sop_cycle_configs 
ADD CONSTRAINT uk_sop_cycle_configs_company_division_freq 
    UNIQUE(company_id, division_id, frequency);

-- Create indexes
CREATE INDEX idx_sop_cycle_configs_company_id ON sop_cycle_configs(company_id);
CREATE INDEX idx_sop_cycle_configs_division_id ON sop_cycle_configs(division_id);
CREATE INDEX idx_sop_cycle_configs_frequency ON sop_cycle_configs(frequency);
CREATE INDEX idx_sop_cycle_configs_day_type ON sop_cycle_configs(day_type);
CREATE INDEX idx_sop_cycle_configs_working_days ON sop_cycle_configs USING GIN(working_days_config);
CREATE INDEX idx_sop_cycle_configs_active ON sop_cycle_configs(is_active);
CREATE INDEX idx_sop_cycle_configs_created_at ON sop_cycle_configs(created_at);

-- Verification query
SELECT 
    table_name,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND table_name = 'sop_cycle_configs'
ORDER BY ordinal_position;

-- Show completion message
DO $$
BEGIN
    RAISE NOTICE 'sop_cycle_configs table created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Table includes:';
    RAISE NOTICE '- All configuration fields (frequency, day_type, start_day, etc.)';
    RAISE NOTICE '- Working days support (working_days_config JSONB)';
    RAISE NOTICE '- Foreign key relationships to companies, divisions, users';
    RAISE NOTICE '- Proper constraints and indexes';
    RAISE NOTICE '';
    RAISE NOTICE 'You can now create S&OP cycle configurations!';
END $$; 
 
 
 
 
 
 
 
 
 