<?php

declare(strict_types=1);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

function read_env_file(string $path): array
{
    if (!is_readable($path)) {
        return [];
    }
    $values = [];
    foreach (file($path, FILE_IGNORE_NEW_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }
        [$name, $value] = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);
        if (strlen($value) >= 2 && (($value[0] === '"' && $value[-1] === '"') || ($value[0] === "'" && $value[-1] === "'"))) {
            $value = substr($value, 1, -1);
        }
        if (preg_match('/^[A-Z][A-Z0-9_]*$/', $name)) {
            $values[$name] = $value;
        }
    }
    return $values;
}

function database_error_message(Throwable $error): string
{
    $mysqlCode = $error instanceof PDOException ? (int) ($error->errorInfo[1] ?? 0) : 0;
    return match ($mysqlCode) {
        1044, 1045 => 'MySQL rejected the username or password, or the user was not assigned to this database.',
        1049 => 'The database name does not exist. Use the complete database name shown by the panel.',
        1142, 1143 => 'The database user does not have permission to create or use tables. Grant All Privileges.',
        2002, 2003, 2005 => 'The database server could not be reached. DB_HOST should normally be localhost.',
        default => str_contains(strtolower($error->getMessage()), 'could not find driver')
            ? 'PDO MySQL is not enabled for this PHP version.'
            : 'The database connection failed. Check the hosting error log for the detailed MySQL message.',
    };
}

$possibleEnvFiles = [
    dirname(__DIR__) . '/nodeapp/.env' => 'nodeapp/.env',
    __DIR__ . '/.env' => 'public_html/.env',
];
$env = [];
$envLabel = 'Not found';
foreach ($possibleEnvFiles as $path => $label) {
    if (is_readable($path)) {
        $env = read_env_file($path);
        $envLabel = $label;
        break;
    }
}

$checks = [];
$checks[] = ['PHP version', version_compare(PHP_VERSION, '8.1.0', '>='), PHP_VERSION];
$checks[] = ['Environment file', $envLabel !== 'Not found', $envLabel];
$checks[] = ['PDO MySQL extension', extension_loaded('pdo_mysql'), extension_loaded('pdo_mysql') ? 'Enabled' : 'Not enabled'];
$checks[] = ['Fileinfo extension', extension_loaded('fileinfo'), extension_loaded('fileinfo') ? 'Enabled' : 'Not enabled'];
$checks[] = ['Mbstring extension', extension_loaded('mbstring'), extension_loaded('mbstring') ? 'Enabled' : 'Not enabled'];

$required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'AGENT_ACCESS_CODE'];
$missing = array_values(array_filter($required, static fn (string $name): bool => !isset($env[$name]) || trim((string) $env[$name]) === ''));
$checks[] = ['Required settings', count($missing) === 0, count($missing) === 0 ? 'Present' : 'Missing: ' . implode(', ', $missing)];

$databaseOkay = false;
$databaseMessage = 'Not tested because an earlier requirement failed.';
if (extension_loaded('pdo_mysql') && count($missing) === 0) {
    try {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            $env['DB_HOST'],
            (int) ($env['DB_PORT'] ?? 3306),
            $env['DB_NAME'],
        );
        $database = new PDO($dsn, $env['DB_USER'], $env['DB_PASSWORD'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 5,
        ]);
        $database->query('SELECT 1')->fetchColumn();
        $database->exec('CREATE TEMPORARY TABLE amcyberworld_permission_test (id INT)');
        $databaseOkay = true;
        $databaseMessage = 'Connected; table permissions are working.';
    } catch (Throwable $error) {
        $databaseMessage = database_error_message($error);
    }
}
$checks[] = ['Database connection', $databaseOkay, $databaseMessage];

$uploadDirectory = trim((string) ($env['UPLOAD_DIR'] ?? ''));
$uploadDirectory = $uploadDirectory !== '' ? $uploadDirectory : __DIR__ . '/private-storage/uploads';
$uploadOkay = is_dir($uploadDirectory) && is_writable($uploadDirectory);
$checks[] = ['Private upload folder', $uploadOkay, $uploadOkay ? 'Exists and is writable.' : 'Missing or not writable.'];

$allOkay = !in_array(false, array_column($checks, 1), true);
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>AMCYBERWORLD Hosting Check</title>
    <style>
        body { margin: 0; padding: 32px 18px; background: #f6f4ef; color: #15231f; font: 16px/1.5 Arial, sans-serif; }
        main { max-width: 760px; margin: auto; padding: 28px; background: white; border: 1px solid #d9ded9; border-radius: 10px; }
        h1 { margin-top: 0; font-family: Georgia, serif; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 13px 10px; border-bottom: 1px solid #e3e6e3; text-align: left; vertical-align: top; }
        .pass { color: #176b4d; font-weight: bold; }
        .fail { color: #a3372d; font-weight: bold; }
        .notice { padding: 14px; border-left: 4px solid <?= $allOkay ? '#176b4d' : '#a3372d' ?>; background: #f6f8f7; }
        code { background: #edf1ef; padding: 2px 5px; }
    </style>
</head>
<body>
<main>
    <h1>AMCYBERWORLD hosting check</h1>
    <p class="notice"><?= $allOkay ? 'Everything passed. The application should be able to use the database and private uploads.' : 'One or more checks failed. The table below shows what needs to be corrected.' ?></p>
    <table>
        <thead><tr><th>Check</th><th>Status</th><th>Details</th></tr></thead>
        <tbody>
        <?php foreach ($checks as [$name, $passed, $details]): ?>
            <tr>
                <td><?= htmlspecialchars($name, ENT_QUOTES, 'UTF-8') ?></td>
                <td class="<?= $passed ? 'pass' : 'fail' ?>"><?= $passed ? 'PASS' : 'FAIL' ?></td>
                <td><?= htmlspecialchars((string) $details, ENT_QUOTES, 'UTF-8') ?></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <p><strong>Delete this diagnostic file from public_html after testing.</strong></p>
</main>
</body>
</html>
