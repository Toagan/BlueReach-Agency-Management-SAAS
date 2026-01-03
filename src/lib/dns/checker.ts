// DNS Health Checker
// Uses DNS over HTTPS (DoH) for server-side DNS lookups

export interface SPFResult {
  found: boolean;
  valid: boolean;
  record: string | null;
  issues: string[];
}

export interface DKIMResult {
  found: boolean;
  valid: boolean;
  selector: string | null;
  record: string | null;
  issues: string[];
}

export interface DMARCResult {
  found: boolean;
  valid: boolean;
  record: string | null;
  policy: "none" | "quarantine" | "reject" | null;
  issues: string[];
}

export interface DomainHealthResult {
  domain: string;
  spf: SPFResult;
  dkim: DKIMResult;
  dmarc: DMARCResult;
  healthScore: number;
  checkedAt: string;
}

// DNS over HTTPS endpoint (using Google's public DoH)
const DOH_ENDPOINT = "https://dns.google/resolve";

interface DoHResponse {
  Status: number;
  Answer?: Array<{
    name: string;
    type: number;
    TTL: number;
    data: string;
  }>;
}

// Query DNS TXT records using DoH
async function queryTXT(domain: string): Promise<string[]> {
  try {
    const url = new URL(DOH_ENDPOINT);
    url.searchParams.set("name", domain);
    url.searchParams.set("type", "TXT");

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/dns-json" },
    });

    if (!response.ok) {
      return [];
    }

    const data: DoHResponse = await response.json();

    if (data.Status !== 0 || !data.Answer) {
      return [];
    }

    // Extract TXT records, removing quotes
    return data.Answer.filter((a) => a.type === 16) // TXT = 16
      .map((a) => a.data.replace(/"/g, ""));
  } catch (error) {
    console.error(`DNS query failed for ${domain}:`, error);
    return [];
  }
}

// Check SPF record
export async function checkSPF(domain: string): Promise<SPFResult> {
  const result: SPFResult = {
    found: false,
    valid: false,
    record: null,
    issues: [],
  };

  try {
    const records = await queryTXT(domain);

    // Find SPF record (starts with v=spf1)
    const spfRecord = records.find((r) => r.toLowerCase().startsWith("v=spf1"));

    if (!spfRecord) {
      result.issues.push("No SPF record found");
      return result;
    }

    result.found = true;
    result.record = spfRecord;

    // Basic validation
    const issues: string[] = [];

    // Check for common issues
    if (spfRecord.includes("+all")) {
      issues.push("SPF uses +all which allows any server to send (insecure)");
    }

    if (!spfRecord.includes("~all") && !spfRecord.includes("-all") && !spfRecord.includes("?all")) {
      if (!spfRecord.includes("+all")) {
        issues.push("SPF record should end with ~all, -all, or ?all");
      }
    }

    // Check for too many DNS lookups (max 10)
    const lookupCount = (spfRecord.match(/include:|a:|mx:|ptr:|exists:/gi) || []).length;
    if (lookupCount > 10) {
      issues.push(`SPF has ${lookupCount} DNS lookups (max 10 allowed)`);
    }

    result.issues = issues;
    result.valid = issues.length === 0 || !issues.some((i) => i.includes("insecure"));
  } catch (error) {
    result.issues.push(`Error checking SPF: ${error}`);
  }

  return result;
}

// Common DKIM selectors to check
const DKIM_SELECTORS = [
  "google",
  "default",
  "selector1",
  "selector2",
  "k1",
  "k2",
  "s1",
  "s2",
  "dkim",
  "mail",
  "smtp",
  "email",
  "mxvault",
  "protonmail",
  "protonmail2",
  "protonmail3",
];

// Check DKIM record
export async function checkDKIM(
  domain: string,
  customSelectors?: string[]
): Promise<DKIMResult> {
  const result: DKIMResult = {
    found: false,
    valid: false,
    selector: null,
    record: null,
    issues: [],
  };

  try {
    const selectors = customSelectors || DKIM_SELECTORS;

    // Try each selector
    for (const selector of selectors) {
      const dkimDomain = `${selector}._domainkey.${domain}`;
      const records = await queryTXT(dkimDomain);

      // Find DKIM record (contains v=DKIM1 or k=rsa)
      const dkimRecord = records.find(
        (r) => r.toLowerCase().includes("v=dkim1") || r.toLowerCase().includes("k=rsa")
      );

      if (dkimRecord) {
        result.found = true;
        result.selector = selector;
        result.record = dkimRecord;

        // Basic validation
        const issues: string[] = [];

        if (!dkimRecord.toLowerCase().includes("p=")) {
          issues.push("DKIM record missing public key (p=)");
        }

        // Check if key is empty (revoked)
        if (dkimRecord.includes("p=;") || dkimRecord.includes("p= ")) {
          issues.push("DKIM key appears to be revoked (empty key)");
        }

        result.issues = issues;
        result.valid = issues.length === 0;
        break; // Found valid DKIM, stop searching
      }
    }

    if (!result.found) {
      result.issues.push("No DKIM record found (checked common selectors)");
    }
  } catch (error) {
    result.issues.push(`Error checking DKIM: ${error}`);
  }

  return result;
}

// Check DMARC record
export async function checkDMARC(domain: string): Promise<DMARCResult> {
  const result: DMARCResult = {
    found: false,
    valid: false,
    record: null,
    policy: null,
    issues: [],
  };

  try {
    const dmarcDomain = `_dmarc.${domain}`;
    const records = await queryTXT(dmarcDomain);

    // Find DMARC record (starts with v=DMARC1)
    const dmarcRecord = records.find((r) => r.toLowerCase().startsWith("v=dmarc1"));

    if (!dmarcRecord) {
      result.issues.push("No DMARC record found");
      return result;
    }

    result.found = true;
    result.record = dmarcRecord;

    // Extract policy
    const policyMatch = dmarcRecord.match(/p=(none|quarantine|reject)/i);
    if (policyMatch) {
      result.policy = policyMatch[1].toLowerCase() as "none" | "quarantine" | "reject";
    }

    // Validation
    const issues: string[] = [];

    if (!result.policy) {
      issues.push("DMARC record missing policy (p=)");
    } else if (result.policy === "none") {
      issues.push("DMARC policy is 'none' (monitoring only, not enforcing)");
    }

    // Check for rua (aggregate reports)
    if (!dmarcRecord.includes("rua=")) {
      issues.push("DMARC record missing aggregate report address (rua=)");
    }

    result.issues = issues;
    result.valid =
      result.policy !== null &&
      !issues.some((i) => i.includes("missing policy"));
  } catch (error) {
    result.issues.push(`Error checking DMARC: ${error}`);
  }

  return result;
}

// Calculate health score based on DNS authentication
export function calculateHealthScore(
  spf: SPFResult,
  dkim: DKIMResult,
  dmarc: DMARCResult
): number {
  let score = 0;

  // SPF: up to 30 points
  if (spf.found) {
    score += 15;
    if (spf.valid) {
      score += 15;
    }
  }

  // DKIM: up to 35 points
  if (dkim.found) {
    score += 17;
    if (dkim.valid) {
      score += 18;
    }
  }

  // DMARC: up to 35 points
  if (dmarc.found) {
    score += 10;
    if (dmarc.valid) {
      score += 10;
    }
    // Bonus for strict policy
    if (dmarc.policy === "reject") {
      score += 15;
    } else if (dmarc.policy === "quarantine") {
      score += 10;
    } else if (dmarc.policy === "none") {
      score += 5;
    }
  }

  return Math.min(100, score);
}

// Check all DNS records for a domain
export async function checkDomainHealth(domain: string): Promise<DomainHealthResult> {
  // Run all checks in parallel
  const [spf, dkim, dmarc] = await Promise.all([
    checkSPF(domain),
    checkDKIM(domain),
    checkDMARC(domain),
  ]);

  const healthScore = calculateHealthScore(spf, dkim, dmarc);

  return {
    domain,
    spf,
    dkim,
    dmarc,
    healthScore,
    checkedAt: new Date().toISOString(),
  };
}

// Check multiple domains
export async function checkDomainsHealth(domains: string[]): Promise<DomainHealthResult[]> {
  // Process in batches to avoid rate limiting
  const batchSize = 3;
  const results: DomainHealthResult[] = [];

  for (let i = 0; i < domains.length; i += batchSize) {
    const batch = domains.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((domain) => checkDomainHealth(domain)));
    results.push(...batchResults);

    // Small delay between batches
    if (i + batchSize < domains.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}
