dms-backend/
├── server.js                          ← Entry point
├── package.json
├── nodemon.json
├── .env                               ← Create this yourself
│
├── src/
│   ├── app.js                         ← Express app setup
│   │
│   ├── config/
│   │   ├── database.js                ← MySQL pool manager
│   │   ├── env.js                     ← Env variable validation
│   │   └── mqtt.js                    ← MQTT client
│   │
│   ├── constants/
│   │   ├── enums.js
│   │   ├── mqttConstants.js
│   │   ├── permissions.js
│   │   └── roles.js
│   │
│   ├── database/
│   │   ├── migrationRunner.js
│   │   ├── migrations/
│   │   │   ├── 001_master_schema.sql  ← Master DB tables
│   │   │   └── 002_client_schema.sql  ← Per-client DB tables
│   │   └── seeders/
│   │       └── seed_superadmin.js
│   │
│   ├── events/
│   │   ├── eventBus.js
│   │   ├── index.js                   ← Registers all handlers
│   │   └── handlers/
│   │       ├── onClientCreated.js
│   │       ├── onClientDeleted.js
│   │       ├── onDisplayCreated.js
│   │       └── onDisplayDeleted.js
│   │
│   ├── jobs/
│   │   ├── index.js
│   │   ├── offlineDetector.js
│   │   └── subscriptionExpiry.js
│   │
│   ├── middleware/
│   │   ├── auth.js                    ← JWT verification
│   │   ├── authorize.js               ← Role guard
│   │   ├── errorHandler.js            ← Global error handler
│   │   ├── permission.js              ← Client permission guard
│   │   ├── rateLimiter.js
│   │   ├── security.js                ← Helmet + CORS
│   │   ├── tenantResolver.js          ← Sets req.dbName from JWT
│   │   ├── tvTenantResolver.js        ← Sets req.dbName from body
│   │   ├── upload.js                  ← Multer config
│   │   └── validate.js                ← express-validator errors
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.routes.js
│   │   │   ├── auth.service.js
│   │   │   └── auth.validations.js
│   │   │
│   │   ├── clients/
│   │   │   ├── clients.controller.js
│   │   │   ├── clients.routes.js
│   │   │   ├── clients.service.js
│   │   │   └── clients.validations.js
│   │   │
│   │   ├── contentAssignments/
│   │   │   ├── contentAssignments.controller.js
│   │   │   ├── contentAssignments.routes.js
│   │   │   ├── contentAssignments.service.js
│   │   │   └── contentAssignments.validations.js
│   │   │
│   │   ├── dashboard/
│   │   │   ├── dashboard.controller.js
│   │   │   ├── dashboard.routes.js
│   │   │   └── dashboard.service.js
│   │   │
│   │   ├── displays/
│   │   │   ├── displays.controller.js
│   │   │   ├── displays.routes.js
│   │   │   ├── displays.service.js
│   │   │   └── displays.validations.js
│   │   │
│   │   ├── health/
│   │   │   └── health.routes.js
│   │   │
│   │   ├── mediaBucket/
│   │   │   ├── mediaBucket.controller.js
│   │   │   ├── mediaBucket.routes.js
│   │   │   ├── mediaBucket.service.js
│   │   │   └── mediaBucket.validations.js
│   │   │
│   │   ├── mediaContent/
│   │   │   ├── mediaContent.controller.js
│   │   │   ├── mediaContent.routes.js
│   │   │   ├── mediaContent.service.js
│   │   │   └── mediaContent.validations.js
│   │   │
│   │   ├── productionLines/
│   │   │   ├── productionLines.controller.js
│   │   │   ├── productionLines.routes.js
│   │   │   ├── productionLines.service.js
│   │   │   └── productionLines.validations.js
│   │   │
│   │   ├── publish/
│   │   │   ├── publish.controller.js
│   │   │   ├── publish.routes.js
│   │   │   ├── publish.service.js
│   │   │   └── publish.validations.js
│   │   │
│   │   ├── storage/
│   │   │   └── storage.routes.js
│   │   │
│   │   ├── tv/
│   │   │   ├── tv.controller.js
│   │   │   ├── tv.routes.js
│   │   │   ├── tv.service.js
│   │   │   └── tv.validations.js
│   │   │
│   │   └── users/
│   │       ├── users.controller.js
│   │       ├── users.routes.js
│   │       ├── users.service.js
│   │       └── users.validations.js
│   │
│   ├── services/
│   │   ├── fileMatchingService.js
│   │   └── storageCalculator.js
│   │
│   └── utils/
│       ├── asyncHandler.js
│       ├── hash.js
│       ├── jwt.js
│       ├── logger.js
│       ├── pagination.js
│       ├── response.js
│       └── slugify.js
│
├── uploads/                           ← Auto-created at runtime
└── tvfiles/                           ← Auto-created at runtime





dms-frontend/
├── next.config.js
├── package.json
├── .env.local                         ← Create this yourself
│                                         NEXT_PUBLIC_API_URL=http://localhost:5004
│
└── src/
    ├── middleware.js                  ← Route protection + role redirect
    │
    ├── app/
    │   ├── layout.js                  ← Root layout (wraps Providers)
    │   ├── page.js                    ← Redirects / → /login
    │   ├── not-found.js               ← 404 page
    │   ├── providers.js               ← QueryClient + Auth + Toast
    │   │
    │   ├── login/
    │   │   └── page.js                ← Login page (all roles)
    │   │
    │   ├── (superadmin)/              ← Route group (SA only)
    │   │   ├── layout.js              ← Sidebar + Header
    │   │   ├── error.js               ← Error boundary
    │   │   ├── dashboard/
    │   │   │   ├── page.js            ← URL: /dashboard
    │   │   │   └── loading.js
    │   │   ├── clients/
    │   │   │   ├── page.js            ← URL: /clients
    │   │   │   ├── loading.js
    │   │   │   ├── new/
    │   │   │   │   └── page.js        ← URL: /clients/new
    │   │   │   └── [id]/
    │   │   │       └── page.js        ← URL: /clients/1
    │   │   └── storage/
    │   │       └── page.js            ← URL: /storage
    │   │
    │   ├── (admin)/                   ← Route group (Client Admin)
    │   │   ├── layout.js
    │   │   ├── error.js
    │   │   ├── dashboard/
    │   │   │   ├── page.js            ← URL: /admin/dashboard
    │   │   │   └── loading.js
    │   │   ├── displays/
    │   │   │   ├── page.js            ← URL: /admin/displays
    │   │   │   ├── loading.js
    │   │   │   └── [id]/
    │   │   │       └── page.js        ← URL: /admin/displays/1
    │   │   ├── production-lines/
    │   │   │   ├── page.js            ← URL: /admin/production-lines
    │   │   │   └── [id]/
    │   │   │       └── page.js        ← URL: /admin/production-lines/1
    │   │   ├── media/
    │   │   │   ├── page.js            ← URL: /admin/media
    │   │   │   ├── loading.js
    │   │   │   └── [folder]/
    │   │   │       └── page.js        ← URL: /admin/media/spring-promo
    │   │   ├── content/
    │   │   │   ├── page.js            ← URL: /admin/content
    │   │   │   └── loading.js
    │   │   ├── assignments/
    │   │   │   └── page.js            ← URL: /admin/assignments
    │   │   └── users/
    │   │       ├── page.js            ← URL: /admin/users
    │   │       └── loading.js
    │   │
    │   └── (employee)/                ← Route group (Employee)
    │       ├── layout.js
    │       ├── error.js
    │       ├── dashboard/
    │       │   └── page.js            ← URL: /employee/dashboard
    │       └── media/
    │           └── page.js            ← URL: /employee/media
    │
    ├── components/
    │   ├── charts/
    │   │   └── LineChart.js
    │   ├── layout/
    │   │   ├── Header.js
    │   │   ├── MobileNav.js
    │   │   └── Sidebar.js
    │   └── ui/
    │       ├── Avatar.js
    │       ├── Badge.js
    │       ├── Button.js
    │       ├── Card.js
    │       ├── ConfirmModal.js
    │       ├── Input.js              ← Also exports Field, Select, Textarea
    │       ├── Modal.js
    │       ├── ProgressBar.js
    │       ├── Spinner.js
    │       ├── StatCard.js
    │       ├── Toast.js
    │       └── Toggle.js
    │
    ├── hooks/
    │   ├── useApi.js
    │   └── useAuth.js
    │
    ├── lib/
    │   ├── api.js                     ← All API calls
    │   ├── auth.js                    ← AuthContext + useAuth
    │   └── utils.js                   ← fmt, daysLeft, etc.
    │
    └── styles/
        ├── globals.css                ← Design tokens + reset
        ├── layout.css                 ← Sidebar, header, shell
        └── components.css             ← Buttons, cards, tables, etc.