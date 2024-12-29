#!/bin/bash
sed -i 's/DATABASE_URL/DATABASE_URL_LOCAL/' prisma/schema/schema.prisma
npx prisma migrate dev --name $1
sed -i 's/DATABASE_URL_LOCAL/DATABASE_URL/' prisma/schema/schema.prisma