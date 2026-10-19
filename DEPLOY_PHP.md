AMCYBERWORLD — SIMPLE CPANEL/CYBERPANEL PACKAGE

1. Upload all files from this package into the domain's public_html folder.
2. Extract them directly in public_html. index.html and api.php must be directly inside public_html.
3. The application first looks for the database settings already saved in ../nodeapp/.env.
4. If that file does not exist, copy .env.example to .env in public_html and enter the database details.
5. Open the domain. PHP creates the database tables automatically.

Requirements: PHP 8.1 or newer with PDO MySQL, Fileinfo, and Mbstring. These are normally enabled by cPanel and CyberPanel.

Keep .env private. The included .htaccess blocks web access to it and to uploaded documents.
