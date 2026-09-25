// Official Swedish names. UFöU is a joint committee, not a sixteenth standing committee.
// Source: https://www.riksdagen.se/sv/sa-fungerar-riksdagen/utskotten-och-eu-namnden/
export const COMMITTEES: Record<string, string> = {
  AU: 'Arbetsmarknadsutskottet',
  CU: 'Civilutskottet',
  FiU: 'Finansutskottet',
  FöU: 'Försvarsutskottet',
  JuU: 'Justitieutskottet',
  KU: 'Konstitutionsutskottet',
  KrU: 'Kulturutskottet',
  MJU: 'Miljö- och jordbruksutskottet',
  NU: 'Näringsutskottet',
  SfU: 'Socialförsäkringsutskottet',
  SkU: 'Skatteutskottet',
  SoU: 'Socialutskottet',
  TU: 'Trafikutskottet',
  UbU: 'Utbildningsutskottet',
  UFöU: 'Sammansatta utrikes- och försvarsutskottet',
  UU: 'Utrikesutskottet',
}

export function committeeLabel(code: string) {
  return COMMITTEES[code] ? `${COMMITTEES[code]} (${code})` : code
}
