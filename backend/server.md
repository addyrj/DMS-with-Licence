# DMS Deployment Guide
scp ~/Desktop/src.zip ispplsop@68.178.162.52:/home/ispplsop/
cd /home/ispplsop/dms/backend
cp /home/ispplsop/src.zip .
unzip src.zip
ls -la
rm -f src.zip






## Project Paths

-   Backend: `/home/ispplsop/dms/backend`
-   Frontend: `/home/ispplsop/dms/dms-frontend`
-   Project ZIP: `/home/ispplsop/dms.zip`
-   Database SQL: `/home/ispplsop/master_db.sql`

## 1. Upload from Local

``` bash
scp ~/Desktop/dms.zip ispplsop@68.178.162.52:/home/ispplsop/
scp ~/Desktop/master_db.sql ispplsop@68.178.162.52:/home/ispplsop/
```

## 2. SSH

``` bash
ssh root@68.178.162.52
```

## 3. Stop Services

``` bash
pm2 stop all
```

## 4. Remove Old Files

``` bash
cd /home/ispplsop
rm -f dms.zip
rm -f master_db.sql
rm -rf dms
```

## 5. Extract

``` bash
unzip -q dms.zip -x "__MACOSX/*" "*.DS_Store"
```

## 6. Backend

``` bash
cd /home/ispplsop/dms/backend
cat .env
nano .env
npm install
pm2 delete dms-backend
pm2 start server.js --name dms-backend
pm2 save
pm2 logs dms-backend
```

## 7. Frontend

``` bash
cd /home/ispplsop/dms/dms-frontend
cat .env.local
nano .env.local
npm install
rm -rf .next
npm run build
pm2 delete dms-frontend
pm2 start npm --name dms-frontend -- start
pm2 save
pm2 logs dms-frontend
```

## 8. Database

``` sql
mysql -u root

DROP DATABASE IF EXISTS ispplsop_db;
CREATE DATABASE ispplsop_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON *.* TO 'ispplsop_user'@'localhost' WITH GRANT OPTION;
FLUSH PRIVILEGES;
EXIT;
```

``` bash
mysql -u root ispplsop_db < /home/ispplsop/master_db.sql
mysql -u root
```

``` sql
USE ispplsop_db;
SHOW TABLES;
SHOW GRANTS FOR 'ispplsop_user'@'localhost';
```

## 9. Verify

``` bash
pm2 list
curl http://localhost:5004/api
curl -I http://localhost:3000
pm2 logs dms-backend --lines 100
```



/home/ispplsop/dms/backend
cd /home/ispplsop/dms/backend

pm2 stop all
npm install
pm2 start server.js --name backend
pm2 restart backend
pm2 save
pm2 logs backend
node server.js


-----------------------------

/home/ispplsop/dms/dms-frontend

cd /home/ispplsop/dms/dms-frontend

pm2 stop frontend
npm install
rm -rf .next
npm run build
pm2 start npm --name frontend -- start
pm2 save
pm2 logs frontend
npm run start



cd /home/ispplsop/dms/backend
pm2 stop all
Ctrl + C

cd /home/ispplsop/dms/backend
pm2 start all

-----------------------------------

mysql -u root -p
mysql -u root

Sop@#2026

SHOW DATABASES;

DROP DATABASE ispplsop_db;
CREATE DATABASE ispplsop_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON ispplsop_db.* TO 'ispplsop_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

mysql -u root ispplsop_db < /home/ispplsop/master_db.sql
mysql -u root
USE ispplsop_db;
SHOW TABLES;
SELECT COUNT(*) FROM users;
SHOW GRANTS FOR 'ispplsop_user'@'localhost';

cd /home/ispplsop

rm -f dms.zip
rm -f master_db.sql
rm -rf /home/ispplsop/dms

rm -rf /home/ispplsop/dms/backend

# Remove the old project
cd /home/ispplsop
rm -rf dms
unzip -q dms.zip -x "__MACOSX/*" "*.DS_Store"
ls /home/ispplsop/dms

cd /home/ispplsop/dms/backend
npm install

cd /home/ispplsop/dms/backend
ls -la
cat .env
nano .env

cd /home/ispplsop/dms/dms-frontend
ls -la
cat .env.local
nano .env.local
scp ~/Desktop/dms.zip ispplsop@68.178.162.52:/home/ispplsop/

scp ispplsop_db.sql ispplsop@68.178.162.52:/home/ispplsop/
scp ~/Desktop/ispplsop_db.sql ispplsop@68.178.162.52:/home/ispplsop/

ssh ispplsop@68.178.162.52
ssh root@68.178.162.52