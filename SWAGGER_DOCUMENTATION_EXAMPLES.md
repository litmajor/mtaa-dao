/**
 * EXAMPLE: How to Add Swagger Documentation to Your Routes
 * 
 * Copy the @swagger blocks below to your actual route files
 * Replace the examples with your real endpoints
 * 
 * File: server/routes/example.ts
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: User login
 *     description: Authenticate user with email and password, returns JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePassword123!
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         name:
 *                           type: string
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /users/{userId}:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get user profile
 *     description: Retrieve complete user profile information including reputation and settings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique user identifier
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                       format: email
 *                     name:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                       format: url
 *                     reputation:
 *                       type: number
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - missing or invalid token
 */

/**
 * @swagger
 * /users:
 *   get:
 *     tags:
 *       - Users
 *     summary: List all users
 *     description: Retrieve paginated list of users with optional filtering and sorting
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of results per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of results to skip
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [created_at, reputation, name]
 *           default: created_at
 *         description: Field to sort by
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for user name or email
 *     responses:
 *       200:
 *         description: Users list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       400:
 *         description: Invalid query parameters
 */

/**
 * @swagger
 * /users:
 *   post:
 *     tags:
 *       - Users
 *     summary: Create new user
 *     description: Register a new user account with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: newuser@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePassword123!
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 example: John Doe
 *               phone:
 *                 type: string
 *                 format: phone
 *                 example: +254701234567
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *       400:
 *         description: Validation error or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /payments:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Initiate payment
 *     description: Create a new payment transaction with specified amount and provider
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - currency
 *               - provider
 *               - description
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 1000
 *                 description: Amount in smallest currency unit (cents/cents equivalent)
 *               currency:
 *                 type: string
 *                 enum: [KES, USD, EUR, GBP]
 *                 example: KES
 *               provider:
 *                 type: string
 *                 enum: [mpesa, flutterwave, paystack, stripe]
 *                 example: mpesa
 *               description:
 *                 type: string
 *                 example: Deposit to vault
 *               phoneNumber:
 *                 type: string
 *                 example: +254701234567
 *               metadata:
 *                 type: object
 *                 example: { orderId: '12345' }
 *     responses:
 *       201:
 *         description: Payment initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactionId:
 *                       type: string
 *                       example: txn_abc123
 *                     status:
 *                       type: string
 *                       enum: [pending, processing, completed, failed]
 *                     paymentUrl:
 *                       type: string
 *                       format: url
 *       400:
 *         description: Invalid payment details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /daos:
 *   get:
 *     tags:
 *       - DAO Governance
 *     summary: List all DAOs
 *     description: Retrieve paginated list of all DAOs with their details
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by DAO category
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, archived]
 *     responses:
 *       200:
 *         description: DAOs list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */

/**
 * @swagger
 * /daos:
 *   post:
 *     tags:
 *       - DAO Governance
 *     summary: Create new DAO
 *     description: Deploy a new DAO with initial configuration and governance parameters
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 example: Climate Action DAO
 *               description:
 *                 type: string
 *                 example: DAO focused on climate change initiatives
 *               category:
 *                 type: string
 *                 example: Environmental
 *               tokenSymbol:
 *                 type: string
 *                 example: CLIMATE
 *               initialSupply:
 *                 type: number
 *                 example: 1000000
 *     responses:
 *       201:
 *         description: DAO created successfully
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /admin/analytics/report:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get analytics report
 *     description: Retrieve comprehensive system analytics for specified time period
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hoursBack
 *         schema:
 *           type: integer
 *           default: 24
 *           minimum: 1
 *           maximum: 720
 *         description: Hours back to analyze (max 30 days)
 *     responses:
 *       200:
 *         description: Analytics report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized - admin access required
 */

// COPY AND MODIFY THESE EXAMPLES FOR YOUR ACTUAL ENDPOINTS

// Simple GET endpoint template:
// @swagger
// /resource:
//   get:
//     tags:
//       - Resource
//     summary: Get resources
//     responses:
//       200:
//         description: Success

// POST with request body template:
// @swagger
// /resource:
//   post:
//     tags:
//       - Resource
//     requestBody:
//       required: true
//       content:
//         application/json:
//           schema:
//             type: object
//             required: [field]
//             properties:
//               field:
//                 type: string
//     responses:
//       201:
//         description: Created

// Parameterized endpoint template:
// @swagger
// /resource/{id}:
//   get:
//     parameters:
//       - in: path
//         name: id
//         required: true
//         schema:
//           type: string
//     responses:
//       200:
//         description: Success
//       404:
//         description: Not found
