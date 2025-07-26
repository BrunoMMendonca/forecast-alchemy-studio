-- =====================================================
-- DROP AND RECREATE DATABASE SCRIPT
-- =====================================================
-- Run this script in DBeaver to drop the old database
-- and create a fresh one with the new schema
-- =====================================================

-- =====================================================
-- STEP 1: DROP EXISTING DATABASE
-- =====================================================
-- Note: You need to run this from a different database (like 'postgres')
-- since you can't drop a database while connected to it

-- First, disconnect from the forecast_alchemy_studio database
-- Then run this command:

DROP DATABASE IF EXISTS forecast_alchemy_studio;

-- =====================================================
-- STEP 2: CREATE NEW DATABASE
-- =====================================================

CREATE DATABASE forecast_alchemy_studio;

-- =====================================================
-- STEP 3: CONNECT TO NEW DATABASE
-- =====================================================
-- In DBeaver, connect to the new forecast_alchemy_studio database
-- Then run the create-fresh-database.sql script

-- =====================================================
-- ALTERNATIVE: ONE-LINE COMMAND
-- =====================================================
-- If you have psql command line access, you can run:
-- 
-- psql -U postgres -c "DROP DATABASE IF EXISTS forecast_alchemy_studio; CREATE DATABASE forecast_alchemy_studio;"
-- 
-- Then connect to the new database and run the schema creation script.
-- ===================================================== 