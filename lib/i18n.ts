/**
 * UI copy, written by hand in English and Hindi. Other languages are translated
 * from the English text (see lib/translate.ts). Keep sentences short: owners read
 * these on a phone.
 */
export type Text = { en: string; hi: string };

export const STRINGS = {
  appName: { en: "UdyamSaathi", hi: "उद्यमसाथी" },
  language: { en: "Language", hi: "भाषा" },
  chooseLanguage: { en: "Choose your language", hi: "अपनी भाषा चुनें" },
  translating: { en: "Translating…", hi: "अनुवाद हो रहा है…" },
  machineTranslated: {
    en: "This language is machine-translated and may contain mistakes.",
    hi: "यह भाषा मशीन से अनुवादित है, इसमें गलतियाँ हो सकती हैं।",
  },
  stepAdvisor: { en: "Advisor", hi: "सलाह" },
  stepQuote: { en: "Quote", hi: "कीमत" },
  stepKyc: { en: "KYC", hi: "KYC" },
  stepDone: { en: "Done", hi: "पूरा" },
  startNow: { en: "Start now", hi: "अभी शुरू करें" },
  heroTitle: { en: "Get your business online in one sitting", hi: "एक ही बार में अपना बिज़नेस ऑनलाइन करें" },
  heroBody: {
    en: "Internet, business SIMs, WhatsApp, cloud email, security and CCTV: one bundle, one bill, one support number.",
    hi: "इंटरनेट, बिज़नेस SIM, WhatsApp, क्लाउड ईमेल, सुरक्षा और CCTV: एक बंडल, एक बिल, एक सपोर्ट नंबर।",
  },
  landing1Title: { en: "Tell us about your business", hi: "अपने बिज़नेस के बारे में बताइए" },
  landing1Body: {
    en: "Answer a few questions in your language. Our advisor recommends a bundle and explains why.",
    hi: "अपनी भाषा में कुछ सवालों के जवाब दें। हमारा सलाहकार बंडल सुझाएगा और वजह भी बताएगा।",
  },
  landing2Title: { en: "See one clear monthly price", hi: "एक साफ़ मासिक कीमत देखें" },
  landing2Body: {
    en: "Toggle add-ons on or off and watch the price update. No product codes, no hidden fees.",
    hi: "ऐड-ऑन चालू या बंद करें और कीमत तुरंत बदलती देखें। कोई प्रोडक्ट कोड नहीं, कोई छिपा शुल्क नहीं।",
  },
  landing3Title: { en: "Finish KYC in minutes", hi: "मिनटों में KYC पूरा करें" },
  landing3Body: {
    en: "We read your documents on your phone and check them against GST and Udyam records instantly.",
    hi: "हम आपके दस्तावेज़ आपके फ़ोन पर ही पढ़ते हैं और तुरंत GST और उद्यम रिकॉर्ड से मिलाते हैं।",
  },
  landing4Title: { en: "Track your order", hi: "अपना ऑर्डर ट्रैक करें" },
  landing4Body: {
    en: "Check installation and activation status any time, without calling support.",
    hi: "सपोर्ट को कॉल किए बिना, कभी भी इंस्टॉलेशन और चालू होने की स्थिति देखें।",
  },
  languagesCount: { en: "Available in English and 22 Indian languages", hi: "अंग्रेज़ी और 22 भारतीय भाषाओं में उपलब्ध" },

  // Advisor
  hello: {
    en: "Namaste! I'm your Accel Business advisor. Tell me about your business in your own words, ask me anything, or tap the options below. I'll suggest the right bundle with one clear monthly price.",
    hi: "नमस्ते! मैं आपका Accel Business सलाहकार हूँ। अपने बिज़नेस के बारे में अपने शब्दों में बताइए, कुछ भी पूछिए, या नीचे दिए विकल्प चुनिए। मैं सही बंडल और एक साफ़ मासिक कीमत बताऊँगा।",
  },
  chatPlaceholder: { en: "Type or say anything…", hi: "कुछ भी लिखें या बोलें…" },
  talkToPerson: { en: "Prefer to talk to a person?", hi: "किसी व्यक्ति से बात करना चाहते हैं?" },
  describePrompt: {
    en: "Describe your business in a line, or answer step by step.",
    hi: "एक लाइन में अपना बिज़नेस बताइए, या एक-एक सवाल का जवाब दीजिए।",
  },
  describePlaceholder: {
    en: "e.g. I have 2 bakery shops in Pune with 8 staff, need billing and CCTV",
    hi: "जैसे: पुणे में मेरी 2 बेकरी हैं, 8 लोग काम करते हैं, बिलिंग और कैमरा चाहिए",
  },
  send: { en: "Send", hi: "भेजें" },
  micStart: { en: "Speak", hi: "बोलें" },
  micListening: { en: "Listening… tap to stop", hi: "सुन रहा हूँ… रोकने के लिए टैप करें" },
  micTranscribing: { en: "Understanding…", hi: "समझ रहा हूँ…" },
  micError: { en: "Couldn't hear that. Try again or type.", hi: "सुनाई नहीं दिया। फिर से बोलें या टाइप करें।" },
  micDenied: { en: "Allow microphone access to speak.", hi: "बोलने के लिए माइक्रोफ़ोन की अनुमति दें।" },
  answerPlaceholder: { en: "Type or say your answer", hi: "अपना जवाब टाइप करें या बोलें" },
  notUnderstood: {
    en: "Sorry, I didn't catch that. Tap an option above or try again.",
    hi: "माफ़ कीजिए, समझ नहीं आया। ऊपर कोई विकल्प चुनें या फिर से कोशिश करें।",
  },
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
  priceSingle: { en: "Single product price", hi: "एक प्रोडक्ट की कीमत" },
  priceBundle: { en: "Bundle price (2–3 products)", hi: "बंडल कीमत (2–3 प्रोडक्ट)" },
  priceFullBundle: { en: "Best bundle price (4+ products)", hi: "सबसे अच्छी बंडल कीमत (4+ प्रोडक्ट)" },
  each: { en: "each", hi: "प्रति यूनिट" },
  continueKyc: { en: "Continue to KYC", hi: "KYC पर आगे बढ़ें" },
  back: { en: "Back", hi: "वापस" },

  // KYC
  consentTitle: { en: "Before we check your documents", hi: "दस्तावेज़ जाँचने से पहले" },
  consentAgree: { en: "I agree, start KYC", hi: "मैं सहमत हूँ, KYC शुरू करें" },
  consentWhyLabel: { en: "Why:", hi: "क्यों:" },
  consentWhy: {
    en: "only to complete your KYC and activate your connection, as telecom rules require.",
    hi: "सिर्फ़ आपका KYC पूरा करने और कनेक्शन चालू करने के लिए, जैसा टेलीकॉम नियमों में ज़रूरी है।",
  },
  consentWhatLabel: { en: "What:", hi: "क्या:" },
  consentWhat: {
    en: "your GST and Udyam certificates, an address proof and the signatory's ID. Nothing else.",
    hi: "GST और उद्यम सर्टिफ़िकेट, पते का सबूत और साइन करने वाले की ID। इससे ज़्यादा कुछ नहीं।",
  },
  consentHowLabel: { en: "How:", hi: "कैसे:" },
  consentHow: {
    en: "photos are read on your phone. Only the extracted text is sent for checks, never the image.",
    hi: "फ़ोटो आपके फ़ोन पर ही पढ़ी जाती है। सिर्फ़ पढ़ा गया टेक्स्ट जाँच के लिए भेजा जाता है, फ़ोटो नहीं।",
  },
  consentRetentionLabel: { en: "How long:", hi: "कब तक:" },
  consentRetention: {
    en: "the text is discarded right after the check. Only the details your order needs are kept, for the period the law requires.",
    hi: "जाँच के बाद टेक्स्ट तुरंत हटा दिया जाता है। ऑर्डर के लिए सिर्फ़ ज़रूरी विवरण, कानूनन तय समय तक रखे जाते हैं।",
  },
  consentRightsLabel: { en: "Your rights:", hi: "आपके अधिकार:" },
  consentRights: {
    en: "withdraw consent any time, see or correct your data. Grievance officer: grievance@accel.example",
    hi: "आप सहमति कभी भी वापस ले सकते हैं, अपना डेटा देख या सुधार सकते हैं। शिकायत: grievance@accel.example",
  },
  consentMarketing: {
    en: "(Optional) Tell me about new offers on WhatsApp.",
    hi: "(वैकल्पिक) मुझे नए ऑफ़र के बारे में WhatsApp पर बताएं।",
  },
  ocrFailed: { en: "Could not read this photo", hi: "यह फ़ोटो पढ़ी नहीं जा सकी" },
  wrongDocument: { en: "This looks like a different document. Upload the right one here.", hi: "यह कोई दूसरा दस्तावेज़ लगता है। यहाँ सही दस्तावेज़ अपलोड करें।" },
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
  verifyHow: { en: "How would you like to confirm this number is yours?", hi: "आप कैसे पक्का करना चाहेंगे कि यह नंबर आपका है?" },
  verifySms: { en: "Code by SMS", hi: "SMS से कोड" },
  comingSoon: { en: "coming soon", hi: "जल्द आ रहा है" },
  verifyVoice: { en: "Code by phone call", hi: "फ़ोन कॉल पर कोड" },
  verifyWhatsapp: { en: "Code on WhatsApp", hi: "WhatsApp पर कोड" },
  codeSentSms: {
    en: "We sent a 6-digit code by SMS (if the SMS can't reach you, a call will read it out) to",
    hi: "हमने SMS से 6 अंकों का कोड भेजा है (SMS न पहुँचे तो एक कॉल कोड बोलकर बताएगी), इस नंबर पर:",
  },
  codeSentVoice: {
    en: "You'll get a call in a moment that reads out a 6-digit code, on",
    hi: "थोड़ी देर में एक कॉल आएगी जो 6 अंकों का कोड बोलेगी, इस नंबर पर:",
  },
  verifyMissedCall: { en: "Give a missed call", hi: "मिस्ड कॉल दें" },
  codeSentTo: { en: "We sent a 6-digit code on WhatsApp to", hi: "हमने WhatsApp पर 6 अंकों का कोड भेजा है:" },
  enterCode: { en: "Enter the code", hi: "कोड डालें" },
  verifyButton: { en: "Verify", hi: "सत्यापित करें" },
  giveMissedCall: { en: "From that phone, give a missed call to", hi: "उसी फ़ोन से इस नंबर पर मिस्ड कॉल दें:" },
  missedCallFree: {
    en: "The call disconnects by itself and costs nothing. This page moves on as soon as it comes through.",
    hi: "कॉल अपने आप कट जाएगी और कोई पैसा नहीं लगेगा। कॉल आते ही यह पेज आगे बढ़ जाएगा।",
  },
  waitingForCall: { en: "Waiting for your call…", hi: "आपकी कॉल का इंतज़ार…" },
  demoCode: { en: "Demo mode, no message was sent. The code is", hi: "डेमो मोड, कोई मैसेज नहीं गया। कोड है" },
  simulateCall: { en: "Demo: simulate the missed call", hi: "डेमो: मिस्ड कॉल सिम्युलेट करें" },
  changeNumber: { en: "Change number", hi: "नंबर बदलें" },
  otherMethod: { en: "Try another way", hi: "दूसरा तरीका आज़माएं" },
  wrongCode: { en: "That code doesn't match. Please check and try again.", hi: "कोड मेल नहीं खाया। जाँचकर फिर से डालें।" },
  checkExpired: { en: "This check has expired. Please start again.", hi: "समय खत्म हो गया। कृपया फिर से शुरू करें।" },
  tooManyTries: { en: "Too many tries. Please start again.", hi: "बहुत बार कोशिश हुई। कृपया फिर से शुरू करें।" },
  tooManyChecks: {
    en: "Too many checks for this number. Please wait 10 minutes.",
    hi: "इस नंबर के लिए बहुत बार कोशिश हुई। कृपया 10 मिनट रुकें।",
  },
  codeSendFailed: {
    en: "We couldn't send the code to this number. Please try another way.",
    hi: "इस नंबर पर कोड नहीं भेज पाए। कृपया दूसरा तरीका आज़माएं।",
  },
  verifyOff: { en: "Phone verification isn't available right now.", hi: "फ़ोन सत्यापन अभी उपलब्ध नहीं है।" },
  helpTitle: { en: "A partner near you will call to help", hi: "आपके पास का पार्टनर मदद के लिए कॉल करेगा" },
  requestHelp: { en: "Request a call", hi: "कॉल का अनुरोध करें" },

  // Order / tracker
  orderPlaced: { en: "Order placed!", hi: "ऑर्डर हो गया!" },
  somethingWrong: { en: "Something went wrong. Please try again.", hi: "कुछ गड़बड़ हुई। कृपया फिर से कोशिश करें।" },
  aiBadge: { en: "AI", hi: "AI" },
  advisorBadge: { en: "Advisor", hi: "सलाहकार" },
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
  // In-app assistant
  assistantTitle: { en: "UdyamSaathi help", hi: "UdyamSaathi मदद" },
  assistantOpen: { en: "Ask for help", hi: "मदद माँगें" },
  assistantHello: {
    en: "Hi! I know my way around this app. Ask me where to change something, about your price or documents, or to get a partner to call you.",
    hi: "नमस्ते! मैं इस ऐप का हर हिस्सा जानता हूँ। पूछिए कि कुछ कहाँ बदलें, अपनी कीमत या दस्तावेज़ों के बारे में, या पार्टनर से कॉल करवाने के लिए।",
  },
  assistantPlaceholder: { en: "Ask anything about the app…", hi: "ऐप के बारे में कुछ भी पूछें…" },
  close: { en: "Close", hi: "बंद करें" },
  listen: { en: "Listen", hi: "सुनें" },
  stopSpeaking: { en: "Stop", hi: "रोकें" },
  noVoice: { en: "No voice for this language on this device", hi: "इस डिवाइस पर इस भाषा की आवाज़ नहीं है" },
  actLanguage: { en: "Change language", hi: "भाषा बदलें" },
  actBundle: { en: "Show my bundle", hi: "मेरा बंडल दिखाएँ" },
  actQuote: { en: "Open my quote", hi: "मेरी कीमत खोलें" },
  actKyc: { en: "Go to KYC", hi: "KYC पर जाएँ" },
  actTalk: { en: "Request a call", hi: "कॉल का अनुरोध करें" },
  sugWhy: { en: "Why these products?", hi: "ये प्रोडक्ट क्यों?" },
  sugChangeAnswers: { en: "How do I change my answers?", hi: "अपने जवाब कैसे बदलूँ?" },
  sugRemove: { en: "How do I remove an add-on?", hi: "ऐड-ऑन कैसे हटाऊँ?" },
  sugSetup: { en: "What will I pay in the first month?", hi: "पहले महीने में कितना देना होगा?" },
  sugDocs: { en: "Which documents do I need?", hi: "कौन से दस्तावेज़ चाहिए?" },
  sugFailed: { en: "A document failed. What now?", hi: "कोई दस्तावेज़ फ़ेल हुआ, अब क्या करूँ?" },
  sugNumber: { en: "Why do you need my number?", hi: "मेरा नंबर क्यों चाहिए?" },
  sugWhen: { en: "When will it be installed?", hi: "इंस्टॉलेशन कब होगा?" },
  sugLanguage: { en: "How do I change the language?", hi: "भाषा कैसे बदलूँ?" },
} as const;

type Entry = Text;
export type StringKey = keyof typeof STRINGS;

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
  "Other shop or service": "दूसरी दुकान या सेवा", "Other office": "दूसरा ऑफ़िस", "Other chain business": "दूसरा चेन बिज़नेस",
  "Other manufacturing unit": "दूसरी मैन्युफैक्चरिंग यूनिट",
};

/** Business type as a translatable Text (the English name is the key everywhere else). */
export const typeText = (t: string): Text => ({ en: t, hi: BUSINESS_TYPE_HI[t] ?? t });

export const CITY_HI: Record<string, string> = {
  Delhi: "दिल्ली", Mumbai: "मुंबई", Bengaluru: "बेंगलुरु", Hyderabad: "हैदराबाद", Chennai: "चेन्नई", Pune: "पुणे",
  Kolkata: "कोलकाता", Ahmedabad: "अहमदाबाद", Vadodara: "वडोदरा", Kochi: "कोच्चि", Ludhiana: "लुधियाना", Indore: "इंदौर",
  Nagpur: "नागपुर", Lucknow: "लखनऊ", Bhopal: "भोपाल", Jaipur: "जयपुर", Mysuru: "मैसूरु", Coimbatore: "कोयंबटूर",
  Nashik: "नासिक", Visakhapatnam: "विशाखापत्तनम", Patna: "पटना", Surat: "सूरत",
};

/** City name as a translatable Text (stored in English everywhere else). */
export const cityText = (c: string): Text => ({ en: c, hi: CITY_HI[c] ?? c });

export const SEGMENT_GROUP_LABEL: Record<"micro" | "prof" | "multi" | "mfg", Text> = {
  micro: { en: "Shop or service", hi: "दुकान या सेवा" },
  prof: { en: "Office or clinic", hi: "ऑफ़िस या क्लिनिक" },
  multi: { en: "Chain with many outlets", hi: "कई आउटलेट वाली चेन" },
  mfg: { en: "Factory or workshop", hi: "फ़ैक्ट्री या वर्कशॉप" },
};
