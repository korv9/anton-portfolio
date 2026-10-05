/**
 * The policy area of a roll call: the remit of the committee that prepared the decision, in
 * words a reader recognises (riksdagen.se describes each committee's area of responsibility).
 */
import { l } from '../../i18n'

const AREAS: Record<string, [en: string, sv: string]> = {
  AU: ['Labour market', 'Arbetsmarknad'],
  CU: ['Civil law and housing', 'Civilrätt och bostäder'],
  FiU: ['Economy and budget', 'Ekonomi och budget'],
  FöU: ['Defence', 'Försvar'],
  JuU: ['Justice and crime', 'Rättsväsende och brott'],
  KU: ['Constitution and democracy', 'Grundlag och demokrati'],
  KrU: ['Culture and sport', 'Kultur och idrott'],
  MJU: ['Environment and agriculture', 'Miljö och jordbruk'],
  NU: ['Industry and energy', 'Näringsliv och energi'],
  SfU: ['Social insurance and migration', 'Socialförsäkring och migration'],
  SkU: ['Taxes', 'Skatter'],
  SoU: ['Health and social care', 'Vård och omsorg'],
  TU: ['Transport', 'Trafik och kommunikationer'],
  UbU: ['Education and research', 'Utbildning och forskning'],
  UFöU: ['Foreign affairs and defence', 'Utrikes och försvar'],
  UU: ['Foreign affairs', 'Utrikes'],
}

export const areaName = (code: string) => {
  const a = AREAS[code]
  return a ? l(a[0], a[1]) : code
}
