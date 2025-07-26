# Export Database Schema from DBeaver

## Method 1: Export Database Structure (Recommended)

### Step 1: Right-click on your database
1. In DBeaver, find your database in the Database Navigator
2. Right-click on the database name (not a specific table)
3. Select **"Tools"** → **"Generate DDL"**

### Step 2: Configure Export Settings
1. In the "Generate DDL" dialog:
   - **Objects**: Select "Tables" (and optionally "Functions", "Triggers", "Indexes")
   - **Format**: Choose "SQL Script"
   - **Include**: Check "Create statements", "Drop statements" (optional)
   - **File**: Choose where to save the file

### Step 3: Execute Export
1. Click **"Start"** to generate the DDL
2. Save the file as `current-schema.sql`

## Method 2: Quick Schema Check

### Run this query in DBeaver to see your current tables:

```sql
-- Check existing tables
SELECT 
    table_name, 
    table_type,
    table_schema
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check table structures
SELECT 
    table_name,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND table_name NOT LIKE 'pg_%'
ORDER BY table_name, ordinal_position;

-- Check foreign key relationships
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
```

## Method 3: Export Specific Tables

### If you want to export just specific tables:
1. Right-click on a table
2. Select **"Tools"** → **"Generate DDL"**
3. Choose the same settings as above

## What to Share

Once you have the schema exported, please share:
1. The `current-schema.sql` file content
2. Or the results of the "Quick Schema Check" queries above

This will help me create a script that works perfectly with your existing database structure! 
 
 
 
 
 
 
 
 
 