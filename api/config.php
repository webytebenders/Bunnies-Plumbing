<?php
/**
 * Email Configuration for Bunnies Plumbing
 * Update ADMIN_EMAIL to your real email address.
 */

// Admin email — receives all form notifications
define('ADMIN_EMAIL', 'bunniesplumbing408@gmail.com');
define('ADMIN_NAME', 'Bunnies Plumbing');

// From address used in emails (must be a valid domain email on Hostinger)
// Change this to your actual domain email once set up on Hostinger
define('FROM_EMAIL', 'noreply@bunniesplumbing.com');
define('FROM_NAME', 'Bunnies Plumbing & Trenchless Technology');

// Company info
define('COMPANY_NAME', 'Bunnies Plumbing & Trenchless Technology');
define('COMPANY_PHONE', '(408) 427-5318');
define('COMPANY_LOCATION', 'Morgan Hill, CA');
define('COMPANY_WEBSITE', 'https://bunniesplumbing.com');

// Service labels for display
$SERVICE_LABELS = [
    'trenchless'   => 'Trenchless Sewer Replacement',
    'sewer'        => 'Sewer Line Services',
    'water-main'   => 'Water Main Line Services',
    'drain'        => 'Drain Cleaning & Hydro Jetting',
    'crawl-space'  => 'Crawl Space Plumbing',
    'gas'          => 'Gas Line Services',
    'water-heater' => 'Water Heater Services',
    'general'      => 'General Plumbing',
    'emergency'    => '24/7 Emergency Plumbing',
    'other'        => 'Other',
];

$URGENCY_LABELS = [
    'routine'   => 'Routine — No rush',
    'soon'      => 'Soon — Within a few days',
    'emergency' => 'Emergency — ASAP',
];

$PROPERTY_LABELS = [
    'residential' => 'Residential',
    'commercial'  => 'Commercial',
];
