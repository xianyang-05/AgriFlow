import urllib.request

try:
    response = urllib.request.urlopen('http://localhost:3000/Borang-Cadangan-v13092024.pdf')
    data = response.read()
    print("Downloaded size:", len(data))
    print("Starts with:", data[:20])
except Exception as e:
    print("Failed!", e)
