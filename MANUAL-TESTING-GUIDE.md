# 🧪 Manual Testing Guide for Multi-Tenant System

## 🚀 Quick Start Testing

### 1. **Basic System Test**
```bash
# Start your backend server
npm run dev

# Run the simple test script
node test-simple-user-scenarios.cjs
```

### 2. **User Type Testing**
```bash
# Test different user types and roles
node test-different-user-types.cjs
```

## 👥 Manual Testing Scenarios

### **Scenario 1: New User Journey**
1. **Open your app** in a browser
2. **Register a new user**:
   - Email: `testuser1@example.com`
   - Username: `testuser1`
   - Password: `Password123!`
   - Name: `John Doe`
3. **Check your email** for verification link (or use the token from console)
4. **Verify your email** using the token
5. **Login** with your credentials
6. **Create a company**:
   - Name: `Test Company 1`
   - Description: `My first test company`
   - Size: `Medium`
7. **Complete setup wizard**:
   - Create 1-2 divisions
   - Create 1-2 clusters per division
   - Create 1 S&OP cycle

### **Scenario 2: Multi-Company Testing**
1. **Open a new incognito/private window**
2. **Register a second user**:
   - Email: `testuser2@example.com`
   - Username: `testuser2`
   - Password: `Password123!`
   - Name: `Jane Smith`
3. **Complete the same process** but create a different company
4. **Verify data isolation** - each user should only see their own company data

### **Scenario 3: Different Company Sizes**
Test with different company sizes to see how the system adapts:

#### **Startup Company**
- Size: `Startup`
- Divisions: 1
- Clusters: 1
- Use case: Simple forecasting

#### **Medium Enterprise**
- Size: `Medium`
- Divisions: 3-4
- Clusters: 6-8
- Use case: Complex supply chain

#### **Large Corporation**
- Size: `Large`
- Divisions: 5-6
- Clusters: 10-12
- Use case: Multi-regional operations

## 🔍 What to Test

### **Authentication & Security**
- [ ] User registration works
- [ ] Email verification is required
- [ ] Login works with correct credentials
- [ ] Login fails with wrong password
- [ ] Users can only create one company
- [ ] JWT tokens work for API access

### **Multi-Tenant Isolation**
- [ ] User A cannot see User B's company data
- [ ] User A cannot access User B's divisions
- [ ] User A cannot access User B's clusters
- [ ] API calls are properly scoped to user's company

### **Setup Wizard**
- [ ] Setup wizard appears for new companies
- [ ] Divisions can be created
- [ ] Clusters can be created per division
- [ ] S&OP cycles can be created
- [ ] Setup completion works
- [ ] "Setup Organization" button appears when needed

### **Data Management**
- [ ] Company information is saved correctly
- [ ] Division information is saved correctly
- [ ] Cluster information is saved correctly
- [ ] S&OP cycle information is saved correctly
- [ ] Data persists after page refresh

### **User Interface**
- [ ] Welcome screen shows correct user info
- [ ] Navigation works properly
- [ ] Forms validate input correctly
- [ ] Error messages are clear
- [ ] Success messages appear
- [ ] Loading states work

## 🛠️ Testing Tools

### **Browser Developer Tools**
1. **Open DevTools** (F12)
2. **Check Network tab** for API calls
3. **Check Console tab** for errors
4. **Check Application tab** for stored tokens

### **Database Inspection**
```sql
-- Check users
SELECT * FROM users ORDER BY created_at DESC LIMIT 5;

-- Check companies
SELECT * FROM companies ORDER BY created_at DESC LIMIT 5;

-- Check divisions
SELECT c.name as company, d.name as division 
FROM divisions d 
JOIN companies c ON d.company_id = c.id;

-- Check clusters
SELECT c.name as company, d.name as division, cl.name as cluster
FROM clusters cl
JOIN divisions d ON cl.division_id = d.id
JOIN companies c ON d.company_id = c.id;
```

### **API Testing with curl**
```bash
# Test registration
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"test","password":"Password123!","first_name":"Test","last_name":"User"}'

# Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123!"}'

# Test authenticated endpoint
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🐛 Common Issues & Solutions

### **Issue: "User already exists"**
- **Solution**: Use unique emails for each test
- **Example**: `testuser1@example.com`, `testuser2@example.com`

### **Issue: "Setup already complete"**
- **Solution**: Create a new user/company or use the "Setup Organization" button

### **Issue: "Cannot access data"**
- **Solution**: Make sure you're logged in with the correct user token

### **Issue: "Database connection error"**
- **Solution**: Check if PostgreSQL is running and accessible

## 📊 Test Checklist

### **Before Testing**
- [ ] Backend server is running
- [ ] Database is accessible
- [ ] Frontend is running
- [ ] No existing test data conflicts

### **During Testing**
- [ ] Test each user type
- [ ] Test data isolation
- [ ] Test setup wizard flow
- [ ] Test error scenarios
- [ ] Test UI responsiveness

### **After Testing**
- [ ] Clean up test data if needed
- [ ] Document any issues found
- [ ] Verify all features work as expected

## 🎯 Advanced Testing

### **Load Testing**
```bash
# Test multiple concurrent users
for i in {1..10}; do
  node test-simple-user-scenarios.js &
done
wait
```

### **Security Testing**
- Try accessing API without authentication
- Try accessing other users' data
- Test SQL injection attempts
- Test XSS attempts

### **Performance Testing**
- Monitor database query performance
- Check API response times
- Test with large datasets

## 📝 Recording Test Results

Create a test log file:
```markdown
# Test Results - [Date]

## Tested Scenarios
- [ ] New user registration
- [ ] Company creation
- [ ] Setup wizard completion
- [ ] Multi-tenant isolation
- [ ] Data persistence

## Issues Found
- Issue 1: [Description]
- Issue 2: [Description]

## Performance Notes
- Registration time: [X] seconds
- Login time: [X] seconds
- Setup completion: [X] seconds

## Recommendations
- [Recommendation 1]
- [Recommendation 2]
```

## 🎉 Success Criteria

Your multi-tenant system is working correctly when:

1. ✅ Users can register and verify their accounts
2. ✅ Users can create companies and complete setup
3. ✅ Data is properly isolated between companies
4. ✅ Setup wizard guides users through the process
5. ✅ All UI elements work as expected
6. ✅ No security vulnerabilities are found
7. ✅ Performance is acceptable for the use case

---

**Happy Testing! 🚀**

Remember: Start simple, test incrementally, and document everything you find! 