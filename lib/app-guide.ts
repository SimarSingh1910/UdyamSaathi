import { STRINGS, type StringKey, type Text } from "./i18n";

/**
 * What the in-app assistant knows about the app itself: every screen, what each
 * button does, and how to change things. Button names are filled in with the labels
 * the owner actually sees in their language, so directions match the screen.
 */

/** Things the assistant can offer as a one-tap button. The app decides which are possible right now. */
export const ACTION_IDS = [
  "open_language",
  "go_bundle",
  "go_quote",
  "go_kyc",
  "start_over",
  "talk_to_person",
  "track_order",
] as const;
export type ActionId = (typeof ACTION_IDS)[number];
export const isActionId = (v: unknown): v is ActionId => ACTION_IDS.includes(v as ActionId);

export const ACTION_LABEL: Record<ActionId, StringKey> = {
  open_language: "actLanguage",
  go_bundle: "actBundle",
  go_quote: "actQuote",
  go_kyc: "actKyc",
  start_over: "startOver",
  talk_to_person: "actTalk",
  track_order: "trackOrder",
};

export type Screen = "advisor" | "recommendation" | "quote" | "kyc" | "contact" | "done" | "tracker";
export const SCREENS: Screen[] = ["advisor", "recommendation", "quote", "kyc", "contact", "done", "tracker"];

/** UI labels quoted in the guide. The client sends them in the owner's language. */
export const GUIDE_LABEL_KEYS = [
  "stepAdvisor",
  "stepQuote",
  "stepKyc",
  "stepDone",
  "seePrice",
  "startOver",
  "essentials",
  "addOns",
  "notIncluded",
  "moreOptions",
  "continueKyc",
  "back",
  "consentTitle",
  "consentAgree",
  "kycTitle",
  "upload",
  "replace",
  "verify",
  "callMe",
  "sample",
  "placeOrder",
  "trackOrder",
  "talkToPerson",
] as const satisfies readonly StringKey[];
export type GuideLabels = Partial<Record<(typeof GUIDE_LABEL_KEYS)[number], string>>;

export function appGuide(labels: GuideLabels = {}): string {
  const L = (k: (typeof GUIDE_LABEL_KEYS)[number]) => `"${(labels[k] ?? STRINGS[k].en).slice(0, 60)}"`;
  return `Screens, in order (the bar of steps at the top, ${L("stepAdvisor")} → ${L("stepQuote")} → ${L("stepKyc")} → ${L("stepDone")}, only shows progress; it is not clickable):
- Language: the globe button at the top right of every screen shows the current language; tap it to pick from English and 22 Indian languages. Everything, including this assistant, switches.
- Advisor (step 1): a short chat asks business type, city, staff, locations, current internet, what they need, and GST. They can type, tap the answer buttons, or tap the mic and speak. ${L("talkToPerson")} under the chat asks a partner to call.
- Your bundle (still step 1): a short summary, then each recommended product with why it is there and its monthly price, and the monthly total including GST. Buttons: ${L("startOver")} and ${L("seePrice")}. To change any answer before ordering (business type, city, staff, locations, current internet, needs, GST), tap ${L("startOver")}: the questions are asked again and a new bundle is built.
- Quote (step 2): ${L("essentials")} are always included; ${L("addOns")} each have an on/off switch; − and + change how many (lines, sites). ${L("notIncluded")} explains anything left out. ${L("moreOptions")} lists other products with a button to add them. The summary shows the monthly total with GST, one-time setup, contract length, days to get everything working, and the bundle saving. The price updates instantly. Buttons: ${L("back")} (to the bundle) and ${L("continueKyc")}.
- KYC (step 3): first ${L("consentTitle")}: what is collected, why, and for how long, plus an optional box for offers on WhatsApp; ${L("consentAgree")} continues. Then ${L("kycTitle")}: four photos: GST certificate, Udyam certificate, an electricity bill from the last 90 days (address proof), and the ID of the person signing. Each has ${L("upload")} (later ${L("replace")}). Photos are read on the phone; only the text is checked. ${L("verify")} runs the checks; every document shows ticks or a cross with the reason. To fix a failed one: ${L("replace")} that photo with a clear, straight, recent one and tap ${L("verify")} again, or ${L("callMe")}. If GST is not active, products that need GST are removed and the rest is repriced. ${L("sample")} fills in a demo applicant. When all is fine: ${L("placeOrder")}. ${L("back")} returns to the quote.
- Contact: name and a 10-digit mobile number, then ${L("placeOrder")}.
- Done (step 4): order ID, monthly total, days to activation, and ${L("trackOrder")}.
- Order tracker (its own page, link /track/<order ID>; bookmark it): live steps Order placed → KYC verified → Installation booked → Engineer on site → All services active, with times, the engineer's name and visit date once booked, and an updates list. It refreshes by itself; no need to call support.
Only after an order is placed, these need a local partner: changing the address, city or plan of a placed order, cancelling an order, payments and bills, custom discounts, exact coverage at an address.`;
}

interface HowTo {
  match: RegExp;
  answer: Text;
  action?: ActionId;
}

/** Keyword answers used when no LLM is available. First match wins. */
export const HOWTOS: HowTo[] = [
  {
    match: /language|bhasha|भाषा|zuban|hindi|english|tamil|telugu|bangla|bengali|marathi|gujarati|punjabi|kannada|malayalam|urdu|हिंदी|अंग्रेज़ी/i,
    answer: {
      en: "Tap the globe button at the top right of the screen and pick your language. The whole app, including me, switches to it.",
      hi: "स्क्रीन के ऊपर दाईं ओर ग्लोब वाले बटन पर टैप करें और अपनी भाषा चुनें। पूरा ऐप, मैं भी, उसी भाषा में हो जाएगा।",
    },
    action: "open_language",
  },
  {
    match: /person|human|agent|call me|someone|baat|बात|madad|मदद|partner|पार्टनर|complain|शिकायत/i,
    answer: {
      en: "I can ask a local Accel partner to call you. Tap the button below and leave your name and number.",
      hi: "मैं किसी लोकल Accel पार्टनर से आपको कॉल करवा सकता हूँ। नीचे बटन दबाएँ और अपना नाम और नंबर दें।",
    },
    action: "talk_to_person",
  },
  {
    match: /track|status|install|engineer|when.*(ready|start|work)|kab|कब|स्टेटस|इंस्टॉल|इंजीनियर/i,
    answer: {
      en: "Your order tracker shows each step live: order placed, KYC verified, installation booked, engineer on site, all services active, with the engineer's name and visit date once booked.",
      hi: "ऑर्डर ट्रैकर पर हर कदम लाइव दिखता है: ऑर्डर, KYC, इंस्टॉलेशन बुकिंग, इंजीनियर का आना और सेवाएँ चालू होना। बुकिंग के बाद इंजीनियर का नाम और तारीख भी दिखती है।",
    },
    action: "track_order",
  },
  {
    match: /kyc|document|upload|certificate|bill|udyam|aadhaar|pan\b|id proof|photo|failed|reject|दस्तावेज़|डॉक्यूमेंट|फ़ोटो|बिल/i,
    answer: {
      en: "KYC needs four photos: GST certificate, Udyam certificate, an electricity bill from the last 90 days, and the ID of the person signing. If one fails, tap \"Replace\" on it, use a clear and straight photo, and check again.",
      hi: "KYC के लिए चार फ़ोटो चाहिए: GST सर्टिफिकेट, Udyam सर्टिफिकेट, पिछले 90 दिनों का बिजली बिल, और साइन करने वाले का ID। कोई फ़ेल हो तो उस पर \"बदलें\" दबाएँ, साफ़ और सीधी फ़ोटो लें और फिर से जाँचें।",
    },
    action: "go_kyc",
  },
  {
    match: /change (my )?answer|wrong|galat|गलत|start over|restart|again|dobara|दोबारा|फिर से|edit/i,
    answer: {
      en: "To change your answers, tap \"Start over\" on your bundle screen. I'll ask the questions again and build a new bundle.",
      hi: "जवाब बदलने के लिए बंडल वाली स्क्रीन पर \"फिर से शुरू करें\" दबाएँ। सवाल फिर से पूछे जाएँगे और नया बंडल बनेगा।",
    },
    action: "start_over",
  },
  {
    match: /remove|\badd\b|add-?ons?|quantity|how many|reduce|cheaper|lower|price|cost|total|setup|contract|hata|हटा|जोड़|कम|कीमत|दाम|kitna|कितना/i,
    answer: {
      en: "On the Quote screen, switch add-ons on or off, use − and + to change how many, and see \"More you can add\" for other products. The monthly total, setup fee and contract update instantly.",
      hi: "कीमत वाली स्क्रीन पर ऐड-ऑन चालू या बंद करें, − और + से गिनती बदलें, और \"और जोड़ सकते हैं\" में दूसरे प्रोडक्ट देखें। मासिक कुल, सेटअप फ़ीस और कॉन्ट्रैक्ट तुरंत बदल जाते हैं।",
    },
    action: "go_quote",
  },
  {
    match: /privacy|data|consent|safe|secure|delete|प्राइवेसी|डेटा|सहमति|सुरक्षित/i,
    answer: {
      en: "Your documents are read on your phone and only the text is checked. Your details are used only for KYC and activation, and you can withdraw consent by asking a partner.",
      hi: "आपके दस्तावेज़ फ़ोन पर ही पढ़े जाते हैं, सिर्फ़ टेक्स्ट जाँचा जाता है। आपकी जानकारी सिर्फ़ KYC और कनेक्शन चालू करने के लिए है, और पार्टनर से कहकर सहमति वापस ली जा सकती है।",
    },
  },
];

export const GENERIC_HELP: Text = {
  en: "I can show you where to change your language, products or answers, explain your price, help with KYC documents, track your order, or get a partner to call you. What would you like to do?",
  hi: "मैं बता सकता हूँ कि भाषा, प्रोडक्ट या जवाब कहाँ बदलें, आपकी कीमत समझा सकता हूँ, KYC में मदद कर सकता हूँ, ऑर्डर ट्रैक करवा सकता हूँ, या पार्टनर से कॉल करवा सकता हूँ। आप क्या करना चाहेंगे?",
};

export function matchHowTo(text: string): HowTo | null {
  return HOWTOS.find((h) => h.match.test(text)) ?? null;
}
