// DNS Health Checker Library

export {
  checkSPF,
  checkDKIM,
  checkDMARC,
  checkDomainHealth,
  checkDomainsHealth,
  calculateHealthScore,
} from "./checker";

export type {
  SPFResult,
  DKIMResult,
  DMARCResult,
  DomainHealthResult,
} from "./checker";
