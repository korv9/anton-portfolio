import type { SearchProfile } from '../../src/job-intelligence/profile.ts'
export function fixtureProfile():SearchProfile {
  const evidence={source_ref:'Synthetic CV page 1',quote:'Synthetic qualification evidence: Python, SQL and data pipelines.'}
  return {schema_version:1,source:{kind:'candidate_supplied_cv',sha256:'e'.repeat(64)},
    facts:{skills:[{skill:'python',level:'evidenced',...evidence},{skill:'sql',level:'evidenced',...evidence},{skill:'azure',level:'partial',...evidence}],
      professional_years:null,education:{level:'higher_vocational',credits:400,completed:'2026-06',...evidence},
      experience:[{kind:'internship',label:'Synthetic data internship',skills:['python','sql'],...evidence}]},
    preferences:{locations:['Stockholm','Solna'],remote:true,role_weights:{data_engineer:1,analytics_engineer:1,python_developer:.9,ai_engineer:.8,data_platform:.9,fullstack:.6,bi_developer:.7,data_analyst:.6,ml_engineer:.6},
      weights:{role:.2,required:.35,preferred:.1,experience:.15,location:.15,education:.05},minimum_score:50}}
}
