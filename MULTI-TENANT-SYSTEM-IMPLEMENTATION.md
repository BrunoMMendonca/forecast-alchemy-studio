# Multi-Tenant System Implementation Guide

## Overview

This document outlines the complete implementation of a secure, scalable multi-tenant system for the Forecast Alchemy Studio application. The system provides user authentication, company management, and organizational hierarchy setup with proper data isolation and role-based access control.

## 🏗️ Architecture Overview

### System Components

1. **Authentication System** - JWT-based user authentication with registration, verification, and session management
2. **Company Management** - Multi-tenant company creation and ownership
3. **Organizational Hierarchy** - Company → Division → Cluster → S&OP Cycles structure
4. **Setup Wizard** - Guided organization setup process
5. **Data Isolation** - Company-scoped data access with proper authorization

### Database Schema

```
users
├── user_registrations (registration workflow)
├── user_sessions (authentication sessions)
├── company_admins (role-based permissions)
├── user_invitations (user management)
└── user_audit_logs (audit trail)

companies
├── divisions (business units)
├── clusters (geographic/operational units)
├── sop_cycles (planning cycles)
├── skus (product management)
├── datasets (data storage)
└── optimization_jobs (forecasting jobs)
```

## 🔐 Authentication Flow

### 1. User Registration
- User provides email, username, password, and personal details
- System creates registration record with verification token
- Email verification required before login

### 2. Email Verification
- User clicks verification link or enters token
- System activates user account and creates user record
- User can now log in

### 3. User Login
- User provides email and password
- System validates credentials and creates session
- Returns JWT session token and refresh token

### 4. Company Creation
- New users must create a company after login
- User becomes company owner with full permissions
- Company ID is linked to user account

## 🏢 Company Management

### Company Ownership
- Each user can own only one company
- Company owners have full administrative privileges
- Role-based permissions for additional users

### Company Admin Roles
- **Owner**: Full company control
- **Admin**: User management and configuration
- **Manager**: Division and cluster management
- **Analyst**: Data access and forecasting
- **Viewer**: Read-only access

## 🏗️ Organizational Hierarchy

### 1. Companies
- Top-level organizational unit
- Contains all business data and users
- Configurable company profile and settings

### 2. Divisions
- Business units within a company
- Represent major product categories or business lines
- Can have industry-specific configurations

### 3. Clusters
- Geographic or operational units within divisions
- Enable regional planning and forecasting
- Support country/region-specific data

### 4. S&OP Cycles
- Sales & Operations Planning cycles
- Time-bound planning periods
- Linked to specific divisions

## 🎯 Setup Wizard Implementation

### Flow Overview
1. **Welcome** - Introduction and overview
2. **Divisions** - Create business divisions
3. **Clusters** - Create geographic clusters
4. **S&OP Cycles** - Define planning cycles
5. **Complete** - Setup summary and next steps

### Key Features
- **Real-time Updates** - Changes appear immediately
- **Validation** - Required fields and data validation
- **Progress Tracking** - Visual progress indicator
- **Always Accessible** - Can be accessed anytime via "Setup Organization" button

## 🔒 Security Implementation

### Authentication Middleware
```javascript
// JWT token verification
export const authenticateToken = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const session = await validateSession(token);
    req.user = session.user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};
```

### Authorization Middleware
```javascript
// Role-based access control
export const requireCompanyAdmin = (resourceType) => {
  return async (req, res, next) => {
    const userId = req.user.id;
    const companyId = req.user.company_id;
    
    const admin = await getCompanyAdmin(userId, companyId);
    if (!admin.canManageResource(resourceType)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};
```

### Data Isolation
- All API endpoints require authentication
- Company ID is extracted from user session
- Database queries filter by company_id
- Cross-company data access is prevented

## 🚀 Frontend Integration

### Authentication Flow Component
```typescript
// AuthFlow.tsx - Handles complete authentication process
const AuthFlow: React.FC<AuthFlowProps> = ({ onAuthComplete }) => {
  const [step, setStep] = useState<'register' | 'verify' | 'login' | 'create-company'>('register');
  
  // Registration, verification, login, and company creation logic
  // Integrated with backend authentication system
};
```

### App-Level Authentication
```typescript
// App.tsx - Main application with authentication guard
const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);

  // Check authentication status on app load
  // Redirect to AuthFlow if not authenticated
  // Pass user/company data to authenticated components
};
```

### Setup Wizard Integration
```typescript
// SetupWizard.tsx - Organization setup with authentication
const SetupWizard: React.FC = () => {
  // Uses authenticated company ID for all operations
  // Proper error handling for authentication failures
  // Real-time data loading with auth headers
};
```

## 📊 API Endpoints

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/verify` - Email verification
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Token refresh
- `GET /api/auth/me` - Get current user
- `POST /api/auth/company` - Create company
- `GET /api/auth/company` - Get user's company

### Setup Endpoints
- `GET /api/auth/setup/status` - Check setup status
- `POST /api/setup/divisions` - Create division
- `POST /api/setup/clusters` - Create cluster
- `POST /api/setup/sop-cycles` - Create S&OP cycle
- `POST /api/setup/complete` - Complete setup

### Data Endpoints
- `GET /api/divisions?companyId=X` - Get divisions
- `GET /api/clusters?companyId=X` - Get clusters
- `GET /api/sop-cycles?companyId=X` - Get S&OP cycles

## 🧪 Testing

### Comprehensive Test Suite
```javascript
// test-complete-multi-tenant-system.js
// Tests all authentication and setup flows:
// 1. User registration and verification
// 2. Login and session management
// 3. Company creation and ownership
// 4. Organizational hierarchy setup
// 5. Data isolation and authorization
// 6. Token refresh and logout
```

### Test Coverage
- ✅ User registration and verification
- ✅ Authentication and session management
- ✅ Company creation and ownership
- ✅ Division, cluster, and S&OP cycle creation
- ✅ Data retrieval with proper isolation
- ✅ Token refresh and logout
- ✅ Error handling and validation

## 🔧 Configuration

### Environment Variables
```bash
# Database Configuration
DB_USER=your_db_user
DB_HOST=localhost
DB_NAME=forecast_alchemy
DB_PASSWORD=your_db_password
DB_PORT=5432

# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production

# Application Configuration
PORT=3001
NODE_ENV=development
```

### Database Setup
```sql
-- Run user-management-schema.sql for authentication tables
-- Run create-fresh-database.sql for main application tables
-- Ensure proper indexes and constraints are created
```

## 🚀 Deployment

### Prerequisites
1. PostgreSQL database with proper schema
2. Node.js environment with required dependencies
3. Environment variables configured
4. SSL certificates for production

### Production Considerations
- Use strong JWT secrets
- Enable HTTPS for all communications
- Implement rate limiting
- Set up proper logging and monitoring
- Configure database connection pooling
- Implement backup and recovery procedures

## 📈 Scalability Features

### Multi-Tenant Architecture
- Company-based data isolation
- Scalable database design
- Efficient query patterns
- Connection pooling

### Performance Optimizations
- JWT-based stateless authentication
- Database indexes on company_id
- Caching strategies for frequently accessed data
- Background job processing for heavy operations

### Security Features
- Password hashing with bcrypt
- JWT token expiration and refresh
- Session management
- Role-based access control
- Audit logging

## 🔄 Future Enhancements

### Planned Features
1. **User Invitations** - Invite users to existing companies
2. **Advanced Roles** - Granular permission system
3. **Company Templates** - Pre-configured organizational structures
4. **Audit Dashboard** - User activity monitoring
5. **SSO Integration** - Single sign-on with external providers
6. **API Rate Limiting** - Per-company rate limiting
7. **Data Export/Import** - Company data migration tools

### Technical Improvements
1. **Microservices Architecture** - Service decomposition
2. **Event-Driven Architecture** - Asynchronous processing
3. **Caching Layer** - Redis integration
4. **Monitoring & Alerting** - Comprehensive observability
5. **Automated Testing** - CI/CD pipeline integration

## 📚 Conclusion

The multi-tenant system provides a robust foundation for the Forecast Alchemy Studio application with:

- **Security**: Comprehensive authentication and authorization
- **Scalability**: Multi-tenant architecture with proper data isolation
- **Usability**: Intuitive setup wizard and user experience
- **Maintainability**: Clean code structure and comprehensive documentation
- **Testability**: Complete test coverage and validation

The system is production-ready and can support multiple companies with their respective organizational structures, users, and data while maintaining proper security and performance standards. 