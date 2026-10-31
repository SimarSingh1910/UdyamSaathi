import type { Product, SegmentCode } from "./catalogue";
import { checkProductEligibility, type BusinessProfile } from "./eligibility";
import type { QuoteItemInput } from "./quote";

export type Lang = "en" | "hi";
export type Text = Record<Lang, string>;

export type Need =
  | "billing"
  | "whatsapp"
  | "cctv"
  | "email"
  | "security"
  | "backup_internet"
  | "phone_line"
  | "guest_wifi"
  | "website"
  | "cloud_backup"
  | "machines"
  | "fleet";

export type CurrentInternet =
  | "Mobile hotspot"
  | "Home broadband"
  | "Business broadband"
  | "Leased line"
  | "Mixed per site"
  | "None";

/** Everything the advisor asks the owner. */
export interface AdvisorAnswers {
  businessType: string;
  city: string;
  employees: number;
  sites: number;
  currentInternet: CurrentInternet;
  needs: Need[];
  hasGstin: boolean;
}

/** Cities in the dataset and their tier. Anything else is treated as tier 2. */
export const CITY_TIERS: Record<string, 1 | 2> = {
  Delhi: 1, Mumbai: 1, Bengaluru: 1, Hyderabad: 1, Chennai: 1, Pune: 1, Kolkata: 1, Ahmedabad: 1,
  Vadodara: 2, Kochi: 2, Ludhiana: 2, Indore: 2, Nagpur: 2, Lucknow: 2, Bhopal: 2, Jaipur: 2,
  Mysuru: 2, Coimbatore: 2, Nashik: 2, Visakhapatnam: 2, Patna: 2, Surat: 2,
};

export const BUSINESS_TYPES: Record<SegmentCode, string[]> = {
  micro: ["Kirana store", "Pharmacy", "Salon", "Bakery", "Sweet shop", "Boutique", "Hardware store", "Mobile repair shop", "Optician", "Stationery shop"],
  prof: ["Dental clinic", "Physiotherapy clinic", "Diagnostic lab", "CA firm", "Law office", "Coaching centre", "Architecture studio", "Insurance agency", "Real estate agency", "Travel agency"],
  multi: ["Restaurant chain", "Bakery chain", "Pharmacy chain", "Apparel retail chain", "Electronics retail chain", "Gym chain", "Pre-school chain", "Budget hotel group"],
  mfg: ["Auto-parts unit", "Textile unit", "Food processing unit", "Packaging unit", "Plastic moulding unit", "Printing press", "Furniture workshop"],
};

/** Work out the segment from the business type, then let size override it. */
export function segmentFor(answers: Pick<AdvisorAnswers, "businessType" | "sites">): SegmentCode {
  const found = (Object.keys(BUSINESS_TYPES) as SegmentCode[]).find((s) =>
    BUSINESS_TYPES[s].includes(answers.businessType),
  );
  const base = found ?? "micro";
  if (answers.sites >= 2 && base !== "mfg") return "multi";
  return base;
}

export const SEGMENT_LABELS: Record<SegmentCode, Text> = {
  micro: { en: "Micro retail & services", hi: "दुकान/सर्विस बिज़नेस" },
  prof: { en: "Professional office", hi: "प्रोफेशनल ऑफिस" },
  multi: { en: "Multi-site business", hi: "मल्टी-साइट बिज़नेस" },
  mfg: { en: "Small manufacturer", hi: "मैन्युफैक्चरिंग यूनिट" },
};

/** Needs we pre-select for each segment, based on what activated customers in that segment bought. */
export const DEFAULT_NEEDS: Record<SegmentCode, Need[]> = {
  micro: ["billing", "whatsapp", "cctv"],
  prof: ["email", "security", "cloud_backup"],
  multi: ["billing", "cctv", "backup_internet"],
  mfg: ["email", "security", "cctv"],
};

export interface RecommendedItem extends QuoteItemInput {
  /** Core items keep the business running; add-ons can be toggled off on the quote screen. */
  core: boolean;
  why: Text;
}

export interface Skipped {
  productId: string;
  name: string;
  why: Text;
}

export interface Recommendation {
  segment: SegmentCode;
  profile: BusinessProfile;
  items: RecommendedItem[];
  skipped: Skipped[];
  summary: Text;
}

const t = (en: string, hi: string): Text => ({ en, hi });

/**
 * Rule-based recommender. Deterministic, so the same answers always give the
 * same bundle (important for the judges' live test scenarios). The GenAI layer
 * only turns free text into these answers and rewrites the explanation.
 */
export function recommend(answers: AdvisorAnswers, catalogue: Product[]): Recommendation {
  const byId = new Map(catalogue.map((p) => [p.id, p]));
  const segment = segmentFor(answers);
  const employees = Math.max(1, Math.round(answers.employees));
  const sites = Math.max(1, Math.round(answers.sites));
  const profile: BusinessProfile = {
    cityTier: CITY_TIERS[answers.city] ?? 2,
    employees,
    sites,
    hasActiveGstin: answers.hasGstin,
  };
  const needs = new Set(answers.needs);

  const items: RecommendedItem[] = [];
  const skipped: Skipped[] = [];

  const ok = (id: string) => {
    const p = byId.get(id);
    return p ? checkProductEligibility(p, profile).eligible : false;
  };

  const add = (id: string, quantity: number, core: boolean, why: Text, fallback?: string): boolean => {
    const p = byId.get(id);
    if (!p || quantity <= 0) return false;
    if (ok(id)) {
      items.push({ productId: id, quantity, core, why });
      return true;
    }
    if (fallback && ok(fallback)) {
      return add(fallback, quantity, core, why);
    }
    const reason = checkProductEligibility(p, profile).reasons[0];
    skipped.push({
      productId: id,
      name: p.name,
      why: t(reason, p.requiresGstin && !profile.hasActiveGstin
        ? `${p.name} के लिए एक्टिव GST रजिस्ट्रेशन ज़रूरी है।`
        : `${p.name} आपके बिज़नेस साइज़ या शहर के लिए अभी उपलब्ध नहीं है।`),
    });
    return false;
  };

  // 1. Connectivity: every bundle starts with a reliable main link per site.
  if (segment === "mfg") {
    const ill = employees >= 25 && needs.has("machines") ? "P06" : "P05";
    if (
      !add(ill, 1, true, t(
        "A dedicated leased line gives your machines and ERP guaranteed bandwidth with an uptime SLA.",
        "लीज़्ड लाइन से आपकी मशीनों और ERP को तय स्पीड और अपटाइम की गारंटी मिलती है।",
      ))
    ) {
      add("P02", 1, true, t(
        "300 Mbps business fibre covers your office and shop floor until you qualify for a leased line.",
        "300 Mbps बिज़नेस फ़ाइबर आपके ऑफिस और फ़ैक्ट्री फ़्लोर के लिए काफ़ी है।",
      ));
    }
  } else if (segment === "prof") {
    const fast = employees >= 15 && ok("P03");
    add(fast ? "P03" : "P02", 1, true, fast
      ? t("With 15+ people online at once, 1 Gbps fibre keeps video calls and cloud files fast.",
          "15 से ज़्यादा लोग एक साथ ऑनलाइन हों तो 1 Gbps फ़ाइबर से कॉल और फ़ाइलें तेज़ चलती हैं।")
      : t("300 Mbps fibre is plenty for your team's calls, cloud files and billing software.",
          "300 Mbps फ़ाइबर आपकी टीम की कॉल, क्लाउड फ़ाइलों और बिलिंग के लिए काफ़ी है।"));
  } else if (segment === "multi") {
    const perSite = employees / sites >= 8 ? "P02" : "P01";
    add(perSite, sites, true, t(
      `One business fibre line at each of your ${sites} locations, all on one bill.`,
      `आपकी सभी ${sites} जगहों पर एक-एक बिज़नेस फ़ाइबर, सब एक ही बिल में।`,
    ));
  } else {
    const wireless = answers.currentInternet === "Mobile hotspot" || answers.currentInternet === "None";
    add("P01", 1, true, wireless
      ? t("Moves your UPI and billing off your phone's hotspot onto a stable 100 Mbps fibre line.",
          "UPI और बिलिंग को फ़ोन के हॉटस्पॉट से हटाकर 100 Mbps के भरोसेमंद फ़ाइबर पर लाता है।")
      : t("100 Mbps business fibre with priority business support instead of a home plan.",
          "होम प्लान की जगह 100 Mbps बिज़नेस फ़ाइबर, बिज़नेस सपोर्ट के साथ।"));
  }

  // 2. Mobile lines for the owner and key staff.
  if (segment === "micro") {
    add("P07", Math.min(2, employees), true, t(
      "Business mobile lines for you and your staff, with unlimited calls and 50 GB data.",
      "आपके और स्टाफ़ के लिए बिज़नेस मोबाइल लाइन, अनलिमिटेड कॉल और 50 GB डेटा।",
    ));
  } else {
    const lines = Math.min(20, Math.max(1, Math.round(employees / 5)));
    add("P08", lines, true, t(
      `${lines} business postpaid line${lines > 1 ? "s" : ""} for managers and staff on the move, with priority care.`,
      `मैनेजर और फ़ील्ड स्टाफ़ के लिए ${lines} बिज़नेस पोस्टपेड लाइन, प्रायोरिटी केयर के साथ।`,
    ));
  }

  // 3. Add-ons based on what the owner said they need.
  if (needs.has("backup_internet") || segment === "multi") {
    add("P09", sites, segment === "multi", t(
      "If the main line goes down, a 4G/5G backup takes over automatically so billing never stops.",
      "मेन लाइन बंद हो तो 4G/5G बैकअप अपने आप चालू हो जाता है, बिलिंग कभी नहीं रुकती।",
    ));
  }
  if (segment === "multi" && sites >= 3) {
    add("P10", sites, false, t(
      "Manage the internet at all your locations from one dashboard and prioritise billing traffic.",
      "सभी जगहों का इंटरनेट एक डैशबोर्ड से संभालें और बिलिंग को प्राथमिकता दें।",
    ));
  }
  if (needs.has("billing")) {
    add("P19", sites, false, t(
      "GST-ready billing, stock and UPI/card payments on a tablet at each counter.",
      "हर काउंटर पर टैबलेट से GST बिलिंग, स्टॉक और UPI/कार्ड पेमेंट।",
    ));
  }
  if (needs.has("whatsapp")) {
    if (!add("P15", 1, false, t(
      "A verified WhatsApp Business channel with your catalogue, so customers can order by chat.",
      "वेरिफ़ाइड WhatsApp बिज़नेस चैनल और कैटलॉग, ताकि ग्राहक चैट से ऑर्डर कर सकें।",
    )) && !needs.has("website")) {
      add("P18", 1, false, t(
        "Until your GST is active, a simple website lets customers find you and see your products.",
        "जब तक GST एक्टिव नहीं है, एक आसान वेबसाइट से ग्राहक आपको ढूंढ सकते हैं।",
      ));
    }
  }
  if (needs.has("cctv")) {
    const cams = segment === "micro" ? 2 : 4 * sites;
    add("P23", cams, false, t(
      `${cams} HD cameras with 30-day cloud recording you can watch from your phone.`,
      `${cams} HD कैमरे, 30 दिन की क्लाउड रिकॉर्डिंग, फ़ोन पर लाइव देखें।`,
    ));
  }
  if (needs.has("guest_wifi")) {
    add("P22", sites, false, t(
      "Separate, filtered Wi-Fi for customers so your billing network stays private.",
      "ग्राहकों के लिए अलग Wi-Fi, ताकि आपका बिलिंग नेटवर्क सुरक्षित रहे।",
    ));
  }
  if (needs.has("email")) {
    const users = Math.min(50, employees);
    add("P16", users, segment !== "micro", t(
      `Business email on your own domain plus documents and meetings for ${users} people, instead of personal Gmail.`,
      `पर्सनल Gmail की जगह अपने डोमेन पर बिज़नेस ईमेल, ${users} लोगों के लिए।`,
    ));
  }
  if (needs.has("website")) {
    add("P18", 1, false, t(
      "Domain, a 5-page website and SSL, so customers can find you on Google.",
      "डोमेन, 5 पेज की वेबसाइट और SSL, ताकि ग्राहक आपको Google पर ढूंढ सकें।",
    ));
  }
  if (needs.has("security")) {
    const devices = Math.min(50, employees);
    add("P20", devices, false, t(
      `Antivirus and ransomware protection for ${devices} PCs and phones.`,
      `${devices} कंप्यूटर और फ़ोन के लिए एंटीवायरस और रैनसमवेयर सुरक्षा।`,
    ));
    if (segment === "mfg" || segment === "multi") {
      add("P21", 1, false, t(
        "A managed firewall at your main site, monitored for threats round the clock.",
        "मुख्य साइट पर मैनेज्ड फ़ायरवॉल, 24 घंटे निगरानी के साथ।",
      ));
    }
  }
  if (needs.has("cloud_backup")) {
    add("P17", 1, false, t(
      "Automatic 1 TB backup of your PCs and phones, so records survive a crash or theft.",
      "कंप्यूटर और फ़ोन का अपने आप 1 TB बैकअप, ताकि डेटा कभी न खोए।",
    ));
  }
  if (needs.has("phone_line")) {
    add("P12", 2, false, t(
      "Business phone lines over the internet with IVR and call recording.",
      "इंटरनेट पर बिज़नेस फ़ोन लाइन, IVR और कॉल रिकॉर्डिंग के साथ।",
    ));
    if (segment === "multi") {
      add("P13", 1, false, t(
        "One 1800 number for all your locations.",
        "सभी जगहों के लिए एक 1800 नंबर।",
      ));
    }
  }
  if (needs.has("machines")) {
    add("P24", 5, false, t(
      "Sensor kits to track machine uptime and energy use from your phone.",
      "मशीनों का अपटाइम और बिजली खर्च फ़ोन पर देखने के लिए सेंसर किट।",
    ));
  }
  if (needs.has("fleet")) {
    add("P25", 3, false, t(
      "Live GPS tracking for your delivery vehicles.",
      "डिलीवरी गाड़ियों की लाइव GPS ट्रैकिंग।",
    ));
  }

  const segLabel = SEGMENT_LABELS[segment];
  return {
    segment,
    profile,
    items,
    skipped,
    summary: t(
      `For a ${segLabel.en.toLowerCase()} with ${employees} people at ${sites} location${sites > 1 ? "s" : ""}, here is a bundle of ${items.length} services on one bill.`,
      `आपके ${segLabel.hi} (${employees} लोग, ${sites} जगह) के लिए ${items.length} सेवाओं का बंडल, सब एक ही बिल में।`,
    ),
  };
}
