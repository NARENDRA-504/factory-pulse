"""Bounded Telugu/Hindi manufacturing vocabulary, not a general translation service.

Maps question topics only. Never changes machine identities, authorization or values.
"""
import unicodedata

TOPICS = {
 'machine': ('యంత్ర', 'మెషిన్', 'మిషన్', 'मशीन', 'यंत्र'),
 'temperature': ('ఉష్ణోగ్రత', 'టెంపరేచర్', 'వేడి', 'तापमान', 'गर्मी', 'गरम'),
 'vibration': ('వైబ్రేషన్', 'కంపన', 'कंपन', 'वाइब्रेशन'),
 'pressure': ('పీడన', 'ప్రెషర్', 'ఒత్తిడి', 'दबाव', 'प्रेशर'),
 'rpm spindle': ('ఆర్పీఎం', 'ఆర్‌పిఎం', 'స్పిండిల్', 'आरपीएम', 'स्पिंडल'),
 'production output': ('ఉత్పత్తి', 'ప్రొడక్షన్', 'उत्पादन', 'प्रोडक्शन'),
 'shift': ('షిఫ్ట్', 'पाली', 'शिफ्ट'),
 'target': ('లక్ష్య', 'టార్గెట్', 'लक्ष्य', 'टारगेट'),
 'scrap': ('తిరస్కరించిన', 'స్క్రాప్', 'खराब पुर्ज', 'स्क्रैप'),
 'downtime': ('డౌన్‌టైమ్', 'నిలిచిపోయ', 'ఆగిపోయ', 'डाउनटाइम', 'बंद समय', 'रुकावट'),
 'maintenance': ('నిర్వహణ', 'మరమ్మత', 'మెయింటెనెన్స్', 'रखरखाव', 'मरम्मत'),
 'warning incident': ('హెచ్చరిక', 'లోపం', 'సమస్య', 'चेतावनी', 'खराबी', 'दोष'),
 'critical': ('తీవ్రమైన', 'క్రిటికల్', 'गंभीर', 'क्रिटिकल'),
 'coolant': ('కూలెంట్', 'शीतलक', 'कूलेंट'),
 'voltage': ('వోల్టేజ్', 'वोल्टेज'),
 'motor power': ('మోటార్ పవర్', 'మోటారు శక్తి', 'मोटर पावर'),
 'current': ('కరెంట్', 'विद्युत धारा', 'करंट'),
 'torque': ('టార్క్', 'टॉर्क'),
 'SOP instructions': ('సూచన', 'ఏం చేయాలి', 'ఏమి చేయాలి', 'ఏం చెయ్యాలి', 'ఎస్‌ఓపీ', 'निर्देश', 'क्या करना चाहिए', 'क्या करूं', 'एसओपी'),
 'password credential secret': ('పాస్‌వర్డ్', 'పాస్వర్డ్', 'రహస్య', 'पासवर्ड', 'गुप्त कुंजी', 'गोपनीय'),
 'salary payroll': ('జీత', 'వేతన', 'వేతనం', 'वेतन', 'तनख्वाह'),
}


def retrieval_text(question):
    text=unicodedata.normalize('NFC', question)
    matches=[topic for topic,terms in TOPICS.items() if any(term in text for term in terms)]
    return text + ('\nManufacturing search terms: ' + ' '.join(matches) if matches else '')
