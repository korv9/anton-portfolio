from collections import Counter
import json


def distribution(values):
    counts = Counter(str(v) for v in values)
    return [{'label': label, 'count': count, 'share': count / len(values)}
            for label, count in sorted(counts.items(), key=lambda p: (-p[1], p[0]))]


def profiles(jobs):
    global_skills = Counter(s for skills in jobs.skills for s in set(skills))
    result = []
    for cluster_id, group in jobs.groupby('cluster_id', sort=True):
        counts = Counter(s for skills in group.skills for s in set(skills))
        # Smoothed lift with support guards, retaining count and score for inspection.
        distinctive = sorted([
            {'skill': s, 'count': count, 'lift': ((count + 1) / (len(group) + 2)) / ((global_skills[s] + 1) / (len(jobs) + 2))}
            for s, count in counts.items() if count >= max(2, len(group) * .05)
        ], key=lambda r: (-r['lift'], -r['count'], r['skill']))[:8]
        titles = distribution(group.title.tolist())[:8]
        roles = distribution(group.role_family.tolist())
        # A rare mention can have high lift without describing most of a group.
        names = [s['skill'] for s in distinctive if s['lift'] >= 1.5 and s['count'] / len(group) >= .15][:2]
        weak = not names and titles[0]['share'] < .25
        label = 'Unassigned / noise' if cluster_id == -1 else (' / '.join(names) if names else 'Mixed tech advertisements' if weak else titles[0]['label'])
        representatives = group.sort_values(['cluster_probability', 'job_id'], ascending=[False, True]).head(5)
        result.append({'cluster_id': int(cluster_id), 'cluster_label': label,
                       'label_method': 'noise' if cluster_id == -1 else 'distinctive skill lift' if names else 'weak differentiation' if weak else 'most common title',
                       'label_uncertainty': ('Weak skill/title differentiation. ' if weak else '') + 'Automatic descriptive label; not a validated occupational taxonomy. Templates and employers can drive density. Cluster numbers are run-specific.',
                       'job_count': len(group), 'dataset_share': len(group) / len(jobs),
                       'skill_observation_share': float(group.skills.map(bool).mean()),
                       'label_skill_minimum_share': .15,
                       'dominant_role': roles[0]['label'], 'role_distribution': roles,
                       'junior_share': float((group.seniority == 'junior').mean()),
                       'senior_share': float((group.seniority == 'senior').mean()),
                       'unspecified_share': float((group.seniority == 'unspecified').mean()),
                       'noise_share': float(cluster_id == -1), 'mean_probability': float(group.cluster_probability.mean()),
                       'top_titles': titles, 'top_skills': distinctive,
                       'regions': distribution(group.region.fillna('Unspecified').tolist()),
                       'years': distribution(group.published_year.tolist()),
                       'representative_ads': [{'id': r.job_id, 'title': r.title} for r in representatives.itertuples()]})
    return result


def sql_profiles(items):
    import pandas as pd
    return pd.DataFrame([{key: json.dumps(value, ensure_ascii=False) if isinstance(value, list) else value
                          for key, value in item.items()} for item in items])
