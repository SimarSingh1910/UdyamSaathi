import type { Text } from "../i18n";

/**
 * WhatsApp copy, by hand in English and Hindi like the web app (other languages are
 * translated from the English). {name} placeholders are filled after translation.
 * Button titles must stay within 20 characters, list rows within 24.
 */
export const WA = {
  welcome: {
    en: "Namaste! 🙏 I'm UdyamSaathi, the Accel Business advisor on WhatsApp. I'll help you pick internet, phone and IT services for your business, finish KYC and place the order, all in this chat.\n\nWhich language would you like?",
    hi: "नमस्ते! 🙏 मैं उद्यमसाथी हूँ, WhatsApp पर आपका Accel Business सलाहकार। मैं आपके बिज़नेस के लिए इंटरनेट, फ़ोन और IT सेवाएं चुनने, KYC पूरा करने और ऑर्डर करने में मदद करूँगा, सब इसी चैट में।\n\nआप किस भाषा में बात करना चाहेंगे?",
  },
  otherLanguage: { en: "Other language", hi: "दूसरी भाषा" },
  askLanguageName: {
    en: "Type the name of your language, for example Tamil, বাংলা or मराठी.",
    hi: "अपनी भाषा का नाम लिखें, जैसे Tamil, বাংলা या मराठी।",
  },
  languageUnknown: {
    en: "Sorry, I don't know that language. Try again, or choose English or Hindi.",
    hi: "माफ़ कीजिए, यह भाषा नहीं पहचानी। फिर से लिखें, या English या हिंदी चुनें।",
  },
  advisorHello: {
    en: "Tell me about your business in your own words, for example: \"I have 2 bakery shops in Pune with 8 staff, need billing and CCTV\". You can ask me anything along the way.",
    hi: "अपने बिज़नेस के बारे में अपने शब्दों में बताइए, जैसे: \"पुणे में मेरी 2 बेकरी हैं, 8 लोग काम करते हैं, बिलिंग और कैमरा चाहिए\"। बीच में आप कुछ भी पूछ सकते हैं।",
  },
  typeHint: {
    en: "For example: kirana store, salon, clinic, CA firm, restaurant chain, textile unit.",
    hi: "जैसे: किराना स्टोर, सैलून, क्लिनिक, CA फ़र्म, रेस्टोरेंट चेन, कपड़ा यूनिट।",
  },
  needsAsk: {
    en: "What would help your business? Type them, for example: billing, CCTV, WhatsApp, backup internet.\n\nSuggested for a business like yours: {suggested}.",
    hi: "आपके बिज़नेस के लिए क्या मददगार होगा? लिखिए, जैसे: बिलिंग, CCTV, WhatsApp, बैकअप इंटरनेट।\n\nआप जैसे बिज़नेस के लिए सुझाव: {suggested}।",
  },
  useSuggested: { en: "Use suggested", hi: "सुझाव लें" },
  choose: { en: "Choose", hi: "चुनें" },

  bundleTotals: {
    en: "*Monthly total: {total}* (incl. 18% GST)\nOne-time setup: {setup}\nContract: {months} months\nReady in about {days} days",
    hi: "*मासिक कुल: {total}* (18% GST सहित)\nएक बार का सेटअप: {setup}\nकॉन्ट्रैक्ट: {months} महीने\nलगभग {days} दिनों में चालू",
  },
  continue: { en: "Continue", hi: "आगे बढ़ें" },
  changeBundle: { en: "Change bundle", hi: "बंडल बदलें" },
  editPrompt: {
    en: "Tap a product to switch it on or off. Tap Done when you're finished.",
    hi: "किसी प्रोडक्ट को चालू या बंद करने के लिए उसे चुनें। हो जाने पर 'हो गया' चुनें।",
  },
  products: { en: "Products", hi: "प्रोडक्ट" },
  bundleNotReady: {
    en: "This bundle can't be ordered as it is:\n{issues}\n\nTap Change bundle to fix it.",
    hi: "यह बंडल अभी ऑर्डर नहीं हो सकता:\n{issues}\n\nठीक करने के लिए 'बंडल बदलें' चुनें।",
  },
  bundleEmpty: {
    en: "Your bundle is empty. Switch on at least one product.",
    hi: "आपका बंडल खाली है। कम से कम एक प्रोडक्ट चालू करें।",
  },

  consent: {
    en: "*Before we check your documents*\n• *Why:* only to complete your KYC and activate your connection, as telecom rules require.\n• *What:* your GST and Udyam certificates, an electricity bill from the last 90 days and the signatory's ID. Nothing else.\n• *How:* we read the text in your photos on our server and check it against GST and Udyam records. Each photo is deleted as soon as it is read; only the result is kept.\n• *Your rights:* type STOP any time to withdraw consent and delete this chat's details. Grievance officer: grievance@accel.example",
    hi: "*दस्तावेज़ जाँचने से पहले*\n• *क्यों:* सिर्फ़ आपका KYC पूरा करने और कनेक्शन चालू करने के लिए, जैसा टेलीकॉम नियमों में ज़रूरी है।\n• *क्या:* GST और उद्यम सर्टिफ़िकेट, पिछले 90 दिन का बिजली बिल और साइन करने वाले की ID। इससे ज़्यादा कुछ नहीं।\n• *कैसे:* हम आपकी फ़ोटो का टेक्स्ट अपने सर्वर पर पढ़ते हैं और GST व उद्यम रिकॉर्ड से मिलाते हैं। पढ़ते ही फ़ोटो हटा दी जाती है; सिर्फ़ नतीजा रखा जाता है।\n• *आपके अधिकार:* कभी भी STOP लिखकर सहमति वापस लें और इस चैट का विवरण हटवाएं। शिकायत: grievance@accel.example",
  },
  consentQuestion: { en: "Do you agree?", hi: "क्या आप सहमत हैं?" },
  agree: { en: "I agree", hi: "मैं सहमत हूँ" },
  notNow: { en: "Not now", hi: "अभी नहीं" },
  consentDeclined: {
    en: "No problem. A local Accel partner can call you and help, or tap I agree when you're ready.",
    hi: "कोई बात नहीं। एक लोकल Accel पार्टनर आपको कॉल करके मदद कर सकता है, या तैयार होने पर 'मैं सहमत हूँ' चुनें।",
  },
  kycAsk: {
    en: "Please send clear photos of these 4 documents, in any order:\n1. GST certificate\n2. Udyam certificate\n3. Electricity bill from the last 90 days\n4. ID of the person signing\n\n_Demo: type SAMPLE K01 (K01 to K12) to use a sample applicant._",
    hi: "कृपया इन 4 दस्तावेज़ों की साफ़ फ़ोटो भेजें, किसी भी क्रम में:\n1. GST सर्टिफ़िकेट\n2. उद्यम सर्टिफ़िकेट\n3. पिछले 90 दिन का बिजली बिल\n4. साइन करने वाले की ID\n\n_डेमो: सैंपल आवेदक के लिए SAMPLE K01 (K01 से K12) लिखें।_",
  },
  kycReading: { en: "Reading your document…", hi: "आपका दस्तावेज़ पढ़ रहे हैं…" },
  kycGot: { en: "✅ Got your {doc}.", hi: "✅ आपका {doc} मिल गया।" },
  kycStill: { en: "Still needed: {docs}.", hi: "अभी चाहिए: {docs}।" },
  checkNow: { en: "Check now", hi: "अभी जाँचें" },
  kycUnknownDoc: {
    en: "I couldn't tell which document this is. Please send a clearer photo, flat and in good light.",
    hi: "समझ नहीं आया कि यह कौन सा दस्तावेज़ है। कृपया साफ़ फ़ोटो भेजें, सीधी और अच्छी रोशनी में।",
  },
  kycNeedPhoto: {
    en: "Please send a photo (JPG or PNG) of the document. I can't read PDFs yet.",
    hi: "कृपया दस्तावेज़ की फ़ोटो (JPG या PNG) भेजें। PDF अभी नहीं पढ़ सकते।",
  },
  kycReadFailed: {
    en: "Sorry, I couldn't read that photo. Please try again.",
    hi: "माफ़ कीजिए, यह फ़ोटो नहीं पढ़ पाए। कृपया फिर से भेजें।",
  },
  kycNoSample: { en: "There's no sample applicant {id}. Try K01 to K12.", hi: "सैंपल आवेदक {id} नहीं है। K01 से K12 आज़माएं।" },
  kycFixHint: {
    en: "Send a corrected photo for the items marked ❌, or ask for a call from a local partner.",
    hi: "❌ वाली चीज़ों के लिए सही फ़ोटो भेजें, या लोकल पार्टनर से कॉल मँगवाएं।",
  },
  kycNotDuringStep: {
    en: "I'll ask for document photos at the KYC step. For now, please reply to the question above.",
    hi: "दस्तावेज़ों की फ़ोटो KYC के समय माँगी जाएंगी। अभी ऊपर वाले सवाल का जवाब दें।",
  },
  gstDropped: {
    en: "Your GST registration can't be used, so I removed the products that need GST. New monthly total: {total}.",
    hi: "आपका GST रजिस्ट्रेशन इस्तेमाल नहीं हो सकता, इसलिए GST वाले प्रोडक्ट हटा दिए। नया मासिक कुल: {total}।",
  },

  askName: { en: "What name should we put on the order?", hi: "ऑर्डर पर कौन सा नाम लिखें?" },
  askNameKnown: {
    en: "Name on the ID: *{name}*. Use it, or type another name for the order.",
    hi: "ID पर नाम: *{name}*। यही रखें, या ऑर्डर के लिए कोई और नाम लिखें।",
  },
  useThisName: { en: "Use this name", hi: "यही नाम रखें" },
  askCallThis: {
    en: "Our engineer will call to book the installation. Shall we call you on this WhatsApp number, {phone}?",
    hi: "इंस्टॉलेशन बुक करने के लिए हमारा इंजीनियर कॉल करेगा। क्या इसी WhatsApp नंबर {phone} पर कॉल करें?",
  },
  thisNumber: { en: "Yes, this number", hi: "हाँ, यही नंबर" },
  anotherNumber: { en: "Another number", hi: "दूसरा नंबर" },
  askPhone: { en: "Type the 10-digit mobile number we should call.", hi: "वह 10 अंकों का मोबाइल नंबर लिखें जिस पर कॉल करें।" },
  askMethod: {
    en: "We need to confirm that {phone} is yours. How would you like to verify it?",
    hi: "हमें पक्का करना है कि {phone} आपका ही नंबर है। आप कैसे सत्यापित करना चाहेंगे?",
  },
  methodWhatsapp: { en: "WhatsApp code", hi: "WhatsApp कोड" },
  methodMissedCall: { en: "Missed call", hi: "मिस्ड कॉल" },
  codeSent: {
    en: "We've sent a 6-digit code on WhatsApp to {phone}. Type it here.",
    hi: "हमने {phone} पर WhatsApp से 6 अंकों का कोड भेजा है। उसे यहाँ लिखें।",
  },
  demoCode: { en: "_Demo mode: no message was sent. The code is {code}._", hi: "_डेमो मोड: कोई मैसेज नहीं गया। कोड है {code}।_" },
  missedCallAsk: {
    en: "Give a missed call to *{number}* from {phone} within 10 minutes. It disconnects by itself and costs nothing. I'll message you here as soon as it comes through.",
    hi: "10 मिनट के अंदर {phone} से *{number}* पर मिस्ड कॉल दें। कॉल अपने आप कट जाएगी और कोई पैसा नहीं लगेगा। कॉल आते ही मैं यहाँ मैसेज करूँगा।",
  },
  demoMissedCall: { en: "_Demo mode: tap Simulate call instead._", hi: "_डेमो मोड: इसकी जगह 'कॉल सिम्युलेट' चुनें।_" },
  simulateCall: { en: "Simulate call", hi: "कॉल सिम्युलेट" },
  changeMethod: { en: "Change method", hi: "तरीका बदलें" },
  waitingForCall: {
    en: "Still waiting for your missed call to {number} from {phone}.",
    hi: "अभी भी {phone} से {number} पर आपकी मिस्ड कॉल का इंतज़ार है।",
  },
  wrongCode: { en: "That code doesn't match. Please check and try again.", hi: "कोड मेल नहीं खाया। जाँचकर फिर से लिखें।" },
  codeExpired: { en: "That check has expired. Please choose how to verify again.", hi: "समय खत्म हो गया। सत्यापन का तरीका फिर से चुनें।" },
  tooManyTries: { en: "Too many tries. Please choose how to verify again.", hi: "बहुत बार कोशिश हुई। सत्यापन का तरीका फिर से चुनें।" },
  rateLimited: {
    en: "Too many checks for this number. Please wait 10 minutes, or use another number.",
    hi: "इस नंबर के लिए बहुत बार कोशिश हुई। 10 मिनट रुकें, या दूसरा नंबर दें।",
  },
  verifyUnavailable: {
    en: "This way of verifying isn't available right now. Please try the other one, or use your WhatsApp number.",
    hi: "यह तरीका अभी उपलब्ध नहीं है। दूसरा तरीका आज़माएं, या अपना WhatsApp नंबर दें।",
  },
  sendFailed: {
    en: "We couldn't send a code to that number. Is it on WhatsApp? Try a missed call instead.",
    hi: "उस नंबर पर कोड नहीं भेज पाए। क्या वह WhatsApp पर है? मिस्ड कॉल आज़माएं।",
  },
  phoneVerified: { en: "✅ {phone} verified.", hi: "✅ {phone} सत्यापित हो गया।" },

  orderPlaced: {
    en: "🎉 *Order placed!*\nOrder ID: *{id}*\nMonthly total: *{total}* (incl. 18% GST)\nReady in about {days} days\n\nOur engineer will call {phone} to book the installation.",
    hi: "🎉 *ऑर्डर हो गया!*\nऑर्डर ID: *{id}*\nमासिक कुल: *{total}* (18% GST सहित)\nलगभग {days} दिनों में चालू\n\nइंस्टॉलेशन बुक करने के लिए हमारा इंजीनियर {phone} पर कॉल करेगा।",
  },
  trackLink: { en: "Track it any time: {link}", hi: "कभी भी ट्रैक करें: {link}" },
  trackHere: { en: "Type STATUS here any time to see where it is.", hi: "स्थिति देखने के लिए कभी भी यहाँ STATUS लिखें।" },
  orderFailed: { en: "Sorry, we couldn't place the order: {error}", hi: "माफ़ कीजिए, ऑर्डर नहीं हो पाया: {error}" },
  orderStatus: { en: "Order *{id}*: {status}\nLatest: {latest}", hi: "ऑर्डर *{id}*: {status}\nताज़ा: {latest}" },
  noOrder: { en: "You don't have an order yet.", hi: "अभी आपका कोई ऑर्डर नहीं है।" },
  doneHelp: {
    en: "Type STATUS to see your order, START OVER for a new bundle, or ask for a call from a person.",
    hi: "ऑर्डर देखने के लिए STATUS, नए बंडल के लिए START OVER लिखें, या किसी व्यक्ति से कॉल मँगवाएं।",
  },
  status: { en: "Order status", hi: "ऑर्डर स्थिति" },

  talkToPerson: { en: "Talk to a person", hi: "व्यक्ति से बात" },
  handoff: {
    en: "Thanks! A local Accel partner will call you on {phone} soon. Your request number is {id}.",
    hi: "धन्यवाद! एक लोकल Accel पार्टनर जल्द ही {phone} पर कॉल करेगा। आपका रिक्वेस्ट नंबर {id} है।",
  },
  menu: {
    en: "Here's what you can type any time:\n• START OVER: begin a new bundle\n• STATUS: see your order\n• LANGUAGE: change the language\n• STOP: delete this chat's details",
    hi: "आप कभी भी लिख सकते हैं:\n• START OVER: नया बंडल शुरू करें\n• STATUS: अपना ऑर्डर देखें\n• LANGUAGE: भाषा बदलें\n• STOP: इस चैट का विवरण हटाएं",
  },
  stopped: {
    en: "Done. We've deleted this chat's details. Your consent is withdrawn. Send hi any time to start again.",
    hi: "हो गया। इस चैट का विवरण हटा दिया गया है और आपकी सहमति वापस ले ली गई है। फिर से शुरू करने के लिए कभी भी hi लिखें।",
  },
} satisfies Record<string, Text>;

export type WaKey = keyof typeof WA;
