/**
 * useLocale — Global hook for localizing numbers, dates, and strings
 * containing digits into the currently active i18n language script.
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { numberFormatMap } from '../i18n';

// Month names per language (for date formatting)
const MONTH_NAMES_MAP = {
  en: ['', 'January','February','March','April','May','June','July','August','September','October','November','December'],
  kn: ['', 'ಜನವರಿ','ಫೆಬ್ರವರಿ','ಮಾರ್ಚ್','ಏಪ್ರಿಲ್','ಮೇ','ಜೂನ್','ಜುಲೈ','ಆಗಸ್ಟ್','ಸೆಪ್ಟೆಂಬರ್','ಅಕ್ಟೋಬರ್','ನವೆಂಬರ್','ಡಿಸೆಂಬರ್'],
  hi: ['', 'जनवरी','फ़रवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितम्बर','अक्टूबर','नवम्बर','दिसम्बर'],
  bn: ['', 'জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'],
  mr: ['', 'जानेवारी','फेब्रुवारी','मार्च','एप्रिल','मे','जून','जुलै','ऑगस्ट','सप्टेंबर','ऑक्टोबर','नोव्हेंबर','डिसेंबर'],
  te: ['', 'జనవరి','ఫిబ్రవరి','మార్చి','ఏప్రిల్','మే','జూన్','జులై','ఆగస్టు','సెప్టెంబర్','అక్టోబర్','నవంబర్','డిసెంబర్'],
};

const AM_PM_MAP = {
  en: { am: 'AM', pm: 'PM' },
  kn: { am: 'ಬೆಳಿಗ್ಗೆ', pm: 'ಸಂಜೆ' },
  hi: { am: 'सुबह', pm: 'शाम' },
  bn: { am: 'সকাল', pm: 'সন্ধ্যা' },
  mr: { am: 'सकाळ', pm: 'संध्याकाळ' },
  te: { am: 'ఉదయం', pm: 'సాయంత్రం' },
};

const useLocale = () => {
  const { i18n } = useTranslation();
  const lang = i18n.language?.substring(0, 2) || 'en';

  /** Convert any number or string-with-digits to localized script */
  const localizeNumber = useCallback((value) => {
    if (value === null || value === undefined) return '';
    const formatter = numberFormatMap[lang] || numberFormatMap.en;
    return formatter(value);
  }, [lang]);

  /** Format a date string/object into localized "DD Month YYYY, HH:MM:SS AM/PM" */
  const localizeDate = useCallback((dateInput, options = {}) => {
    if (!dateInput) return '--';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);

    const { dateOnly = false, timeOnly = false } = options;
    const formatter = numberFormatMap[lang] || numberFormatMap.en;
    const months = MONTH_NAMES_MAP[lang] || MONTH_NAMES_MAP.en;
    const ampm = AM_PM_MAP[lang] || AM_PM_MAP.en;

    const day = formatter(String(d.getDate()).padStart(2, '0'));
    const month = months[d.getMonth() + 1];
    const year = formatter(d.getFullYear());
    
    let hours = d.getHours();
    const period = hours >= 12 ? ampm.pm : ampm.am;
    hours = hours % 12 || 12;
    const hh = formatter(String(hours).padStart(2, '0'));
    const mm = formatter(String(d.getMinutes()).padStart(2, '0'));
    const ss = formatter(String(d.getSeconds()).padStart(2, '0'));

    if (timeOnly) return `${hh}:${mm}:${ss} ${period}`;
    if (dateOnly) return `${day} ${month} ${year}`;
    return `${day} ${month} ${year}, ${hh}:${mm}:${ss} ${period}`;
  }, [lang]);

  /** Localize a time string like "09:34" into native numerals */
  const localizeTime = useCallback((timeStr) => {
    if (!timeStr || timeStr === '--') return '--';
    const formatter = numberFormatMap[lang] || numberFormatMap.en;
    return formatter(timeStr);
  }, [lang]);

  /** Localize an entire string — replaces all digit characters */
  const localizeString = useCallback((str) => {
    if (!str) return '';
    const formatter = numberFormatMap[lang] || numberFormatMap.en;
    return formatter(str);
  }, [lang]);

  /** Get localized month names array */
  const getMonthNames = useCallback(() => {
    return MONTH_NAMES_MAP[lang] || MONTH_NAMES_MAP.en;
  }, [lang]);

  return { localizeNumber, localizeDate, localizeTime, localizeString, getMonthNames, lang };
};

export default useLocale;
