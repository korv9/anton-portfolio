// Only set these when Anton has supplied the actual destination or approved file.
export const profile: {
  linkedin: string | null
  email: string | null
  cv: string | null
} = {
  linkedin: 'https://www.linkedin.com/in/anton-ernstsson',
  email: 'anton.ernstson@gmail.com',
  cv: './Anton_Ernstsson_CV_Data_Engineer.pdf',
}

export const sources = {
  jobs: 'https://github.com/korv9/swedish-job-market-analytics',
  allegoria: 'https://github.com/korv9/allegoria',
  homie: 'https://github.com/korv9/homie-api',
  drugcomb: 'https://github.com/korv9/DrugComb-Synergy-Prediction',
}

export const revisions = {
  jobs: '59ffcf5a896c28449b424d0dcf1dd284dcc19b58',
  allegoria: '61a31f316c2c3da5da9dc740cc676ce2c4b375c2',
  homie: '3c6da1ae24869107bd4b5f0fad10f0f7ed2de1af',
  drugcomb: '2b104d90485a9b66386cce12d3492d7942d8a511',
}

export const reportPanels = [
  {
    number: '01',
    title: 'Hur förändras annonsvolymen?',
    kind: 'Månadsserie',
    file: 'Jobs.csv',
    definition:
      'Antal unika annons-ID:n per publiceringsmånad och roll. En annons är inte samma sak som en ledig tjänst.',
    fields: 'publication_month, role_family, total_ads, is_complete',
    limitation:
      'Återpubliceringar med olika ID:n kan räknas flera gånger. Ofullständiga månader får inte visas som noll.',
  },
  {
    number: '02',
    title: 'Vilka tekniker nämns i annonserna?',
    kind: 'Andelar över tid',
    file: 'Skills.csv',
    definition:
      'Unika annonser som nämner en teknik, dividerat med alla annonser i samma månad och roll.',
    fields:
      'publication_month, role_family, skill, ads_with_skill, total_ads, skill_share, is_complete, sufficient_volume',
    limitation:
      'Textmatchning hittar omnämnanden, även meriter och negationer. Andelarna visar inte säkra kompetenskrav och summerar inte till 100 %.',
  },
  {
    number: '03',
    title: 'Vad skiljer åren åt?',
    kind: 'Förändring i procentenheter',
    file: 'Comparison.csv',
    definition:
      'Skillnaden mellan teknikens annonsandel 2025 och 2024, i procentenheter, för samma roll.',
    fields: 'Årsvisa antal, andelar och förändring per role_family och skill.',
    limitation:
      'Båda åren måste ha tolv kompletta månader. Små urval och förändrad sammansättning kan ge stora utslag.',
  },
]
