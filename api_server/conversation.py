"""Local conversation fallbacks, independent of operational data access."""
import re


def private_request(question):
    return bool(re.search(r'\b(password\w*|credential\w*|api[ -]?keys?|secrets?|payroll|salaries)\b', question, re.I))


def conversation_reply(question):
    text=question.lower().strip(' .!?')
    if private_request(question):
        return "I can’t reveal passwords, API keys or private personnel information. For account access, contact your administrator to reset your password."
    if re.fullmatch(r'(hi|hello|hey|good (morning|afternoon|evening))([ ,].*)?', text):
        return "Hello! How’s your day going? We can chat, or I can help you understand your machine readings and production."
    if 'how are you' in text:
        return "I’m here and ready to help! How are you doing today?"
    if text in {'thanks','thank you','thank you so much'}:
        return "You’re welcome! What else would you like to talk about?"
    if text in {'bye','goodbye','see you'}:
        return "See you! Have a good shift."
    if 'your name' in text or 'who are you' in text:
        return "I’m the FactoryPulse assistant. I can chat with you and help explain the factory information your account can access."
    return "I can help with that using the ‘Use Gemini’ option below. Without it, I can still chat briefly and answer questions using your authorized machine records."
