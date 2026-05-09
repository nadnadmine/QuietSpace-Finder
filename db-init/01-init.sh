#!/bin/bash
set -e

echo "Initializing databases..."

# Run the schemas
mysql -u root -p"$MYSQL_ROOT_PASSWORD" < /opt/services/auth-service/schema.sql
mysql -u root -p"$MYSQL_ROOT_PASSWORD" < /opt/services/place-service/schema.sql
mysql -u root -p"$MYSQL_ROOT_PASSWORD" < /opt/services/notification-service/schema.sql

echo "Databases initialized successfully."
