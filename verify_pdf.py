import urllib.request
import json

data = json.dumps({
    "fullName": "Ahmad bin Ali",
    "icNumber": "850212-10-5541",
    "contact": "012-3456789",
    "farmArea": "5",
    "location": "Selangor, Petaling Jaya"
}).encode('utf-8')

req = urllib.request.Request(
    'http://localhost:3000/api/generate-pdf',
    data=data,
    headers={'Content-Type': 'application/json'}
)

try:
    response = urllib.request.urlopen(req)
    pdf_data = response.read()
    
    with open("public/verify_output.pdf", "wb") as f:
        f.write(pdf_data)
    
    print(f"Downloaded PDF size: {len(pdf_data)} bytes")
    print(f"Starts with: {pdf_data[:10]}")
    print(f"Content-Type: {response.headers.get('Content-Type')}")
except Exception as e:
    print(f"Error: {e}")
