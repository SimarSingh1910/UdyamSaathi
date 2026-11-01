import type { Lang } from "./advisor";

/** UI copy in English and Hindi. Keep sentences short: owners read these on a phone. */
export const STRINGS = {
  appName: { en: "UdyamSaathi", hi: "उद्यमसाथी" },
  langToggle: { en: "हिंदी", hi: "English" },
  steps: {
    en: ["Advisor", "Quote", "KYC", "Done"],
    hi: ["सलाह", "कीमत", "KYC", "पूरा"],
  },

  // Advisor
  hello: {
    en: "Namaste! I'm your Accel Business advisor. Tell me about your business and I'll suggest the right bundle with one clear monthly price.",
    hi: "नमस्ते! मैं आपका Accel Business सलाहकार हूँ। अपने बिज़नेस के बारे में बताइए, मैं सही बंडल और एक साफ़ मासिक कीमत बताऊँगा।",
  },
  describePrompt: {
    en: "Describe your business in a line, or answer step by step.",
    hi: "एक लाइन में अपना बिज़नेस बताइए, या एक-एक सवाल का जवाब दीजिए।",
  },
  describePlaceholder: {
    en: "e.g. I have 2 bakery shops in Pune with 8 staff, need billing and CCTV",
    hi: "जैसे: पुणे में मेरी 2 बेकरी हैं, 8 लोग काम करते हैं, बिलिंग और कैमरा चाहिए",
  },
  send: { en: "Send", hi: "भेजें" },
  stepByStep: { en: "Answer step by step", hi: "एक-एक करके जवाब दें" },
  understood: { en: "Got it. A few more questions:", hi: "समझ गया। कुछ और सवाल:" },
  qType: { en: "What kind of business do you run?", hi: "आपका बिज़नेस किस तरह का है?" },
  qCity: { en: "Which city are you in?", hi: "आप किस शहर में हैं?" },
  otherCity: { en: "Other city", hi: "दूसरा शहर" },
  qEmployees: { en: "How many people work with you?", hi: "आपके साथ कितने लोग काम करते हैं?" },
  qSites: { en: "How many shops, branches or locations?", hi: "कितनी दुकानें, ब्रांच या जगहें हैं?" },
  qInternet: { en: "What internet do you use today?", hi: "अभी आप कौन सा इंटरनेट इस्तेमाल करते हैं?" },
  qNeeds: { en: "What would help your business? Pick all that apply.", hi: "आपके बिज़नेस के लिए क्या मददगार होगा? जितने चाहें चुनें।" },
  qGst: { en: "Is your business GST registered?", hi: "क्या आपका बिज़नेस GST में रजिस्टर्ड है?" },
  yes: { en: "Yes", hi: "हाँ" },
  no: { en: "No", hi: "नहीं" },
  done: { en: "Done", hi: "हो गया" },
  thinking: { en: "Putting your bundle together…", hi: "आपका बंडल तैयार कर रहा हूँ…" },
  yourBundle: { en: "Recommended for you", hi: "आपके लिए सुझाव" },
  notIncluded: { en: "Not included, and why", hi: "शामिल नहीं, और क्यों" },
  seePrice: { en: "See my price", hi: "मेरी कीमत देखें" },
  startOver: { en: "Start over", hi: "फिर से शुरू करें" },

  // Quote
  perMonth: { en: "/month", hi: "/महीना" },
  monthlyTotal: { en: "Monthly total", hi: "मासिक कुल" },
  inclGst: { en: "incl. 18% GST", hi: "18% GST सहित" },
  oneTime: { en: "One-time setup", hi: "एक बार का सेटअप" },
  savings: { en: "You save vs. buying separately", hi: "अलग-अलग खरीदने से बचत" },
  contract: { en: "Contract", hi: "कॉन्ट्रैक्ट" },
  months: { en: "months", hi: "महीने" },
  readyIn: { en: "Ready in about", hi: "लगभग इतने दिनों में चालू" },
  days: { en: "days", hi: "दिन" },
  essentials: { en: "Essentials", hi: "ज़रूरी" },
  addOns: { en: "Add-ons you can switch on or off", hi: "ऐड-ऑन, जिन्हें चालू या बंद कर सकते हैं" },
  moreOptions: { en: "More you can add", hi: "और जोड़ सकते हैं" },
  bundlePricing: {
    en: { single: "Single product price", bundle: "Bundle price (2–3 products)", full_bundle: "Best bundle price (4+ products)" },
    hi: { single: "एक प्रोडक्ट की कीमत", bundle: "बंडल कीमत (2–3 प्रोडक्ट)", full_bundle: "सबसे अच्छी बंडल कीमत (4+ प्रोडक्ट)" },
  },
  continueKyc: { en: "Continue to KYC", hi: "KYC पर आगे बढ़ें" },
  back: { en: "Back", hi: "वापस" },

  // KYC
  consentTitle: { en: "Before we check your documents", hi: "दस्तावेज़ जाँचने से पहले" },
  consentAgree: { en: "I agree, start KYC", hi: "मैं सहमत हूँ, KYC शुरू करें" },
  kycTitle: { en: "Smart KYC", hi: "स्मार्ट KYC" },
  kycIntro: {
    en: "Upload 4 documents. We read them on your phone and check them against GST and Udyam records in seconds.",
    hi: "4 दस्तावेज़ अपलोड करें। हम उन्हें आपके फ़ोन पर ही पढ़ते हैं और सेकंडों में GST और उद्यम रिकॉर्ड से मिलाते हैं।",
  },
  docGst: { en: "GST certificate", hi: "GST सर्टिफ़िकेट" },
  docUdyam: { en: "Udyam certificate", hi: "उद्यम सर्टिफ़िकेट" },
  docBill: { en: "Address proof (electricity bill, last 90 days)", hi: "पते का सबूत (बिजली बिल, पिछले 90 दिन)" },
  docId: { en: "Signatory ID", hi: "साइनेटरी ID" },
  upload: { en: "Upload photo", hi: "फ़ोटो अपलोड करें" },
  replace: { en: "Replace", hi: "बदलें" },
  reading: { en: "Reading…", hi: "पढ़ रहे हैं…" },
  read: { en: "Read", hi: "पढ़ लिया" },
  sample: { en: "Demo: load a sample applicant", hi: "डेमो: सैंपल आवेदक लोड करें" },
  verify: { en: "Check my documents", hi: "मेरे दस्तावेज़ जाँचें" },
  checking: { en: "Checking…", hi: "जाँच रहे हैं…" },
  kycApproved: { en: "All documents verified", hi: "सभी दस्तावेज़ सत्यापित" },
  kycNeedsAction: { en: "A few things need fixing", hi: "कुछ चीज़ें ठीक करनी हैं" },
  gstProductsRemoved: {
    en: "Your GSTIN can't be used, so products that need GST were removed from your bundle.",
    hi: "आपका GSTIN इस्तेमाल नहीं हो सकता, इसलिए GST वाले प्रोडक्ट बंडल से हटा दिए गए।",
  },
  placeOrder: { en: "Confirm & place order", hi: "पुष्टि करें और ऑर्डर दें" },
  callMe: { en: "Ask a local partner to help me", hi: "लोकल पार्टनर से मदद चाहिए" },
  callbackSent: {
    en: "Done. A partner near you will call within 4 working hours to help with your documents.",
    hi: "हो गया। आपके पास का पार्टनर 4 कामकाजी घंटों में कॉल करके दस्तावेज़ों में मदद करेगा।",
  },

  contactTitle: { en: "Who should we contact about installation?", hi: "इंस्टॉलेशन के लिए किससे संपर्क करें?" },
  contactName: { en: "Name", hi: "नाम" },
  mobile: { en: "Mobile number", hi: "मोबाइल नंबर" },
  invalidMobile: { en: "Enter a valid 10-digit mobile number", hi: "सही 10 अंकों का मोबाइल नंबर डालें" },
  contactUse: {
    en: "Used only for installation updates and support for this order.",
    hi: "सिर्फ़ इस ऑर्डर के इंस्टॉलेशन अपडेट और सपोर्ट के लिए।",
  },
  helpTitle: { en: "A partner near you will call to help", hi: "आपके पास का पार्टनर मदद के लिए कॉल करेगा" },
  requestHelp: { en: "Request a call", hi: "कॉल का अनुरोध करें" },

  // Order / tracker
  orderPlaced: { en: "Order placed!", hi: "ऑर्डर हो गया!" },
  orderId: { en: "Order ID", hi: "ऑर्डर ID" },
  trackOrder: { en: "Track my order", hi: "मेरा ऑर्डर ट्रैक करें" },
  trackerTitle: { en: "Your order", hi: "आपका ऑर्डर" },
  noOrder: { en: "We couldn't find this order on this phone.", hi: "यह ऑर्डर इस फ़ोन पर नहीं मिला।" },
  installSlot: { en: "Installation", hi: "इंस्टॉलेशन" },
  engineer: { en: "Engineer", hi: "इंजीनियर" },
  updates: { en: "Updates", hi: "अपडेट" },
  liveNote: { en: "Updates automatically as our team works on your order.", hi: "हमारी टीम के काम करते ही यह अपने आप अपडेट होता है।" },
  expected: { en: "Expected", hi: "अपेक्षित" },
  activatedOn: { en: "Fully active by", hi: "पूरी तरह चालू" },
  needHelp: { en: "Need help? One number for everything: 1800-000-0000", hi: "मदद चाहिए? सबके लिए एक नंबर: 1800-000-0000" },
} as const;

type Entry = { en: string; hi: string };

export function tr(key: { [K in keyof typeof STRINGS]: (typeof STRINGS)[K] extends Entry ? K : never }[keyof typeof STRINGS], lang: Lang): string {
  return (STRINGS[key] as Entry)[lang];
}

export const NEED_LABELS: Record<string, Entry> = {
  billing: { en: "Billing & UPI", hi: "बिलिंग और UPI" },
  whatsapp: { en: "WhatsApp for customers", hi: "ग्राहकों के लिए WhatsApp" },
  cctv: { en: "CCTV cameras", hi: "CCTV कैमरे" },
  email: { en: "Business email", hi: "बिज़नेस ईमेल" },
  security: { en: "Cyber security", hi: "साइबर सुरक्षा" },
  backup_internet: { en: "Backup internet", hi: "बैकअप इंटरनेट" },
  phone_line: { en: "Phone line / IVR", hi: "फ़ोन लाइन / IVR" },
  guest_wifi: { en: "Customer Wi-Fi", hi: "ग्राहकों के लिए Wi-Fi" },
  website: { en: "Website", hi: "वेबसाइट" },
  cloud_backup: { en: "Data backup", hi: "डेटा बैकअप" },
  machines: { en: "Machine monitoring", hi: "मशीन मॉनिटरिंग" },
  fleet: { en: "Vehicle tracking", hi: "गाड़ी ट्रैकिंग" },
};

export const INTERNET_LABELS: Record<string, Entry> = {
  "Mobile hotspot": { en: "Phone hotspot", hi: "फ़ोन हॉटस्पॉट" },
  "Home broadband": { en: "Home broadband", hi: "होम ब्रॉडबैंड" },
  "Business broadband": { en: "Business broadband", hi: "बिज़नेस ब्रॉडबैंड" },
  "Leased line": { en: "Leased line", hi: "लीज़्ड लाइन" },
  "Mixed per site": { en: "Different at each site", hi: "हर जगह अलग" },
  None: { en: "No internet", hi: "इंटरनेट नहीं" },
};

export const formatInr = (n: number) =>
  `₹${Math.round(n).toLocaleString("en-IN")}`;

export const BUSINESS_TYPE_HI: Record<string, string> = {
  "Kirana store": "किराना स्टोर", Pharmacy: "फ़ार्मेसी", Salon: "सैलून", Bakery: "बेकरी", "Sweet shop": "मिठाई की दुकान",
  Boutique: "बुटीक", "Hardware store": "हार्डवेयर स्टोर", "Mobile repair shop": "मोबाइल रिपेयर", Optician: "चश्मे की दुकान",
  "Stationery shop": "स्टेशनरी", "Dental clinic": "डेंटल क्लिनिक", "Physiotherapy clinic": "फ़िज़ियोथेरेपी क्लिनिक",
  "Diagnostic lab": "डायग्नोस्टिक लैब", "CA firm": "CA फ़र्म", "Law office": "वकील का ऑफ़िस", "Coaching centre": "कोचिंग सेंटर",
  "Architecture studio": "आर्किटेक्चर स्टूडियो", "Insurance agency": "बीमा एजेंसी", "Real estate agency": "प्रॉपर्टी एजेंसी",
  "Travel agency": "ट्रैवल एजेंसी", "Restaurant chain": "रेस्टोरेंट चेन", "Bakery chain": "बेकरी चेन", "Pharmacy chain": "फ़ार्मेसी चेन",
  "Apparel retail chain": "कपड़ों की चेन", "Electronics retail chain": "इलेक्ट्रॉनिक्स चेन", "Gym chain": "जिम चेन",
  "Pre-school chain": "प्री-स्कूल चेन", "Budget hotel group": "होटल ग्रुप", "Auto-parts unit": "ऑटो-पार्ट्स यूनिट",
  "Textile unit": "टेक्सटाइल यूनिट", "Food processing unit": "फ़ूड प्रोसेसिंग यूनिट", "Packaging unit": "पैकेजिंग यूनिट",
  "Plastic moulding unit": "प्लास्टिक मोल्डिंग यूनिट", "Printing press": "प्रिंटिंग प्रेस", "Furniture workshop": "फ़र्नीचर वर्कशॉप",
};

export const typeLabel = (t: string, lang: "en" | "hi") => (lang === "hi" ? BUSINESS_TYPE_HI[t] ?? t : t);
