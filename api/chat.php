<?php
/**
 * Chat API Endpoint — Bunnies Plumbing
 * Accepts POST with JSON { "message": "...", "history": [...] }
 * Returns JSON { "success": true, "message": "..." }
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

require_once __DIR__ . '/chat-config.php';

$FALLBACK_MESSAGE = 'I\'m having trouble connecting right now. Please call us at (408) 427-5318 and we\'ll be happy to help you directly!';

// --- Load API key from .env ---
function loadEnvKey() {
    $envPath = __DIR__ . '/../.env';
    if (!file_exists($envPath)) {
        return null;
    }
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (strpos($line, 'OPENAI_API_KEY=') === 0) {
            return trim(substr($line, strlen('OPENAI_API_KEY=')));
        }
    }
    return null;
}

// --- Session-based rate limiting ---
session_start();

$now = time();
if (!isset($_SESSION['chat_requests'])) {
    $_SESSION['chat_requests'] = [];
}

// Remove requests older than 1 hour
$_SESSION['chat_requests'] = array_filter($_SESSION['chat_requests'], function ($ts) use ($now) {
    return ($now - $ts) < 3600;
});

if (count($_SESSION['chat_requests']) >= CHAT_RATE_LIMIT) {
    echo json_encode([
        'success' => false,
        'message' => 'You\'ve sent a lot of messages! For faster help, please call us at (408) 427-5318.'
    ]);
    exit;
}

$_SESSION['chat_requests'][] = $now;

// --- Parse request body ---
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data || !isset($data['message'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid request.']);
    exit;
}

$userMessage = trim($data['message']);
$history = isset($data['history']) && is_array($data['history']) ? $data['history'] : [];

// Validate message length
if (strlen($userMessage) < 1 || strlen($userMessage) > 1000) {
    echo json_encode(['success' => false, 'message' => 'Message must be between 1 and 1000 characters.']);
    exit;
}

// --- Build messages array for OpenAI ---
$messages = [
    ['role' => 'system', 'content' => CHAT_SYSTEM_PROMPT]
];

// Add conversation history (limit to last N turns)
$maxHistory = CHAT_MAX_HISTORY * 2; // Each turn = user + assistant = 2 messages
$historySlice = array_slice($history, -$maxHistory);

foreach ($historySlice as $msg) {
    if (isset($msg['role']) && isset($msg['content'])) {
        $role = $msg['role'];
        if ($role === 'user' || $role === 'assistant') {
            $messages[] = [
                'role' => $role,
                'content' => substr(trim($msg['content']), 0, 1000)
            ];
        }
    }
}

// Add current user message
$messages[] = ['role' => 'user', 'content' => $userMessage];

// --- Call OpenAI API ---
$apiKey = loadEnvKey();
if (!$apiKey) {
    echo json_encode(['success' => false, 'message' => $FALLBACK_MESSAGE]);
    exit;
}

$payload = json_encode([
    'model' => 'gpt-4o-mini',
    'messages' => $messages,
    'max_tokens' => 500,
    'temperature' => 0.7,
]);

$ch = curl_init('https://api.openai.com/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey,
    ],
    CURLOPT_TIMEOUT => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

// Handle errors
if ($curlError || $httpCode !== 200) {
    echo json_encode(['success' => false, 'message' => $FALLBACK_MESSAGE]);
    exit;
}

$result = json_decode($response, true);

if (!$result || !isset($result['choices'][0]['message']['content'])) {
    echo json_encode(['success' => false, 'message' => $FALLBACK_MESSAGE]);
    exit;
}

$aiMessage = trim($result['choices'][0]['message']['content']);

echo json_encode(['success' => true, 'message' => $aiMessage]);
