-- =====================================================
-- CREATE TEST DATA FOR CLUSTERS AND FIELD MAPPINGS
-- Company: 49, Division: 52 ("Div 3")
-- =====================================================

-- First, let's check if the division exists
SELECT 
    d.id as division_id,
    d.name as division_name,
    d.company_id,
    c.name as company_name
FROM divisions d
JOIN companies c ON d.company_id = c.id
WHERE d.id = 52 AND d.company_id = 49;

-- Insert test clusters for "Div 3" (division 52) - only if they don't exist
INSERT INTO clusters (
    name,
    division_id,
    company_id,
    created_at,
    updated_at,
    is_active,
    created_by,
    updated_by
) 
SELECT * FROM (VALUES 
    ('Test Cluster Alpha', 52, 49, NOW(), NOW(), true, 36, 36),
    ('Test Cluster Beta', 52, 49, NOW(), NOW(), true, 36, 36),
    ('Test Cluster Gamma', 52, 49, NOW(), NOW(), true, 36, 36),
    ('Test Cluster Delta', 52, 49, NOW(), NOW(), true, 36, 36),
    ('Test Cluster Echo', 52, 49, NOW(), NOW(), true, 36, 36)
) AS v(name, division_id, company_id, created_at, updated_at, is_active, created_by, updated_by)
WHERE NOT EXISTS (
    SELECT 1 FROM clusters WHERE division_id = v.division_id AND name = v.name
);

-- Insert field definitions for company 49 - only if they don't exist
INSERT INTO aggregatable_field_defs (
    company_id,
    field_name,
    field_type,
    is_required,
    created_by
) 
SELECT * FROM (VALUES 
    (49, 'product_name', 'text', true, 36),
    (49, 'sales_volume', 'number', true, 36),
    (49, 'price', 'decimal', false, 36),
    (49, 'customer_id', 'text', true, 36),
    (49, 'order_date', 'date', true, 36),
    (49, 'quantity', 'number', true, 36),
    (49, 'region', 'text', true, 36),
    (49, 'revenue', 'decimal', true, 36),
    (49, 'growth_rate', 'decimal', false, 36),
    (49, 'category', 'text', true, 36),
    (49, 'inventory', 'number', true, 36),
    (49, 'supplier', 'text', false, 36),
    (49, 'market_segment', 'text', true, 36),
    (49, 'profit_margin', 'decimal', true, 36),
    (49, 'competition_level', 'text', false, 36)
) AS v(company_id, field_name, field_type, is_required, created_by)
WHERE NOT EXISTS (
    SELECT 1 FROM aggregatable_field_defs WHERE company_id = v.company_id AND field_name = v.field_name
);

-- Insert field mappings (CSV column to field definition mappings) - only if they don't exist
INSERT INTO dataset_aggregatable_field_map (
    company_id,
    field_def_id,
    dataset_column,
    created_by
) 
SELECT * FROM (VALUES 
    -- Map CSV columns to field definitions
    (49, (SELECT id FROM aggregatable_field_defs WHERE company_id = 49 AND field_name = 'product_name'), 'Product Name', 36),
    (49, (SELECT id FROM aggregatable_field_defs WHERE company_id = 49 AND field_name = 'sales_volume'), 'Sales Volume', 36),
    (49, (SELECT id FROM aggregatable_field_defs WHERE company_id = 49 AND field_name = 'price'), 'Price', 36),
    (49, (SELECT id FROM aggregatable_field_defs WHERE company_id = 49 AND field_name = 'customer_id'), 'Customer ID', 36),
    (49, (SELECT id FROM aggregatable_field_defs WHERE company_id = 49 AND field_name = 'order_date'), 'Order Date', 36),
    (49, (SELECT id FROM aggregatable_field_defs WHERE company_id = 49 AND field_name = 'quantity'), 'Quantity', 36),
    (49, (SELECT id FROM aggregatable_field_defs WHERE company_id = 49 AND field_name = 'region'), 'Region', 36),
    (49, (SELECT id FROM aggregatable_field_defs WHERE company_id = 49 AND field_name = 'revenue'), 'Revenue', 36),
    (49, (SELECT id FROM aggregatable_field_defs WHERE company_id = 49 AND field_name = 'growth_rate'), 'Growth Rate', 36),
    (49, (SELECT id FROM aggregatable_field_defs WHERE company_id = 49 AND field_name = 'category'), 'Category', 36),
    (49, (SELECT id FROM aggregatable_field_defs WHERE company_id = 49 AND field_name = 'inventory'), 'Inventory', 36),
    (49, (SELECT id FROM aggregatable_field_defs WHERE company_id = 49 AND field_name = 'supplier'), 'Supplier', 36),
    (49, (SELECT id FROM aggregatable_field_defs WHERE company_id = 49 AND field_name = 'market_segment'), 'Market Segment', 36),
    (49, (SELECT id FROM aggregatable_field_defs WHERE company_id = 49 AND field_name = 'profit_margin'), 'Profit Margin', 36),
    (49, (SELECT id FROM aggregatable_field_defs WHERE company_id = 49 AND field_name = 'competition_level'), 'Competition Level', 36)
) AS v(company_id, field_def_id, dataset_column, created_by)
WHERE NOT EXISTS (
    SELECT 1 FROM dataset_aggregatable_field_map WHERE company_id = v.company_id AND field_def_id = v.field_def_id
);

-- Verify the inserted data
SELECT 
    'CLUSTERS' as data_type,
    c.id as cluster_id,
    c.name as cluster_name,
    c.division_id,
    d.name as division_name,
    c.company_id,
    comp.name as company_name,
    c.created_at,
    c.is_active
FROM clusters c
JOIN divisions d ON c.division_id = d.id
JOIN companies comp ON c.company_id = comp.id
WHERE c.division_id = 52 AND c.company_id = 49
ORDER BY c.name;

SELECT 
    'FIELD DEFINITIONS' as data_type,
    afd.id as field_def_id,
    afd.field_name,
    afd.field_type,
    afd.is_required,
    comp.name as company_name
FROM aggregatable_field_defs afd
JOIN companies comp ON afd.company_id = comp.id
WHERE afd.company_id = 49
ORDER BY afd.field_name;

SELECT 
    'FIELD MAPPINGS' as data_type,
    fm.id as mapping_id,
    fm.dataset_column,
    afd.field_name,
    afd.field_type,
    afd.is_required,
    comp.name as company_name
FROM dataset_aggregatable_field_map fm
JOIN aggregatable_field_defs afd ON fm.field_def_id = afd.id
JOIN companies comp ON fm.company_id = comp.id
WHERE fm.company_id = 49
ORDER BY afd.field_name;

-- Summary count
SELECT 
    'SUMMARY' as info,
    COUNT(DISTINCT c.id) as total_clusters,
    COUNT(DISTINCT afd.id) as total_field_definitions,
    COUNT(DISTINCT fm.id) as total_field_mappings
FROM clusters c
CROSS JOIN aggregatable_field_defs afd
CROSS JOIN dataset_aggregatable_field_map fm
WHERE c.division_id = 52 AND c.company_id = 49 
  AND afd.company_id = 49 
  AND fm.company_id = 49; 