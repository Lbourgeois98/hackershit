document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('payment-form');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const cardNum = document.getElementById('card_number').value.replace(/\s/g, '');
        const expiry = document.getElementById('expiry').value;
        const cvv = document.getElementById('cvv').value;
        const name = document.getElementById('name').value;
        const billing = document.getElementById('billing_address').value;
        
        // Validation (same as before)
        if (!luhnCheck(cardNum)) {
            alert('Invalid card number');
            return;
        }
        const [month, year] = expiry.split('/');
        const expDate = new Date(`20${year}`, month - 1);
        if (expDate < new Date()) {
            alert('Card expired');
            return;
        }
        if (!/^\d{3,4}$/.test(cvv)) {
            alert('Invalid CVV');
            return;
        }
        
        // Submit via fetch
        const data = { card_number: cardNum, expiry, cvv, name, billing_address: billing };
        const response = await fetch('/capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.redirected) {
            window.location.href = response.url;
        } else {
            alert('Error processing payment');
        }
    });
    
    function luhnCheck(val) {
        let sum = 0;
        for (let i = val.length - 1; i >= 0; i--) {
            let digit = parseInt(val[i]);
            if ((val.length - i) % 2 === 0) digit *= 2;
            if (digit > 9) digit -= 9;
            sum += digit;
        }
        return sum % 10 === 0;
    }
});
