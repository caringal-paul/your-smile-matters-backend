// FOR REFERENCE ONLY - NOT A PART OF THE PROJECT
// This is a reference implementation of role-based access control (RBAC) in an Express.js application using TypeScript.
// It demonstrates how to define roles and permissions, create middleware for authentication and authorization, and protect routes based on user roles and permissions.

// app.get('/profile', authenticateAmiUserToken, (req: AuthenticatedRequest, res) => {
//     res.json({ user: req.user });
//   });

//   // Require specific permission
//   app.delete('/users/:id',
//     authenticateAmiUserToken,
//     requirePermission('delete_users'),
//     deleteUser
//   );

//   // Require specific role
//   app.get('/admin-dashboard',
//     authenticateAmiUserToken,
//     requireRole('admin'),
//     getAdminDashboard
//   );

//   // Require one of multiple roles
//   app.get('/moderator-tools',
//     authenticateAmiUserToken,
//     requireAnyRole(['admin', 'moderator']),
//     getModeratorTools
//   );
