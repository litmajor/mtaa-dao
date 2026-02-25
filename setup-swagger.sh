#!/bin/bash
# Quick setup script for Swagger documentation
# Run this after installing packages

echo "🚀 MTAA DAO API - Swagger Documentation Setup"
echo "=============================================="
echo ""

# Step 1: Check if packages are installed
echo "📦 Checking required packages..."

packages_ok=true

if ! npm list swagger-ui-express > /dev/null 2>&1; then
    echo "❌ swagger-ui-express not found"
    packages_ok=false
else
    echo "✅ swagger-ui-express installed"
fi

if ! npm list swagger-jsdoc > /dev/null 2>&1; then
    echo "❌ swagger-jsdoc not found"
    packages_ok=false
else
    echo "✅ swagger-jsdoc installed"
fi

if [ "$packages_ok" = false ]; then
    echo ""
    echo "⚠️  Installing missing packages..."
    npm install swagger-ui-express swagger-jsdoc @types/swagger-jsdoc
    echo ""
fi

# Step 2: Check configuration files
echo "📄 Checking configuration files..."

if [ -f "server/config/swagger.ts" ]; then
    echo "✅ Swagger config found"
else
    echo "❌ Swagger config missing"
fi

if [ -f "server/middleware/swaggerMiddleware.ts" ]; then
    echo "✅ Swagger middleware found"
else
    echo "❌ Swagger middleware missing"
fi

# Step 3: Summary
echo ""
echo "✨ Setup Complete!"
echo ""
echo "📝 Documentation will be available at:"
echo "   👉 http://localhost:3000/api-docs"
echo ""
echo "📋 OpenAPI spec at:"
echo "   👉 http://localhost:3000/api/openapi.json"
echo ""
echo "🚀 Next steps:"
echo "   1. Run: npm run dev"
echo "   2. Open: http://localhost:3000/api-docs"
echo "   3. See examples in: SWAGGER_DOCUMENTATION_EXAMPLES.md"
echo ""
echo "💡 To add documentation to an endpoint:"
echo "   Add JSDoc comments with @swagger to your route file"
echo ""
