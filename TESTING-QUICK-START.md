# 🚀 Quick Start Testing Guide

## 🎯 For Beginners - Start Here!

### **Step 1: Start Your System**
```bash
# Start the backend server
npm run dev

# In another terminal, start the frontend (if needed)
npm run dev
```

### **Step 2: Run the Interactive Test Runner**
```bash
# This is the easiest way to test!
node test-runner.cjs
```

The test runner will show you a menu with different testing options. Just pick a number!

### **Step 3: Quick Manual Test**
1. **Open your browser** to `http://localhost:5173` (or your frontend URL)
2. **Register a new user** with any email
3. **Complete the setup process**
4. **Verify everything works**

## 🧪 Different Ways to Test

### **1. Automated Testing (Recommended)**
```bash
# Quick system test
node test-simple-user-scenarios.cjs

# Test different user types
node test-different-user-types.cjs

# Full system test
node test-complete-multi-tenant-system.cjs
```

### **2. Manual Testing**
- Open `MANUAL-TESTING-GUIDE.md` for detailed manual testing steps
- Test in different browsers/incognito windows
- Try different user scenarios

### **3. API Testing**
```bash
# Test registration
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"test","password":"Password123!","first_name":"Test","last_name":"User"}'
```

## 👥 Testing Different User Types

### **Company Owner** 👑
- Full system access
- Can create and manage everything
- Test: Create company, setup divisions/clusters

### **Admin User** ⚙️
- User management
- Company settings
- Test: Manage users, change company settings

### **Manager User** 🏭
- Division/Cluster management
- S&OP cycles
- Test: Create divisions, manage clusters

### **Analyst User** 📊
- Data access
- Forecasting
- Test: Access data, run forecasts

### **Viewer User** 👁️
- Read-only access
- Reports only
- Test: View data without editing

## 🔍 What to Look For

### **✅ Success Indicators**
- Users can register and login
- Companies are created successfully
- Data is isolated between companies
- Setup wizard works properly
- No error messages in console

### **❌ Common Issues**
- "User already exists" → Use unique emails
- "Setup already complete" → Create new user
- "Cannot access data" → Check authentication
- Database errors → Check PostgreSQL connection

## 🛠️ Testing Tools

### **Browser Developer Tools**
- **F12** to open DevTools
- **Network tab** to see API calls
- **Console tab** to see errors
- **Application tab** to see stored data

### **Database Inspection**
```sql
-- Check users
SELECT * FROM users ORDER BY created_at DESC LIMIT 5;

-- Check companies
SELECT * FROM companies ORDER BY created_at DESC LIMIT 5;
```

## 📊 Test Scenarios

### **Scenario 1: Single User**
1. Register → Verify → Login → Create Company → Setup
2. **Expected**: Everything works smoothly

### **Scenario 2: Multiple Companies**
1. Create User A → Company A
2. Create User B → Company B (different browser)
3. **Expected**: Data is isolated between companies

### **Scenario 3: Different Company Sizes**
- **Startup**: 1 division, 1 cluster
- **Medium**: 3-4 divisions, 6-8 clusters
- **Large**: 5-6 divisions, 10-12 clusters

## 🎉 Success Checklist

- [ ] User registration works
- [ ] Email verification works
- [ ] Login works
- [ ] Company creation works
- [ ] Setup wizard works
- [ ] Data isolation works
- [ ] No security issues
- [ ] Performance is good

## 🆘 Need Help?

1. **Check the console** for error messages
2. **Look at the network tab** for failed API calls
3. **Check the database** for data issues
4. **Read the manual testing guide** for detailed steps
5. **Ask for help** if you're stuck!

---

**Happy Testing! 🚀**

Remember: Start simple, test incrementally, and don't worry if something doesn't work perfectly the first time! 