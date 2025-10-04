# MtaaDAO RBAC & User Roles Documentation

## Overview
Role-Based Access Control (RBAC) is used in MtaaDAO to manage permissions and access to features based on user roles. This ensures security, governance, and a clear separation of concerns for different user types.

## Core Concepts
- **Role**: A named set of permissions assigned to users (e.g., Admin, Member).
- **Permission**: An action or resource a role can access (e.g., create proposal, view vault).
- **User**: An individual account that can be assigned one or more roles.

## Default Roles
| Role         | Description                                      |
|--------------|--------------------------------------------------|
| SuperAdmin   | Full platform access, can manage all DAOs/users  |
| Admin        | DAO-level admin, can manage DAO settings/members |
| Member       | Standard DAO member, can vote and propose        |
| Contributor  | Can submit tasks, proposals, and contribute      |
| Elder        | High-reputation member, extra voting power       |
| Guest        | Limited access, can view public info             |

## Example Permissions Matrix
| Role        | Create Proposal | Vote | Manage DAO | Manage Users | View Analytics | Access Vault |
|-------------|----------------|------|------------|--------------|---------------|--------------|
| SuperAdmin  | Yes            | Yes  | Yes        | Yes          | Yes           | Yes          |
| Admin       | Yes            | Yes  | Yes        | Yes          | Yes           | Yes          |
| Member      | Yes            | Yes  | No         | No           | Yes           | Yes          |
| Contributor | Yes            | Yes  | No         | No           | Yes           | Yes          |
| Elder       | Yes            | Yes  | No         | No           | Yes           | Yes          |
| Guest       | No             | No   | No         | No           | Limited       | No           |

## RBAC Implementation
- **Role Assignment**: Roles are assigned at user creation or by DAO admins.
- **Permission Checks**: Backend and frontend check user roles before allowing actions.
- **Role Hierarchy**: Higher roles inherit permissions from lower roles (e.g., Admin > Member).
- **Custom Roles**: DAOs can define custom roles for specialized governance.

## API Endpoints (Example)
- `GET /api/users/:id/roles` — Get roles for a user
- `POST /api/daos/:daoId/roles` — Create a custom DAO role
- `PUT /api/users/:id/roles` — Update user roles
- `GET /api/roles` — List all platform roles

## Frontend Usage
- Show/hide UI elements based on user role
- Restrict navigation and actions for unauthorized users
- Display role badges and permissions in user profiles

## Security Best Practices
- Always validate permissions server-side
- Log role changes and permission escalations
- Use least privilege principle for sensitive actions

## Extending RBAC
- Add new roles as DAOs evolve
- Support multi-role users (e.g., Member + Contributor)
- Integrate with smart contracts for on-chain governance

---
For more details, see the API documentation and schema files.
