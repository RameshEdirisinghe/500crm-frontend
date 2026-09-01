import { Team } from '../models/domain';

export type TeamBranding = Pick<
  Team,
  | 'id'
  | 'name'
  | 'code'
  | 'brandColor'
  | 'accentColor'
  | 'logoText'
  | 'contactEmail'
  | 'contactPhone'
  | 'address'
>;

export interface BrandPrintConfig {
  displayName: string;
  printTitle: string;
  address: string;
  merchantName: string;
  merchantTelephone: string;
  description: string;
}

export type BrandIdentity =
  | string
  | null
  | undefined
  | Partial<TeamBranding>;

const UNKNOWN_TEAM_BRANDING: TeamBranding = {
  id: 'unknown',
  name: 'Unknown Team',
  code: 'TEAM',
  brandColor: '#475569',
  accentColor: '#F8FAFC',
  logoText: 'TEAM',
  contactEmail: '',
  contactPhone: '',
  address: '',
};

const hasTeamObject = (identity: BrandIdentity): identity is Partial<TeamBranding> =>
  Boolean(identity && typeof identity === 'object');

export const getTeamBranding = (identity?: BrandIdentity): TeamBranding => {
  if (!hasTeamObject(identity)) {
    return {
      ...UNKNOWN_TEAM_BRANDING,
      id: typeof identity === 'string' && identity ? identity : UNKNOWN_TEAM_BRANDING.id,
    };
  }

  return {
    id: identity.id || UNKNOWN_TEAM_BRANDING.id,
    name: identity.name || UNKNOWN_TEAM_BRANDING.name,
    code: identity.code || UNKNOWN_TEAM_BRANDING.code,
    brandColor: identity.brandColor || UNKNOWN_TEAM_BRANDING.brandColor,
    accentColor: identity.accentColor || UNKNOWN_TEAM_BRANDING.accentColor,
    logoText: identity.logoText || identity.name || UNKNOWN_TEAM_BRANDING.logoText,
    contactEmail: identity.contactEmail || UNKNOWN_TEAM_BRANDING.contactEmail,
    contactPhone: identity.contactPhone || UNKNOWN_TEAM_BRANDING.contactPhone,
    address: identity.address || UNKNOWN_TEAM_BRANDING.address,
  };
};

export const getBrandPrintConfig = (identity?: BrandIdentity): BrandPrintConfig | null => {
  if (!hasTeamObject(identity)) return null;

  const team = getTeamBranding(identity);
  if (!team.name || !team.address || !team.contactPhone) return null;

  return {
    displayName: team.name,
    printTitle: team.logoText || team.name,
    address: team.address
      .split(/\r?\n|,/)
      .map((part) => part.trim())
      .filter(Boolean)
      .join('\n'),
    merchantName: team.name,
    merchantTelephone: team.contactPhone,
    description: team.logoText || team.name,
  };
};
