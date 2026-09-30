// Countries offered for "where I watch": drives streaming availability,
// release dates and age ratings. Text stays English (see README): tag and
// warning matching reads English TMDb keywords.
export const REGIONS = [
  ["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"], ["IE", "Ireland"],
  ["AU", "Australia"], ["NZ", "New Zealand"], ["DE", "Germany"], ["FR", "France"],
  ["ES", "Spain"], ["IT", "Italy"], ["NL", "Netherlands"], ["SE", "Sweden"],
  ["NO", "Norway"], ["DK", "Denmark"], ["FI", "Finland"], ["PL", "Poland"],
  ["PT", "Portugal"], ["BR", "Brazil"], ["MX", "Mexico"], ["AR", "Argentina"],
  ["JP", "Japan"], ["KR", "South Korea"], ["IN", "India"], ["ZA", "South Africa"],
];
export const REGION_CODES = REGIONS.map(([code]) => code);
