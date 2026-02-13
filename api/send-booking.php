<?php
/**
 * Booking / Contact Form Handler
 * Sends email to admin + confirmation to customer
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/config.php';

// Get form data
$name    = trim($_POST['name'] ?? '');
$phone   = trim($_POST['phone'] ?? '');
$email   = trim($_POST['email'] ?? '');
$service = trim($_POST['service'] ?? '');
$date    = trim($_POST['date'] ?? '');
$time    = trim($_POST['time'] ?? '');
$message = trim($_POST['message'] ?? '');

// Validate required fields
$errors = [];
if (strlen($name) < 2) {
    $errors[] = 'Name is required (minimum 2 characters)';
}
if (strlen(preg_replace('/\D/', '', $phone)) < 10) {
    $errors[] = 'Valid phone number is required';
}
if (empty($service)) {
    $errors[] = 'Service selection is required';
}
if (!empty($email) && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Invalid email address';
}

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => implode(', ', $errors)]);
    exit;
}

// Sanitize
$name    = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
$phone   = htmlspecialchars($phone, ENT_QUOTES, 'UTF-8');
$email   = htmlspecialchars($email, ENT_QUOTES, 'UTF-8');
$message = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');

// Resolve labels
$serviceName = $SERVICE_LABELS[$service] ?? ucfirst($service);
$timeLabels = [
    'morning'   => 'Morning (8am - 12pm)',
    'afternoon' => 'Afternoon (12pm - 5pm)',
    'evening'   => 'Evening (5pm - 9pm)',
    'asap'      => 'ASAP / Emergency',
];
$timeName = $timeLabels[$time] ?? 'Not specified';
$dateFormatted = !empty($date) ? date('l, F j, Y', strtotime($date)) : 'Not specified';
$timestamp = date('F j, Y \a\t g:i A');

// ============================================================
// EMAIL 1: Admin Notification
// ============================================================
$adminSubject = "New Booking Request — {$serviceName} — {$name}";
$adminBody = '
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

<!-- Header -->
<tr><td style="background:#0D0D0D;padding:24px 32px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:20px;">New Booking Request</h1>
    <p style="margin:8px 0 0;color:#D42B2B;font-size:14px;font-weight:bold;">' . $serviceName . '</p>
</td></tr>

<!-- Body -->
<tr><td style="padding:32px;">
    <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td style="padding:8px 0;font-size:13px;color:#888;width:140px;vertical-align:top;">Customer Name</td>
            <td style="padding:8px 0;font-size:15px;color:#333;font-weight:bold;">' . $name . '</td>
        </tr>
        <tr>
            <td style="padding:8px 0;font-size:13px;color:#888;vertical-align:top;">Phone</td>
            <td style="padding:8px 0;font-size:15px;color:#333;font-weight:bold;">
                <a href="tel:' . preg_replace('/\D/', '', $phone) . '" style="color:#D42B2B;text-decoration:none;">' . $phone . '</a>
            </td>
        </tr>
        <tr>
            <td style="padding:8px 0;font-size:13px;color:#888;vertical-align:top;">Email</td>
            <td style="padding:8px 0;font-size:15px;color:#333;">' . (!empty($email) ? '<a href="mailto:' . $email . '" style="color:#D42B2B;">' . $email . '</a>' : 'Not provided') . '</td>
        </tr>
        <tr>
            <td style="padding:8px 0;font-size:13px;color:#888;vertical-align:top;">Service</td>
            <td style="padding:8px 0;font-size:15px;color:#333;font-weight:bold;">' . $serviceName . '</td>
        </tr>
        <tr>
            <td style="padding:8px 0;font-size:13px;color:#888;vertical-align:top;">Preferred Date</td>
            <td style="padding:8px 0;font-size:15px;color:#333;">' . $dateFormatted . '</td>
        </tr>
        <tr>
            <td style="padding:8px 0;font-size:13px;color:#888;vertical-align:top;">Preferred Time</td>
            <td style="padding:8px 0;font-size:15px;color:#333;">' . $timeName . '</td>
        </tr>
    </table>

    ' . (!empty($message) ? '
    <div style="margin-top:20px;padding:16px;background:#f7f7f7;border-radius:6px;border-left:4px solid #D42B2B;">
        <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Customer Message</p>
        <p style="margin:0;font-size:14px;color:#333;line-height:1.6;">' . nl2br($message) . '</p>
    </div>' : '') . '

    <p style="margin:24px 0 0;font-size:12px;color:#999;">Received on ' . $timestamp . '</p>
</td></tr>

<!-- Footer -->
<tr><td style="background:#f7f7f7;padding:16px 32px;text-align:center;border-top:1px solid #eee;">
    <p style="margin:0;font-size:12px;color:#999;">' . COMPANY_NAME . ' &mdash; ' . COMPANY_PHONE . '</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>';

// ============================================================
// EMAIL 2: Customer Confirmation
// ============================================================
$customerSubject = "We received your booking request — " . COMPANY_NAME;
$customerBody = '
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

<!-- Header -->
<tr><td style="background:#0D0D0D;padding:32px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;">Thank You, ' . $name . '!</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:14px;">We received your service request</p>
</td></tr>

<!-- Body -->
<tr><td style="padding:32px;">
    <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 20px;">
        Thank you for reaching out to <strong>' . COMPANY_NAME . '</strong>. We have received your booking request and our team will get back to you shortly.
    </p>

    <div style="background:#f7f7f7;border-radius:8px;padding:24px;margin-bottom:24px;">
        <h2 style="margin:0 0 16px;font-size:16px;color:#0D0D0D;">Your Request Summary</h2>
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td style="padding:6px 0;font-size:13px;color:#888;width:120px;">Service</td>
                <td style="padding:6px 0;font-size:14px;color:#333;font-weight:bold;">' . $serviceName . '</td>
            </tr>
            <tr>
                <td style="padding:6px 0;font-size:13px;color:#888;">Preferred Date</td>
                <td style="padding:6px 0;font-size:14px;color:#333;">' . $dateFormatted . '</td>
            </tr>
            <tr>
                <td style="padding:6px 0;font-size:13px;color:#888;">Preferred Time</td>
                <td style="padding:6px 0;font-size:14px;color:#333;">' . $timeName . '</td>
            </tr>
        </table>
    </div>

    <div style="background:#FDEAEA;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-size:13px;color:#333;">Need immediate help? Call us now:</p>
        <a href="tel:+14084275318" style="font-size:22px;font-weight:bold;color:#D42B2B;text-decoration:none;">' . COMPANY_PHONE . '</a>
        <p style="margin:8px 0 0;font-size:12px;color:#888;">Available 24/7 for emergencies</p>
    </div>

    <p style="font-size:13px;color:#888;line-height:1.6;margin:0;">
        We typically respond within minutes during business hours. For emergencies, please call us directly at <strong>' . COMPANY_PHONE . '</strong>.
    </p>
</td></tr>

<!-- Footer -->
<tr><td style="background:#0D0D0D;padding:24px 32px;text-align:center;">
    <p style="margin:0 0 4px;font-size:14px;color:#ffffff;font-weight:bold;">' . COMPANY_NAME . '</p>
    <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.6);">' . COMPANY_LOCATION . ' &mdash; Serving the entire Bay Area</p>
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.6);">
        <a href="' . COMPANY_WEBSITE . '" style="color:#D42B2B;">' . COMPANY_WEBSITE . '</a>
    </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>';

// ============================================================
// SEND EMAILS
// ============================================================
$headers  = "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/html; charset=UTF-8\r\n";
$headers .= "From: " . FROM_NAME . " <" . FROM_EMAIL . ">\r\n";
$headers .= "Reply-To: {$name} <" . (!empty($email) ? $email : FROM_EMAIL) . ">\r\n";

$adminSent = mail(ADMIN_EMAIL, $adminSubject, $adminBody, $headers);

$customerSent = false;
if (!empty($email)) {
    $customerHeaders  = "MIME-Version: 1.0\r\n";
    $customerHeaders .= "Content-Type: text/html; charset=UTF-8\r\n";
    $customerHeaders .= "From: " . FROM_NAME . " <" . FROM_EMAIL . ">\r\n";
    $customerHeaders .= "Reply-To: " . FROM_NAME . " <" . FROM_EMAIL . ">\r\n";
    $customerSent = mail($email, $customerSubject, $customerBody, $customerHeaders);
}

if ($adminSent) {
    echo json_encode([
        'success' => true,
        'message' => 'Your request has been sent successfully!',
        'customer_notified' => $customerSent,
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to send email. Please call us directly at ' . COMPANY_PHONE,
    ]);
}
