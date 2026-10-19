# AMCYBERWORLD — CyberPanel/cPanel deployment

This package is a Node.js application. Do not treat it as a normal PHP or HTML website.

## Requirements

- Node.js 20.9 or newer (Node.js 22 is recommended)
- An empty MySQL/MariaDB database and database user
- CyberPanel VPS SSH access, or cPanel's **Setup Node.js App** feature

The application creates its database tables automatically on the first API request.

## 1. Create the database

In CyberPanel, open **Databases > Create Database**. In cPanel, open **MySQL Databases**.

Create a database and user, grant the user all privileges, and save the exact database name, username, and password. Control panels often add an account prefix to the database name and username; use the complete values shown by the panel.

## 2. Upload the application

Extract `amcyberworld-cyberpanel.zip` into a private application directory, for example:

```text
/home/amcyberworld.com/nodeapp
```

Keep it beside `public_html`, not inside it, because the directory contains private configuration and uploaded customer documents.

## 3. Create the environment file

Inside `nodeapp`, copy `.env.example` to a new file named `.env` and enter the real values:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=complete_database_name
DB_USER=complete_database_username
DB_PASSWORD=database_password
AGENT_ACCESS_CODE=a-long-private-random-code
TELEGRAM_CONTACT_URL=https://t.me/your_username
UPLOAD_DIR=/home/amcyberworld.com/nodeapp/storage/uploads
```

Do not use the example values in production. The agent access code protects `/agent`.

## 4A. Start on CyberPanel

Connect to the server with SSH, then run:

```bash
cd /home/amcyberworld.com/nodeapp
node --version
npm install --global pm2
PORT=3000 HOSTNAME=127.0.0.1 pm2 start server.js --name amcyberworld
pm2 save
pm2 startup
```

Run the final command printed by `pm2 startup`, then run `pm2 save` once more. Confirm the application responds locally:

```bash
curl -I http://127.0.0.1:3000
pm2 logs amcyberworld --lines 50
```

Open OpenLiteSpeed WebAdmin, normally `https://SERVER-IP:7080`:

1. Open **Virtual Hosts > amcyberworld.com > External App > Add**.
2. Select **Web Server**.
3. Name it `amcyberworldNode` and set the address to `127.0.0.1:3000`.
4. Set **Max Connections** to `100`, **Initial Request Timeout** to `60`, and **Response Buffering** to `No`.
5. Open **Virtual Hosts > amcyberworld.com > Context > Add > Proxy**.
6. Set **URI** to `/` and select `amcyberworldNode` as the Web Server.
7. Gracefully restart OpenLiteSpeed.

The files in `public_html` are no longer used after all `/` traffic is proxied to the Node application.

## 4B. Start on cPanel

This only works if cPanel shows **Setup Node.js App** (sometimes named **Application Manager**).

1. Create a production Node.js application using Node.js 20 or 22.
2. Set its application root to the directory where this package was extracted.
3. Set the startup file to `server.js`.
4. Add every variable from `.env.example` in the application's environment-variable section.
5. Start or restart the application.

If **Setup Node.js App** is missing, the hosting provider has not enabled Node.js. Ask the provider to enable it or use a VPS.

## Updating later

Keep `.env` and `storage/uploads`. Replace the remaining application files with the new package, then run:

```bash
pm2 restart amcyberworld --update-env
```
