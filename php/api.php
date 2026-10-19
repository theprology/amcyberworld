<?php

declare(strict_types=1);

ini_set('display_errors', '0');
header('X-Content-Type-Options: nosniff');

function json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function load_env_file(string $path): array
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

function settings(): array
{
    static $settings = null;
    if (is_array($settings)) {
        return $settings;
    }

    $settings = [];
    $possibleFiles = [
        dirname(__DIR__) . '/nodeapp/.env',
        __DIR__ . '/.env',
    ];
    foreach ($possibleFiles as $file) {
        if (is_readable($file)) {
            $settings = array_merge($settings, load_env_file($file));
            break;
        }
    }

    foreach (['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'AGENT_ACCESS_CODE', 'TELEGRAM_CONTACT_URL', 'UPLOAD_DIR'] as $name) {
        $environmentValue = getenv($name);
        if ($environmentValue !== false && $environmentValue !== '') {
            $settings[$name] = $environmentValue;
        }
    }

    foreach (['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'AGENT_ACCESS_CODE'] as $required) {
        if (!isset($settings[$required]) || trim((string) $settings[$required]) === '') {
            throw new RuntimeException("Missing website setting: {$required}");
        }
    }
    $settings['DB_PORT'] = $settings['DB_PORT'] ?? '3306';
    return $settings;
}

function database(): PDO
{
    static $database = null;
    if ($database instanceof PDO) {
        return $database;
    }

    $config = settings();
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $config['DB_HOST'],
        (int) $config['DB_PORT'],
        $config['DB_NAME'],
    );
    $database = new PDO($dsn, $config['DB_USER'], $config['DB_PASSWORD'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_STRINGIFY_FETCHES => false,
        PDO::MYSQL_ATTR_FOUND_ROWS => true,
    ]);
    initialize_database($database);
    return $database;
}

function initialize_database(PDO $database): void
{
    $database->exec("CREATE TABLE IF NOT EXISTS applications (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        intake_id VARCHAR(40) NOT NULL,
        application_id VARCHAR(64) NOT NULL,
        program_id VARCHAR(32) NOT NULL,
        given_name VARCHAR(80) NOT NULL,
        family_name VARCHAR(80) NOT NULL,
        email VARCHAR(160) NOT NULL,
        phone VARCHAR(40) NOT NULL,
        nationality VARCHAR(100) NOT NULL,
        residence_country VARCHAR(100) NOT NULL,
        other_nationalities VARCHAR(160) NOT NULL,
        family_size TINYINT UNSIGNED NOT NULL,
        available_funds VARCHAR(40) NOT NULL,
        timeline VARCHAR(40) NOT NULL,
        occupation VARCHAR(120) NOT NULL,
        source_of_funds VARCHAR(120) NOT NULL,
        compliance_answers TEXT NOT NULL,
        proof_file_key VARCHAR(255) NOT NULL,
        proof_file_name VARCHAR(180) NOT NULL,
        proof_content_type VARCHAR(100) NOT NULL,
        proof_size INT UNSIGNED NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'submitted',
        created_at BIGINT UNSIGNED NOT NULL,
        UNIQUE KEY idx_applications_intake_id (intake_id),
        UNIQUE KEY idx_applications_application_id (application_id),
        KEY idx_applications_status_created (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $database->exec("CREATE TABLE IF NOT EXISTS reviews (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        application_id VARCHAR(64) NOT NULL,
        program_id VARCHAR(32) NOT NULL,
        display_name VARCHAR(60) NOT NULL,
        rating TINYINT UNSIGNED NOT NULL,
        speed_rating TINYINT UNSIGNED NOT NULL,
        message TEXT NOT NULL,
        staff_reply TEXT NULL,
        staff_reply_at BIGINT UNSIGNED NULL,
        published TINYINT(1) NOT NULL DEFAULT 1,
        created_at BIGINT UNSIGNED NOT NULL,
        UNIQUE KEY idx_reviews_application_id (application_id),
        KEY idx_reviews_published_created (published, created_at),
        CONSTRAINT fk_reviews_application
          FOREIGN KEY (application_id) REFERENCES applications(application_id)
          ON UPDATE CASCADE ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function request_json(): array
{
    try {
        $body = json_decode(file_get_contents('php://input') ?: '', true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new InvalidArgumentException('The request data is invalid.');
    }
    if (!is_array($body)) {
        throw new InvalidArgumentException('The request data is invalid.');
    }
    return $body;
}

function required_array_text(array $values, string $field, int $maximum): string
{
    $value = trim((string) ($values[$field] ?? ''));
    if ($value === '' || mb_strlen($value) > $maximum) {
        throw new InvalidArgumentException("Invalid {$field}.");
    }
    return $value;
}

function form_text(string $field, int $maximum): string
{
    return required_array_text($_POST, $field, $maximum);
}

function create_intake_reference(): string
{
    return 'INT-' . gmdate('Y') . '-' . strtoupper(bin2hex(random_bytes(7)));
}

function create_application_id(): string
{
    return 'CIB-' . gmdate('Y') . '-' . strtoupper(bin2hex(random_bytes(10)));
}

function agent_authorized(): bool
{
    $expected = (string) settings()['AGENT_ACCESS_CODE'];
    $received = (string) ($_SERVER['HTTP_X_AGENT_CODE'] ?? '');
    return $expected !== '' && hash_equals($expected, $received);
}

function require_agent(): void
{
    if (!agent_authorized()) {
        json_response(['error' => 'Agent access code is invalid.'], 401);
    }
}

function storage_root(): string
{
    static $root = null;
    if (is_string($root)) {
        return $root;
    }
    $configured = trim((string) (settings()['UPLOAD_DIR'] ?? ''));
    $root = $configured !== '' ? $configured : __DIR__ . '/private-storage/uploads';
    if (!is_dir($root) && !mkdir($root, 0750, true) && !is_dir($root)) {
        throw new RuntimeException('The private upload folder could not be created.');
    }
    $resolved = realpath($root);
    if ($resolved === false) {
        throw new RuntimeException('The private upload folder is invalid.');
    }
    $root = $resolved;
    return $root;
}

function private_file_path(string $fileKey): string
{
    if (!preg_match('#^applications/INT-\d{4}-[A-F0-9]{14}/proof\.(pdf|jpg|png|webp)$#', $fileKey)) {
        throw new RuntimeException('The private file path is invalid.');
    }
    return storage_root() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $fileKey);
}

function normalized_review(array $row): array
{
    foreach (['id', 'rating', 'speedRating', 'createdAt'] as $field) {
        if (array_key_exists($field, $row)) {
            $row[$field] = (int) $row[$field];
        }
    }
    if (array_key_exists('staffReplyAt', $row)) {
        $row['staffReplyAt'] = $row['staffReplyAt'] === null ? null : (int) $row['staffReplyAt'];
    }
    return $row;
}

function normalized_application(array $row): array
{
    foreach (['familySize', 'createdAt'] as $field) {
        if (array_key_exists($field, $row)) {
            $row[$field] = (int) $row[$field];
        }
    }
    return $row;
}

function handle_application_submission(): never
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        json_response(['error' => 'Method not allowed.'], 405);
    }

    $upload = $_FILES['proofOfFunds'] ?? null;
    if (!is_array($upload) || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new InvalidArgumentException('Upload a PDF, JPG, PNG or WEBP file up to 8 MB.');
    }
    $fileSize = (int) ($upload['size'] ?? 0);
    if ($fileSize < 1 || $fileSize > 8 * 1024 * 1024) {
        throw new InvalidArgumentException('Upload a PDF, JPG, PNG or WEBP file up to 8 MB.');
    }

    $temporaryFile = (string) ($upload['tmp_name'] ?? '');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($temporaryFile);
    $extensions = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];
    if (!is_string($mime) || !isset($extensions[$mime])) {
        throw new InvalidArgumentException('Upload a PDF, JPG, PNG or WEBP file up to 8 MB.');
    }

    $programId = form_text('programId', 32);
    $programs = ['antigua', 'dominica', 'grenada', 'st-kitts', 'st-lucia', 'turkiye'];
    if (!in_array($programId, $programs, true)) {
        throw new InvalidArgumentException('Select a supported program.');
    }
    $email = strtolower(form_text('email', 160));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Enter a valid email address.');
    }
    $familySize = filter_var($_POST['familySize'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 20]]);
    if ($familySize === false) {
        throw new InvalidArgumentException('Family size must be between 1 and 20.');
    }
    if (($_POST['consent'] ?? '') !== 'yes' || ($_POST['redacted'] ?? '') !== 'yes') {
        throw new InvalidArgumentException('Privacy consent and document redaction confirmation are required.');
    }

    $intakeReference = create_intake_reference();
    $pendingApplicationKey = 'PENDING-' . $intakeReference;
    $fileKey = "applications/{$intakeReference}/proof.{$extensions[$mime]}";
    $target = private_file_path($fileKey);
    $targetDirectory = dirname($target);
    if (!is_dir($targetDirectory) && !mkdir($targetDirectory, 0750, true) && !is_dir($targetDirectory)) {
        throw new RuntimeException('The private upload folder could not be created.');
    }
    if (!move_uploaded_file($temporaryFile, $target)) {
        throw new RuntimeException('The proof document could not be stored.');
    }
    chmod($target, 0640);

    try {
        $statement = database()->prepare("INSERT INTO applications (
            intake_id, application_id, program_id, given_name, family_name, email, phone,
            nationality, residence_country, other_nationalities, family_size, available_funds,
            timeline, occupation, source_of_funds, compliance_answers, proof_file_key,
            proof_file_name, proof_content_type, proof_size, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)");
        $statement->execute([
            $intakeReference,
            $pendingApplicationKey,
            $programId,
            form_text('givenName', 80),
            form_text('familyName', 80),
            $email,
            form_text('phone', 40),
            form_text('nationality', 100),
            form_text('residenceCountry', 100),
            mb_substr(trim((string) ($_POST['otherNationalities'] ?? '')), 0, 160),
            $familySize,
            form_text('availableFunds', 40),
            form_text('timeline', 40),
            form_text('occupation', 120),
            form_text('sourceOfFunds', 120),
            json_encode([
                'politicallyExposed' => form_text('politicallyExposed', 8),
                'criminalRecord' => form_text('criminalRecord', 8),
                'visaRefusal' => form_text('visaRefusal', 8),
            ], JSON_THROW_ON_ERROR),
            $fileKey,
            mb_substr(basename((string) ($upload['name'] ?? 'proof')), 0, 180),
            $mime,
            $fileSize,
            (int) floor(microtime(true) * 1000),
        ]);
    } catch (Throwable $error) {
        @unlink($target);
        throw $error;
    }

    $message = "Hello AMCYBERWORLD Support, my intake reference is {$intakeReference}. Please connect me with a case specialist.";
    $telegramContact = trim((string) (settings()['TELEGRAM_CONTACT_URL'] ?? ''));
    if (str_starts_with($telegramContact, 'https://t.me/')) {
        $telegramUrl = $telegramContact . (str_contains($telegramContact, '?') ? '&' : '?') . 'draft_text=' . rawurlencode($message);
    } else {
        $secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        $host = preg_replace('/[^A-Za-z0-9.\-:\[\]]/', '', (string) ($_SERVER['HTTP_HOST'] ?? 'amcyberworld.com'));
        $origin = ($secure ? 'https' : 'http') . '://' . $host;
        $telegramUrl = 'https://t.me/share/url?url=' . rawurlencode($origin) . '&text=' . rawurlencode($message);
    }
    json_response(['intakeReference' => $intakeReference, 'telegramUrl' => $telegramUrl], 201);
}

function handle_public_reviews(): never
{
    $database = database();
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
        $rows = $database->query("SELECT id, program_id AS programId, display_name AS displayName,
            rating, speed_rating AS speedRating, message, staff_reply AS staffReply,
            staff_reply_at AS staffReplyAt, created_at AS createdAt
            FROM reviews WHERE published = 1 ORDER BY created_at DESC LIMIT 50")->fetchAll();
        json_response(['reviews' => array_map('normalized_review', $rows)]);
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        json_response(['error' => 'Method not allowed.'], 405);
    }

    $body = request_json();
    $applicationId = strtoupper(trim((string) ($body['applicationId'] ?? '')));
    $displayName = trim((string) ($body['displayName'] ?? ''));
    $message = trim((string) ($body['message'] ?? ''));
    $rating = filter_var($body['rating'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 5]]);
    $speedRating = filter_var($body['speedRating'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 5]]);
    if (!preg_match('/^CIB-\d{4}-[A-F0-9]{20}$/', $applicationId)) {
        throw new InvalidArgumentException('Check your application ID.');
    }
    if (mb_strlen($displayName) < 2 || mb_strlen($displayName) > 60 || mb_strlen($message) < 30 || mb_strlen($message) > 800) {
        throw new InvalidArgumentException('Complete every review field.');
    }
    if ($rating === false || $speedRating === false || ($body['confirmed'] ?? false) !== true) {
        throw new InvalidArgumentException('Complete every review field.');
    }

    $statement = $database->prepare("SELECT program_id AS programId FROM applications WHERE application_id = ? AND status = 'accepted'");
    $statement->execute([$applicationId]);
    $application = $statement->fetch();
    if (!$application) {
        json_response(['error' => 'Accepted application ID not found.'], 404);
    }
    $createdAt = (int) floor(microtime(true) * 1000);
    $statement = $database->prepare("INSERT IGNORE INTO reviews
        (application_id, program_id, display_name, rating, speed_rating, message, published, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?)");
    $statement->execute([$applicationId, $application['programId'], $displayName, $rating, $speedRating, $message, $createdAt]);
    if ($statement->rowCount() !== 1) {
        json_response(['error' => 'A review has already been published for this application ID.'], 409);
    }
    json_response(['review' => [
        'programId' => $application['programId'],
        'displayName' => $displayName,
        'rating' => $rating,
        'speedRating' => $speedRating,
        'message' => $message,
        'staffReply' => null,
        'staffReplyAt' => null,
        'createdAt' => $createdAt,
    ]], 201);
}

function intake_reference(array $body): string
{
    $reference = strtoupper(trim((string) ($body['intakeReference'] ?? '')));
    if (!preg_match('/^INT-\d{4}-[A-F0-9]{14}$/', $reference)) {
        throw new InvalidArgumentException('Intake reference is invalid.');
    }
    return $reference;
}

function handle_agent_applications(): never
{
    require_agent();
    $database = database();
    $method = $_SERVER['REQUEST_METHOD'] ?? '';

    if ($method === 'GET') {
        $rows = $database->query("SELECT intake_id AS intakeReference,
            CASE WHEN status = 'accepted' THEN application_id ELSE NULL END AS applicationId,
            program_id AS programId, given_name AS givenName, family_name AS familyName,
            email, phone, nationality, residence_country AS residenceCountry,
            other_nationalities AS otherNationalities, family_size AS familySize,
            available_funds AS availableFunds, timeline, occupation,
            source_of_funds AS sourceOfFunds, compliance_answers AS complianceAnswers,
            proof_file_name AS proofFileName, status, created_at AS createdAt
            FROM applications WHERE status IN ('submitted', 'accepted')
            ORDER BY created_at DESC LIMIT 100")->fetchAll();
        json_response(['applications' => array_map('normalized_application', $rows)]);
    }

    $body = request_json();
    $reference = intake_reference($body);

    if ($method === 'POST') {
        $statement = $database->prepare('SELECT application_id AS applicationId, status FROM applications WHERE intake_id = ?');
        $statement->execute([$reference]);
        $application = $statement->fetch();
        if (!$application) {
            json_response(['error' => 'Intake was not found.'], 404);
        }
        if ($application['status'] === 'accepted') {
            json_response(['applicationId' => $application['applicationId'], 'alreadyAccepted' => true]);
        }
        $applicationId = create_application_id();
        $statement = $database->prepare("UPDATE applications SET application_id = ?, status = 'accepted' WHERE intake_id = ? AND status = 'submitted'");
        $statement->execute([$applicationId, $reference]);
        if ($statement->rowCount() !== 1) {
            json_response(['error' => 'This intake could not be accepted.'], 409);
        }
        json_response(['applicationId' => $applicationId], 201);
    }

    if ($method === 'PATCH') {
        $programId = required_array_text($body, 'programId', 32);
        if (!in_array($programId, ['antigua', 'dominica', 'grenada', 'st-kitts', 'st-lucia', 'turkiye'], true)) {
            throw new InvalidArgumentException('Program is invalid.');
        }
        $email = strtolower(required_array_text($body, 'email', 160));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Email is invalid.');
        }
        $familySize = filter_var($body['familySize'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 20]]);
        if ($familySize === false) {
            throw new InvalidArgumentException('Family size must be between 1 and 20.');
        }
        $fields = [
            'programId' => $programId,
            'givenName' => required_array_text($body, 'givenName', 80),
            'familyName' => required_array_text($body, 'familyName', 80),
            'email' => $email,
            'phone' => required_array_text($body, 'phone', 40),
            'nationality' => required_array_text($body, 'nationality', 100),
            'residenceCountry' => required_array_text($body, 'residenceCountry', 100),
            'otherNationalities' => mb_substr(trim((string) ($body['otherNationalities'] ?? '')), 0, 160),
            'familySize' => $familySize,
            'availableFunds' => required_array_text($body, 'availableFunds', 40),
            'timeline' => required_array_text($body, 'timeline', 40),
            'occupation' => required_array_text($body, 'occupation', 120),
            'sourceOfFunds' => required_array_text($body, 'sourceOfFunds', 120),
        ];

        $statement = $database->prepare('SELECT application_id AS applicationId FROM applications WHERE intake_id = ?');
        $statement->execute([$reference]);
        $application = $statement->fetch();
        if (!$application) {
            json_response(['error' => 'Intake was not found.'], 404);
        }
        $database->beginTransaction();
        try {
            $statement = $database->prepare('UPDATE applications SET program_id = ?, given_name = ?, family_name = ?, email = ?, phone = ?, nationality = ?, residence_country = ?, other_nationalities = ?, family_size = ?, available_funds = ?, timeline = ?, occupation = ?, source_of_funds = ? WHERE intake_id = ?');
            $statement->execute([
                $fields['programId'], $fields['givenName'], $fields['familyName'], $fields['email'],
                $fields['phone'], $fields['nationality'], $fields['residenceCountry'], $fields['otherNationalities'],
                $fields['familySize'], $fields['availableFunds'], $fields['timeline'], $fields['occupation'],
                $fields['sourceOfFunds'], $reference,
            ]);
            $statement = $database->prepare('UPDATE reviews SET program_id = ? WHERE application_id = ?');
            $statement->execute([$fields['programId'], $application['applicationId']]);
            $database->commit();
        } catch (Throwable $error) {
            $database->rollBack();
            throw $error;
        }
        json_response(['application' => array_merge(['intakeReference' => $reference], $fields)]);
    }

    if ($method === 'DELETE') {
        $statement = $database->prepare('SELECT proof_file_key AS proofFileKey FROM applications WHERE intake_id = ?');
        $statement->execute([$reference]);
        $application = $statement->fetch();
        if (!$application) {
            json_response(['error' => 'Intake was not found.'], 404);
        }
        $statement = $database->prepare('DELETE FROM applications WHERE intake_id = ?');
        $statement->execute([$reference]);
        if ($statement->rowCount() !== 1) {
            json_response(['error' => 'Intake was not deleted.'], 409);
        }
        @unlink(private_file_path($application['proofFileKey']));
        json_response(['deleted' => true]);
    }

    json_response(['error' => 'Method not allowed.'], 405);
}

function review_id(array $body): int
{
    $reviewId = filter_var($body['reviewId'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($reviewId === false) {
        throw new InvalidArgumentException('Review is invalid.');
    }
    return $reviewId;
}

function handle_agent_reviews(): never
{
    require_agent();
    $database = database();
    $method = $_SERVER['REQUEST_METHOD'] ?? '';

    if ($method === 'GET') {
        $rows = $database->query("SELECT id, application_id AS applicationId, program_id AS programId,
            display_name AS displayName, rating, speed_rating AS speedRating, message,
            staff_reply AS staffReply, staff_reply_at AS staffReplyAt, created_at AS createdAt
            FROM reviews WHERE published = 1 ORDER BY created_at DESC LIMIT 100")->fetchAll();
        json_response(['reviews' => array_map('normalized_review', $rows)]);
    }
    if (!in_array($method, ['PATCH', 'DELETE'], true)) {
        json_response(['error' => 'Method not allowed.'], 405);
    }

    $body = request_json();
    $reviewId = review_id($body);
    if ($method === 'DELETE') {
        $statement = $database->prepare('UPDATE reviews SET published = 0, staff_reply = NULL, staff_reply_at = NULL WHERE id = ? AND published = 1');
        $statement->execute([$reviewId]);
        if ($statement->rowCount() !== 1) {
            json_response(['error' => 'Review was not found.'], 404);
        }
        json_response(['deleted' => true]);
    }

    if (($body['action'] ?? '') === 'edit') {
        $displayName = trim((string) ($body['displayName'] ?? ''));
        $message = trim((string) ($body['message'] ?? ''));
        $rating = filter_var($body['rating'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 5]]);
        $speedRating = filter_var($body['speedRating'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 5]]);
        if (mb_strlen($displayName) < 2 || mb_strlen($displayName) > 60 || mb_strlen($message) < 30 || mb_strlen($message) > 800 || $rating === false || $speedRating === false) {
            throw new InvalidArgumentException('Check every review field.');
        }
        $statement = $database->prepare('UPDATE reviews SET display_name = ?, rating = ?, speed_rating = ?, message = ? WHERE id = ? AND published = 1');
        $statement->execute([$displayName, $rating, $speedRating, $message, $reviewId]);
        if ($statement->rowCount() !== 1) {
            json_response(['error' => 'Review was not found or unchanged.'], 404);
        }
        json_response(['review' => ['id' => $reviewId, 'displayName' => $displayName, 'rating' => $rating, 'speedRating' => $speedRating, 'message' => $message]]);
    }

    $reply = trim((string) ($body['reply'] ?? ''));
    if (mb_strlen($reply) > 1000) {
        throw new InvalidArgumentException('Reply must be 1,000 characters or fewer.');
    }
    $replyAt = $reply === '' ? null : (int) floor(microtime(true) * 1000);
    $statement = $database->prepare('UPDATE reviews SET staff_reply = ?, staff_reply_at = ? WHERE id = ? AND published = 1');
    $statement->execute([$reply === '' ? null : $reply, $replyAt, $reviewId]);
    if ($statement->rowCount() !== 1) {
        json_response(['error' => 'Review was not found or unchanged.'], 404);
    }
    json_response(['reviewId' => $reviewId, 'staffReply' => $reply === '' ? null : $reply, 'staffReplyAt' => $replyAt]);
}

function handle_agent_proof(): never
{
    require_agent();
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
        json_response(['error' => 'Method not allowed.'], 405);
    }
    $reference = strtoupper(trim((string) ($_GET['intakeReference'] ?? '')));
    if (!preg_match('/^INT-\d{4}-[A-F0-9]{14}$/', $reference)) {
        throw new InvalidArgumentException('Intake reference is invalid.');
    }
    $statement = database()->prepare('SELECT proof_file_key AS proofFileKey, proof_file_name AS proofFileName, proof_content_type AS proofContentType FROM applications WHERE intake_id = ?');
    $statement->execute([$reference]);
    $application = $statement->fetch();
    if (!$application) {
        json_response(['error' => 'Intake was not found.'], 404);
    }
    $file = private_file_path($application['proofFileKey']);
    if (!is_file($file)) {
        json_response(['error' => 'Proof-of-funds file was not found.'], 404);
    }
    $safeName = preg_replace('/[\r\n"\\\\]/', '_', basename((string) $application['proofFileName']));
    header('Content-Type: ' . $application['proofContentType']);
    header('Content-Disposition: attachment; filename="' . $safeName . '"');
    header('Content-Length: ' . filesize($file));
    header('Cache-Control: no-store, private');
    readfile($file);
    exit;
}

try {
    $route = trim((string) ($_GET['route'] ?? ''), '/');
    match ($route) {
        'applications' => handle_application_submission(),
        'reviews' => handle_public_reviews(),
        'agent/applications' => handle_agent_applications(),
        'agent/reviews' => handle_agent_reviews(),
        'agent/proof' => handle_agent_proof(),
        default => json_response(['error' => 'API route not found.'], 404),
    };
} catch (InvalidArgumentException $error) {
    json_response(['error' => $error->getMessage()], 400);
} catch (Throwable $error) {
    error_log('AMCYBERWORLD API error: ' . $error->getMessage());
    json_response(['error' => 'The website could not complete this request. Check the database configuration or try again.'], 500);
}
