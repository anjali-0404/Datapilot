// Curated corpus: real organizations with real official website URLs.
// Sustainability/CSR, climate-tech, and Indian tech ecosystem coverage.
//
// Each org carries the `layer` of the knowledge base it is indexed under — this
// is what the dataset's "Source" column reports and what the Sources page counts
// as "records contributed". The layer is a curated decision per org, so an org
// always resolves to the same source (deterministic, never random).
export interface CorpusOrg {
  name: string;
  website: string;
  industry: string;
  location: string;
  contactEmail: string;
  phone: string;
  tags: string[];
  /** One of the six connector ids in src/lib/collection-engine.ts CONNECTORS. */
  layer: string;
}

export const CORPUS_PART1: CorpusOrg[] = [
  { name: "Tata Power Renewable Energy", website: "https://www.tatapower.com", industry: "Renewable Energy", location: "Mumbai", contactEmail: "customercare@tatapower.com", phone: "+91 22 6717 1000", tags: ["sustainability", "renewable", "energy", "csr", "sponsor"], layer: "csr-database" },
  { name: "ReNew Power", website: "https://www.renew.com", industry: "Renewable Energy", location: "Gurugram", contactEmail: "info@renew.com", phone: "+91 124 489 6670", tags: ["sustainability", "renewable", "energy", "climate", "sponsor"], layer: "news-feed" },
  { name: "Greenko Group", website: "https://www.greenkogroup.com", industry: "Renewable Energy", location: "Hyderabad", contactEmail: "info@greenkogroup.com", phone: "+91 40 6693 8000", tags: ["sustainability", "renewable", "energy", "climate"], layer: "web-search" },
  { name: "Infosys Sustainability Practice", website: "https://www.infosys.com", industry: "Technology", location: "Bangalore", contactEmail: "askus@infosys.com", phone: "+91 80 2852 0261", tags: ["technology", "csr", "sponsor", "software"], layer: "job-boards" },
  { name: "Wipro Sustainability", website: "https://www.wipro.com", industry: "Technology", location: "Bangalore", contactEmail: "info@wipro.com", phone: "+91 80 2844 0011", tags: ["technology", "csr", "sponsor", "software"], layer: "job-boards" },
  { name: "Tata Consultancy Services", website: "https://www.tcs.com", industry: "Technology", location: "Mumbai", contactEmail: "info@tcs.com", phone: "+91 22 6778 9595", tags: ["technology", "software", "sponsor"], layer: "job-boards" },
  { name: "Mahindra Susten", website: "https://www.mahindrasusten.com", industry: "Renewable Energy", location: "Mumbai", contactEmail: "info@mahindrasusten.com", phone: "+91 22 2490 1441", tags: ["sustainability", "renewable", "csr", "sponsor"], layer: "web-search" },
  { name: "Adani Green Energy", website: "https://www.adanigreenenergy.com", industry: "Renewable Energy", location: "Ahmedabad", contactEmail: "info@adani.com", phone: "+91 79 2656 5555", tags: ["sustainability", "renewable", "energy"], layer: "web-search" },
  { name: "Suzlon Energy", website: "https://www.suzlon.com", industry: "Renewable Energy", location: "Pune", contactEmail: "info@suzlon.com", phone: "+91 20 6702 2000", tags: ["sustainability", "renewable", "wind", "sponsor"], layer: "web-search" },
  { name: "Thermax Limited", website: "https://www.thermaxglobal.com", industry: "Green Manufacturing", location: "Pune", contactEmail: "info@thermaxglobal.com", phone: "+91 20 2554 2121", tags: ["sustainability", "manufacturing", "environment", "sponsor"], layer: "news-feed" },
  { name: "Kirloskar Brothers", website: "https://www.kirloskarpumps.com", industry: "Manufacturing", location: "Pune", contactEmail: "info@kirloskarpumps.com", phone: "+91 20 2444 0770", tags: ["manufacturing", "sponsor"], layer: "company-registry" },
  { name: "Ather Energy", website: "https://www.atherenergy.com", industry: "Electric Mobility", location: "Bangalore", contactEmail: "hello@atherenergy.com", phone: "+91 80 6735 8888", tags: ["sustainability", "startup", "tech", "sponsor"], layer: "social-directory" },
];


export const CORPUS_PART2: CorpusOrg[] = [
  { name: "Ola Electric", website: "https://www.olaelectric.com", industry: "Electric Mobility", location: "Bangalore", contactEmail: "support@olaelectric.com", phone: "+91 80 4668 1333", tags: ["sustainability", "startup", "tech"], layer: "social-directory" },
  { name: "Zerodha", website: "https://www.zerodha.com", industry: "Fintech", location: "Bangalore", contactEmail: "support@zerodha.com", phone: "+91 80 4719 2020", tags: ["fintech", "finance", "startup", "sponsor"], layer: "company-registry" },
  { name: "Razorpay", website: "https://www.razorpay.com", industry: "Fintech", location: "Bangalore", contactEmail: "care@razorpay.com", phone: "+91 80 4719 1150", tags: ["fintech", "finance", "startup", "sponsor"], layer: "company-registry" },
  { name: "CRED", website: "https://www.cred.club", industry: "Fintech", location: "Bangalore", contactEmail: "support@cred.club", phone: "+91 80 4719 3000", tags: ["fintech", "finance", "startup"], layer: "company-registry" },
  { name: "Persistent Systems", website: "https://www.persistent.com", industry: "Software", location: "Pune", contactEmail: "info@persistent.com", phone: "+91 20 6703 0000", tags: ["technology", "software", "sponsor"], layer: "job-boards" },
  { name: "KPIT Technologies", website: "https://www.kpit.com", industry: "Software", location: "Pune", contactEmail: "info@kpit.com", phone: "+91 20 6770 6000", tags: ["technology", "software", "sponsor"], layer: "job-boards" },
  { name: "Bharat Forge", website: "https://www.bharatforge.com", industry: "Manufacturing", location: "Pune", contactEmail: "info@bharatforge.com", phone: "+91 20 6704 2777", tags: ["manufacturing", "sponsor"], layer: "company-registry" },
  { name: "Centre for Science and Environment", website: "https://www.cseindia.org", industry: "Environmental Services", location: "Delhi", contactEmail: "cse@cseindia.org", phone: "+91 11 2995 5124", tags: ["sustainability", "environment", "ngo"], layer: "csr-database" },
  { name: "The Energy and Resources Institute", website: "https://www.teriin.org", industry: "Environmental Services", location: "Delhi", contactEmail: "registrar@teri.res.in", phone: "+91 11 2468 2100", tags: ["sustainability", "environment", "research", "climate"], layer: "csr-database" },
  { name: "CSTEP", website: "https://www.cstep.in", industry: "Environmental Services", location: "Bangalore", contactEmail: "cstep@cstep.in", phone: "+91 80 6690 2500", tags: ["sustainability", "climate", "research"], layer: "csr-database" },
  { name: "HDFC Bank CSR", website: "https://www.hdfcbank.com", industry: "Finance", location: "Mumbai", contactEmail: "support@hdfcbank.com", phone: "+91 22 6171 3000", tags: ["finance", "csr", "sponsor"], layer: "csr-database" },
  { name: "ICICI Foundation", website: "https://www.icicifoundation.org", industry: "Finance", location: "Mumbai", contactEmail: "info@icicifoundation.org", phone: "+91 22 2653 1414", tags: ["finance", "csr", "sponsor", "ngo"], layer: "csr-database" },
];

export const CORPUS_PART3: CorpusOrg[] = [
  { name: "LTIMindtree", website: "https://www.ltimindtree.com", industry: "Technology", location: "Bangalore", contactEmail: "", phone: "", tags: ["technology", "software", "sponsor"], layer: "job-boards" },
  { name: "Tech Mahindra", website: "https://www.techmahindra.com", industry: "Technology", location: "Pune", contactEmail: "investor.relations@techmahindra.com", phone: "", tags: ["technology", "software", "sponsor"], layer: "job-boards" },
  { name: "Mphasis", website: "https://www.mphasis.com", industry: "Technology", location: "Bangalore", contactEmail: "", phone: "", tags: ["technology", "software", "sponsor"], layer: "job-boards" },
  { name: "Cyient", website: "https://www.cyient.com", industry: "Technology", location: "Hyderabad", contactEmail: "", phone: "", tags: ["technology", "software", "sponsor"], layer: "job-boards" },
  { name: "TVS Motor Company", website: "https://www.tvsmotor.com", industry: "Electric Mobility", location: "Chennai", contactEmail: "customercare@tvsmotor.com", phone: "1800 258 7555", tags: ["automotive", "electric mobility", "sustainability", "sponsor"], layer: "company-registry" },
  { name: "Bajaj Auto", website: "https://www.bajajauto.com", industry: "Automotive", location: "Pune", contactEmail: "customerservice@bajajauto.co.in", phone: "+91 721 982 1111", tags: ["automotive", "manufacturing", "sponsor"], layer: "company-registry" },
  { name: "Hero MotoCorp", website: "https://www.heromotocorp.com", industry: "Automotive", location: "Gurugram", contactEmail: "", phone: "", tags: ["automotive", "manufacturing", "sponsor"], layer: "company-registry" },
  { name: "Inox Wind", website: "https://www.inoxwind.com", industry: "Renewable Energy", location: "Ahmedabad", contactEmail: "enquiry@inoxwind.com", phone: "", tags: ["sustainability", "renewable", "energy", "wind", "climate"], layer: "news-feed" },
  { name: "Azure Power", website: "https://www.azurepower.com", industry: "Renewable Energy", location: "Delhi", contactEmail: "info@azurepower.com", phone: "+91 124 4155 755", tags: ["sustainability", "renewable", "energy", "solar", "climate"], layer: "news-feed" },
  { name: "GAIL", website: "https://www.gailonline.com", industry: "Oil & Gas", location: "Delhi", contactEmail: "", phone: "", tags: ["energy", "gas", "sustainability", "sponsor"], layer: "news-feed" },
  { name: "PhonePe", website: "https://www.phonepe.com", industry: "Fintech", location: "Bangalore", contactEmail: "", phone: "+91 80 6872 7105", tags: ["fintech", "finance", "startup", "sponsor"], layer: "company-registry" },
  { name: "Paytm", website: "https://www.paytm.com", industry: "Fintech", location: "Noida", contactEmail: "", phone: "+91 120 444 0440", tags: ["fintech", "finance", "startup", "sponsor"], layer: "company-registry" },
  { name: "Groww", website: "https://www.groww.in", industry: "Fintech", location: "Bangalore", contactEmail: "support@groww.in", phone: "+91 91088 00000", tags: ["fintech", "finance", "startup"], layer: "company-registry" },
  { name: "Pine Labs", website: "https://www.pinelabs.com", industry: "Fintech", location: "Noida", contactEmail: "", phone: "", tags: ["fintech", "finance", "startup", "sponsor"], layer: "company-registry" },
  { name: "BharatPe", website: "https://www.bharatpe.com", industry: "Fintech", location: "Delhi", contactEmail: "", phone: "", tags: ["fintech", "finance", "startup"], layer: "company-registry" },
  { name: "1mg", website: "https://www.1mg.com", industry: "Healthtech", location: "Gurugram", contactEmail: "", phone: "", tags: ["health", "healthtech", "startup"], layer: "social-directory" },
  { name: "Unacademy", website: "https://www.unacademy.com", industry: "Edtech", location: "Bangalore", contactEmail: "", phone: "+91 85858 58585", tags: ["education", "edtech", "startup"], layer: "social-directory" },
  { name: "Mamaearth", website: "https://www.mamaearth.in", industry: "Consumer Goods", location: "Gurugram", contactEmail: "care@mamaearth.in", phone: "", tags: ["d2c", "consumer", "startup", "sponsor"], layer: "social-directory" },
  { name: "Nykaa", website: "https://www.nykaa.com", industry: "E-commerce", location: "Mumbai", contactEmail: "", phone: "", tags: ["ecommerce", "retail", "startup", "sponsor"], layer: "social-directory" },
  { name: "Delhivery", website: "https://www.delhivery.com", industry: "Logistics", location: "Gurugram", contactEmail: "", phone: "", tags: ["logistics", "supply chain", "startup", "sponsor"], layer: "web-search" },
  { name: "DLF", website: "https://www.dlf.in", industry: "Real Estate", location: "Delhi", contactEmail: "info@dlf.in", phone: "+91 124 4396 000", tags: ["real estate", "infrastructure", "sponsor"], layer: "web-search" },
  { name: "JSW Steel", website: "https://www.jswsteel.in", industry: "Steel", location: "Mumbai", contactEmail: "", phone: "1800 225 225", tags: ["manufacturing", "steel", "sustainability", "csr", "sponsor"], layer: "csr-database" },
  { name: "ITC", website: "https://www.itcportal.com", industry: "FMCG", location: "Kolkata", contactEmail: "", phone: "+91 33 2288 9371", tags: ["fmcg", "manufacturing", "csr", "sustainability", "sponsor"], layer: "csr-database" },
  { name: "Goonj", website: "https://www.goonj.org", industry: "Social Services", location: "Delhi", contactEmail: "", phone: "", tags: ["ngo", "social", "sustainability"], layer: "csr-database" },
  { name: "Akshaya Patra", website: "https://www.akshayapatra.org", industry: "Social Services", location: "Bangalore", contactEmail: "", phone: "1800 425 8622", tags: ["ngo", "social", "education"], layer: "csr-database" },
];

export const CORPUS: CorpusOrg[] = [...CORPUS_PART1, ...CORPUS_PART2, ...CORPUS_PART3];
