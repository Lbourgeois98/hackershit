document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('payment-form');
    
    form.addEventListener('submit', function(e) {
        const cardNum = document.getElementById('card_number').value.replace(/\s/g, '');
        const expiry = document.getElementById('expiry').value;
        const cvv = document.getElementById('cvv').value;
        
        // Basic card number validation (Luhn algorithm)
        if (!luhnCheck(cardNum)) {
            alert('Invalid card number');
            e.preventDefault();
            return;
        }
        
        // Expiry validation (future date)
        const [month, year] = expiry.split('/');
        const expDate = new Date(`20${year}`, month - 1);
        if (expDate < new Date()) {
            alert('Card expired');
            e.preventDefault();
            return;
        }
        
        // CVV length check
        if (!/^\d{3,4}$/.test(cvv)) {
            alert('Invalid CVV');
            e.preventDefault();
            return;
        }
    });
    
    // Luhn algorithm for card validation
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
