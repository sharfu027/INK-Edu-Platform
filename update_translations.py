import json
import re

with open("frontend/src/i18n.js", "r", encoding="utf-8") as f:
    content = f.read()

en_keys = """
      "welcome": "Welcome",
      "auth_secure": "You are securely authenticated",
      "face_verified": "Face Verified",
      "full_name": "Full Name",
      "email": "Email",
      "phone": "Phone",
      "emp_id_dash": "Employee ID",
      "designation": "Designation",
      "joining_date": "Joining Date",
      "hours_day_dash": "Hours / Day",
      "weekly_off_dash": "Weekly Off",
      "member_since": "Member Since",
      "account_role": "Account Role",
      "role_user": "User",
      "screen_allow": "(Screen Sharing Allowed)",
      "screen_block": "(Screen Sharing Blocked)",
      "session_info": "Session & Location Info",
      "login_time_dash": "LOGIN TIME",
      "last_logout": "LAST LOGOUT TIME",
      "live_loc": "LIVE LOCATION",
      "login_loc": "LOGIN LOCATION (RECORDED)",
      "download_qr": "Download My QR Code",
      "update_face": "Update Face Data",
      "missing_face": "Missing Face Data",
      "setup_face": "Set Up Face Login Now",
      "password_only_msg": "Your account is currently using password-only authentication.",
      "security_setup": "Security Setup Needed"
"""

kn_keys = """
      "welcome": "ಸ್ವಾಗತ",
      "auth_secure": "ನೀವು ಸುರಕ್ಷಿತವಾಗಿ ದೃಢೀಕರಿಸಲ್ಪಟ್ಟಿದ್ದೀರಿ",
      "face_verified": "ಮುಖ ಪರಿಶೀಲಿಸಲಾಗಿದೆ",
      "full_name": "ಪೂರ್ಣ ಹೆಸರು",
      "email": "ಇಮೇಲ್",
      "phone": "ಫೋನ್",
      "emp_id_dash": "ಉದ್ಯೋಗಿ ಐಡಿ",
      "designation": "ಹುದ್ದೆ",
      "joining_date": "ಸೇರಿದ ದಿನಾಂಕ",
      "hours_day_dash": "ದಿನಕ್ಕೆ ಗಂಟೆಗಳು",
      "weekly_off_dash": "ವಾರದ ರಜೆ",
      "member_since": "ಸದಸ್ಯರಾಗಿದ್ದಾರೆ",
      "account_role": "ಖಾತೆ ಪಾತ್ರ",
      "role_user": "ಬಳಕೆದಾರ",
      "screen_allow": "(ಸ್ಕ್ರೀನ್ ಹಂಚಿಕೆಗೆ ಅನುಮತಿಸಲಾಗಿದೆ)",
      "screen_block": "(ಸ್ಕ್ರೀನ್ ಹಂಚಿಕೆಯನ್ನು ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ)",
      "session_info": "ಸೆಷನ್ ಮತ್ತು ಸ್ಥಳ ಮಾಹಿತಿ",
      "login_time_dash": "ಲಾಗಿನ್ ಸಮಯ",
      "last_logout": "ಕೊನೆಯ ಲಾಗ್‌ಔಟ್ ಸಮಯ",
      "live_loc": "ಲೈವ್ ಸ್ಥಳ",
      "login_loc": "ಲಾಗಿನ್ ಸ್ಥಳ (ದಾಖಲಿಸಲಾಗಿದೆ)",
      "download_qr": "ನನ್ನ ಕ್ಯೂಆರ್ ಕೋಡ್ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ",
      "update_face": "ಮುಖದ ಡೇಟಾವನ್ನು ನವೀಕರಿಸಿ",
      "missing_face": "ಮುಖದ ಡೇಟಾ ಕಾಣೆಯಾಗಿದೆ",
      "setup_face": "ಈಗ ಮುಖದ ಲಾಗಿನ್ ಹೊಂದಿಸಿ",
      "password_only_msg": "ನಿಮ್ಮ ಖಾತೆಯು ಪ್ರಸ್ತುತ ಪಾಸ್‌ವರ್ಡ್ ಮಾತ್ರ ದೃಢೀಕರಣವನ್ನು ಬಳಸುತ್ತಿದೆ.",
      "security_setup": "ಭದ್ರತಾ ಸೆಟಪ್ ಅಗತ್ಯವಿದೆ"
"""

hi_keys = """
      "welcome": "स्वागत है",
      "auth_secure": "आप सुरक्षित रूप से प्रमाणित हैं",
      "face_verified": "चेहरा सत्यापित",
      "full_name": "पूरा नाम",
      "email": "ईमेल",
      "phone": "फ़ोन",
      "emp_id_dash": "कर्मचारी आईडी",
      "designation": "पदनाम",
      "joining_date": "शामिल होने की तिथि",
      "hours_day_dash": "घंटे / दिन",
      "weekly_off_dash": "साप्ताहिक अवकाश",
      "member_since": "सदस्यता तिथि",
      "account_role": "खाता भूमिका",
      "role_user": "उपयोगकर्ता",
      "screen_allow": "(स्क्रीन साझाकरण अनुमत)",
      "screen_block": "(स्क्रीन साझाकरण अवरुद्ध)",
      "session_info": "सत्र और स्थान की जानकारी",
      "login_time_dash": "लॉगिन समय",
      "last_logout": "अंतिम लॉगआउट समय",
      "live_loc": "लाइव स्थान",
      "login_loc": "लॉगिन स्थान (दर्ज किया गया)",
      "download_qr": "मेरा क्यूआर कोड डाउनलोड करें",
      "update_face": "चेहरा डेटा अपडेट करें",
      "missing_face": "चेहरा डेटा अनुपलब्ध",
      "setup_face": "अभी फेस लॉगिन सेटअप करें",
      "password_only_msg": "आपका खाता वर्तमान में केवल पासवर्ड प्रमाणीकरण का उपयोग कर रहा है।",
      "security_setup": "सुरक्षा सेटअप आवश्यक"
"""

content = content.replace('"home_sign_in": "Sign In"\n    }', '"home_sign_in": "Sign In",\n' + en_keys + '\n    }')
content = content.replace('"home_sign_in": "ಸೈನ್ ಇನ್"\n    }', '"home_sign_in": "ಸೈನ್ ಇನ್",\n' + kn_keys + '\n    }')
content = content.replace('"home_sign_in": "साइन इन"\n    }', '"home_sign_in": "साइन इन",\n' + hi_keys + '\n    }')
content = content.replace('"home_sign_in": "সাইন ইন"\n    }', '"home_sign_in": "সাইন ইন",\n' + en_keys + '\n    }')
content = content.replace('"home_sign_in": "साइन इन"\n    }', '"home_sign_in": "साइन इन",\n' + en_keys + '\n    }') 
content = content.replace('"home_sign_in": "సైన్ ఇన్"\n    }', '"home_sign_in": "సైన్ ఇన్",\n' + en_keys + '\n    }') 

with open("frontend/src/i18n.js", "w", encoding="utf-8") as f:
    f.write(content)
