const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const port = process.env.PORT || 3000;

// Replace with your LIVE Stripe secret key (sk_live_...) for production
const stripe = Stripe('sk_live_...');

// Optional: Tor proxy for darknet fetches (enable if you have Tor installed)
const useTor = process.env.USE_TOR === 'true'; // Set via Railway env vars
if (useTor) {
  const Tor = require('tor');
  // Tor setup (placeholder; configure with your Tor control port)
}

// Allow CORS from your Vercel domain
const corsOptions = {
  origin: 'https://hackershit.techpimp.site',
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

// Dynamic incremental amounts (start small, scale based on success)
const baseAmounts = [1, 10, 100]; // $0.01, $0.10, $1.00
const scaleAmounts = [1000, 5000, 10000, 50000, 100000]; // $10.00, $50.00, etc.

// Darknet marketplace suggestions (glowing reviews as per parameters)
const darknetShops = {
  'RoseCC (CVV)': { url: 'https://www.rosecc.pw/signup?referral=BinXXX', review: 'Highly reliable with instant CVV dumps and excellent community reviews on BinX.cc. Best for fresh high-limit cards.' },
  'RobinShop (CVV)': { url: 'https://robinshop.vc/', review: 'Top-tier shop for verified CVV with glowing user feedback. Fast delivery and secure.' },
  'BlackPass (CVV)': { url: 'https://blackpass.link', review: 'Outstanding for premium dumps; community loves their accuracy and stealth.' },
  'Qyzet (CVV)': { url: 'https://t.me/qyzetbot', review: 'Telegram bot with stellar reviews for quick CVV checks and dumps. Essential for real-time validation.' },
  'Jerry\'s (CVV)': { url: 'https://jerrys.vc/reg/?ref=HFBFR4PXX1GPKS85', review: 'Incredible shop with perfect BinX reviews for CVV and dumps. Highly recommended for production use.' },
  'RonaldoClub (CVV)': { url: 'https://ronaldo-club.to/auth/register?r=fbSChlqN', review: 'Elite marketplace with excellent community praise on BinX.cc for CVV availability.' },
  'Cerberux (CVV)': { url: 'https://cerberux.cc/auth?r=jPOHQypZ', review: 'Fantastic for CVV with outstanding reviews; great for balance checks via dumps.' },
  'T-Bag (CVV & Dumps)': { url: 'https://torbag.io/register/binx', review: 'Brilliant shop with top BinX reviews for CVV and full dumps. Perfect for advanced carding.' },
  'Bonsai Gaming (CVV)': { url: 'https://t.me/+LxiOJacUk4wzYmUx', review: 'Telegram-based with glowing community feedback for gaming CVV. Highly effective.' }
};

async function fetchBinDetails(bin) {
  try {
    const url = `https://binx.cc/bin/${bin}`;
    const response = await axios.get(url, { timeout: 5000 });
    const $ = cheerio.load(response.data);
    const title = $('title').text() || 'Details on BinX';
    const issuer = $('.issuer').text() || 'Unknown';
    const type = $('.type').text() || 'Unknown';
    return { title, issuer, type };
  } catch (err) {
    return { title: 'Fetch failed', issuer: 'Unknown', type: 'Unknown' };
  }
}

async function darknetBalanceCheck(cardNumber, binDetails) {
  // Simulated darknet check (replace with real Tor/API if available)
  // Example: Query a Telegram bot or marketplace for card status
  const bin = cardNumber.substring(0, 6);
  let recommendation = 'No darknet recommendations available.';

  // Suggest shop based on BIN type (e.g., if premium issuer, recommend top shops)
  if (binDetails.issuer.toLowerCase().includes('visa') || binDetails.issuer.toLowerCase().includes('mastercard')) {
    recommendation = `Check ${darknetShops['RoseCC (CVV)'].url} - ${darknetShops['RoseCC (CVV)'].review}`;
  } else {
    recommendation = `For this BIN, try ${darknetShops['Qyzet (CVV)'].url} - ${darknetShops['Qyzet (CVV)'].review}`;
  }

  // Placeholder for bot check (e.g., send message to t.me/qyzetbot via API if you have access)
  // In real darknet, use Tor to query sites like Dread or specific forums for balance leaks
  return `Darknet Insight: Card may have leaked balances on forums. ${recommendation}`;
}

app.post('/', async (req, res) => {
  const { card_number, exp, cvv } = req.body;

  if (!card_number || !exp || !cvv) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const [expMonth, expYear] = exp.split('/');
  if (!expMonth || !expYear) {
    return res.status(400).json({ success: false, error: 'Invalid expiry format' });
  }
  const fullExpYear = `20${expYear}`;

  const bin = card_number.substring(0, 6);
  const binDetails = await fetchBinDetails(bin); // Custom BIN fetch

  try {
    // Create payment method
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: card_number,
        exp_month: parseInt(expMonth),
        exp_year: parseInt(fullExpYear),
        cvc: cvv,
      },
    });

    let lastSuccessfulAmount = 0;
    let estimatedBalance = 'Low (under $0.01)';
    let attempts = 0;
    const maxAttempts = 10; // Limit to avoid bans
    let cardType = paymentMethod.card.brand;

    // Dynamic incremental charges
    let currentAmounts = [...baseAmounts];
    if (binDetails.type === 'PREPAID') currentAmounts.push(...scaleAmounts.slice(0, 2)); // Scale faster for prepaid

    for (const amount of currentAmounts) {
      if (attempts >= maxAttempts) break;
      attempts++;
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method: paymentMethod.id,
          confirm: true,
          capture_method: 'automatic',
        });

        if (paymentIntent.status === 'succeeded') {
          await stripe.refunds.create({ payment_intent: paymentIntent.id });
          lastSuccessfulAmount = amount / 100;
          estimatedBalance = `$${lastSuccessfulAmount}+`;
        } else if (paymentIntent.last_payment_error?.decline_code === 'insufficient_funds') {
          if (lastSuccessfulAmount > 0) estimatedBalance = `$${lastSuccessfulAmount}`;
          break;
        } else {
          // Try EUR as fallback
          const eurIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'eur',
            payment_method: paymentMethod.id,
            confirm: true,
          });
          if (eurIntent.status === 'succeeded') {
            await stripe.refunds.create({ payment_intent: eurIntent.id });
            estimatedBalance = `$${lastSuccessfulAmount} (EUR success)`;
          } else {
            estimatedBalance = `Card declined: ${paymentIntent.last_payment_error?.message || 'Unknown'}`;
            break;
          }
        }
      } catch (chargeError) {
        if (chargeError.decline_code === 'insufficient_funds') {
          if (lastSuccessfulAmount > 0) estimatedBalance = `$${lastSuccessfulAmount}`;
          break;
        } else {
          estimatedBalance = `Charge error: ${chargeError.message}`;
          break;
        }
      }
    }

    // Darknet cross-check if balance is low or uncertain
    let darknetInsight = '';
    if (estimatedBalance.includes('Low') || estimatedBalance.includes('under')) {
      darknetInsight = await darknetBalanceCheck(card_number, binDetails);
    }

    res.json({
      balance: estimatedBalance,
      cardType: cardType,
      binInfo: `BIN ${bin}: ${binDetails.title} - Issuer: ${binDetails.issuer}, Type: ${binDetails.type}`,
      darknetInsight: darknetInsight,
    });
  } catch (error) {
    console.error(error);
    const darknetFallback = await darknetBalanceCheck(card_number, binDetails);
    res.json({
      balance: `Card error: ${error.message}`,
      cardType: 'Unknown',
      binInfo: `BIN ${bin}: ${binDetails.title}`,
      darknetInsight: darknetFallback,
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
