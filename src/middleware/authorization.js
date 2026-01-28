// src/middleware/authorization.js
// Role-based authorization for admin capabilities

export const ROLE_CAPABILITIES = {
  superadmin: [
    'manageAdmins',
    'managePolls',
    'manageUsers',
    'manageSurveys',
    'viewAnalytics',
    'exportData',
    'viewPolls',
    'viewUsers'
  ],
  admin: [
    'managePolls',
    'manageUsers',
    'manageSurveys',
    'viewAnalytics',
    'viewPolls',
    'viewUsers',
    'exportData'
  ],
  editor: [
    'managePolls',
    'manageSurveys',
    'viewAnalytics',
    'viewPolls',
    'viewUsers'
  ],
  viewer: [
    'viewPolls',
    'viewUsers',
    'viewAnalytics'
  ]
};

export const VALID_ROLES = Object.keys(ROLE_CAPABILITIES);

export const authorizeAdmin = (permission) => (req, res, next) => {
  try {
    const role = req?.admin?.role;
    if (!role || !ROLE_CAPABILITIES[role]) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const allowed = ROLE_CAPABILITIES[role].includes(permission);
    if (!allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  } catch (error) {
    console.error('Authorization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
