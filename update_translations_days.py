import json
import re

with open("frontend/src/i18n.js", "r", encoding="utf-8") as f:
    content = f.read()

en_keys = """
      "hours_suffix": "hours",
      "day_sunday": "Sunday",
      "day_monday": "Monday",
      "day_tuesday": "Tuesday",
      "day_wednesday": "Wednesday",
      "day_thursday": "Thursday",
      "day_friday": "Friday",
      "day_saturday": "Saturday",
"""

kn_keys = """
      "hours_suffix": "ಗಂಟೆಗಳು",
      "day_sunday": "ಭಾನುವಾರ",
      "day_monday": "ಸೋಮವಾರ",
      "day_tuesday": "ಮಂಗಳವಾರ",
      "day_wednesday": "ಬುಧವಾರ",
      "day_thursday": "ಗುರುವಾರ",
      "day_friday": "ಶುಕ್ರವಾರ",
      "day_saturday": "ಶನಿವಾರ",
"""

hi_keys = """
      "hours_suffix": "घंटे",
      "day_sunday": "रविवार",
      "day_monday": "सोमवार",
      "day_tuesday": "मंगलवार",
      "day_wednesday": "बुधवार",
      "day_thursday": "गुरुवार",
      "day_friday": "शुक्रवार",
      "day_saturday": "शनिवार",
"""

content = content.replace('"security_setup": "Security Setup Needed"\n', '"security_setup": "Security Setup Needed",\n' + en_keys)
content = content.replace('"security_setup": "ಭದ್ರತಾ ಸೆಟಪ್ ಅಗತ್ಯವಿದೆ"\n', '"security_setup": "ಭದ್ರತಾ ಸೆಟಪ್ ಅಗತ್ಯವಿದೆ",\n' + kn_keys)
content = content.replace('"security_setup": "सुरक्षा सेटअप आवश्यक"\n', '"security_setup": "सुरक्षा सेटअप आवश्यक",\n' + hi_keys)

with open("frontend/src/i18n.js", "w", encoding="utf-8") as f:
    f.write(content)
