import numpy as np

from ml.cluster_lab.evaluate import score
from ml.cluster_lab.refine import refine
from ml.research.regions import bootstrap_ari, gap
from ml.research.topics import sentence_passages, spoken


def test_protocol_text_is_removed_and_spoken_text_kept():
    source=('Herr talman! Vi vill sänka skatten. (Applåder)\nFru talman, det räcker inte.\n'
        'Partiledardebatten var härmed avslutad.\nI detta anförande instämde Anna Ek och\nBo Ek (båda S).')
    assert spoken(source)=='Vi vill sänka skatten. det räcker inte.'
    assert spoken('Jag bad talmannen om ordet.')=='Jag bad talmannen om ordet.'


def test_passages_are_whole_sentences_and_a_short_tail_joins_the_last():
    sentence=' '.join(['ord']*29)+'.'
    text=' '.join(['Mening '+sentence]*7)
    parts=sentence_passages(text,80,150,40)
    assert [len(p.split()) for p in parts]==[90,120]
    assert ' '.join(parts)==text and all(p.endswith('.') for p in parts)
    assert sentence_passages('Kort svar.',80,150,40)==[]


def blobs(rng,centres,n=120,spread=.15):
    points=np.vstack([c+rng.normal(0,spread,(n,len(c))) for c in centres]).astype('float32')
    return points,np.repeat(np.arange(len(centres)),n)


def test_refine_merges_split_groups_and_returns_only_nearby_noise():
    rng=np.random.default_rng(0)
    centres=np.array([[4,0,0,0],[4.1,.1,0,0],[0,4,0,0],[0,0,4,0],[0,0,0,4]])
    points,labels=blobs(rng,centres)
    labels=labels.copy()
    truth=np.where(labels==1,0,labels)
    hidden=rng.choice(len(labels),80,replace=False)
    labels[hidden]=-1
    stray=np.tile([[1.3,1.3,1.3,1.3]],(40,1)).astype('float32')+rng.normal(0,.05,(40,4)).astype('float32')
    refined,info=refine(np.vstack([points,stray]),np.concatenate([labels,-np.ones(40,int)]),
        merge_similarity=.9,reassign_quantile=.05,reassign_margin=.2)
    assert info['core_clusters']==5 and info['merged']['clusters']==4 and info['merged']['groups']==[[0,1]]
    # The two halves of one subject are one group again; hidden points return to it or stay noise.
    groups=[set(refined[:len(points)][truth==g])-{-1} for g in (0,2,3,4)]
    assert all(len(g)==1 for g in groups) and len(set.union(*groups))==4
    assert (refined[:len(points)][hidden]>=0).mean()>.85
    assert (refined[len(points):]==-1).all()
    assert info['reassigned']['held_out_precision']==1.0 and info['reassigned']['held_out_recall']>.85
    unchanged,off=refine(points,labels)
    assert (unchanged==labels).all() and 'merged' not in off


def test_score_prefers_density_validity_and_penalises_groups_that_follow_the_speaker():
    selection={'silhouette_weight':1.0,'noise_weight':.3,'largest_weight':.4,'dominance_weight':0,
        'confound_weight':1.0,'min_clusters':2}
    def metrics(dbcv,speaker):
        return {'cluster_count':20,'noise_share':.3,'largest_cluster_share':.05,'dbcv':{'value':dbcv},
            'silhouette_original':{'value':.9},'dominance':{'speaker':{'weighted_top_share':.2,'adjusted_mutual_information':speaker}}}
    topics,speakers=metrics(.3,.05),metrics(.35,.25)
    assert score(topics,selection)>score(speakers,selection)
    assert score({**topics,'dbcv':{'value':None}},selection)>score(topics,selection)  # falls back to silhouette
    assert score({**topics,'cluster_count':1},selection)==-100.0


def test_gap_and_bootstrap_tell_real_groups_from_one_cloud():
    from sklearn.cluster import KMeans
    rng=np.random.default_rng(1)
    grouped,_=blobs(rng,np.array([[0,0],[6,0],[0,6]]),n=60,spread=.5)
    cloud=rng.normal(0,1,(180,2))
    fit=lambda x:KMeans(3,n_init=10,random_state=0).fit_predict(x)
    assert gap(grouped,3,rng,10)[0]>gap(cloud,3,rng,10)[0]
    assert bootstrap_ari(fit,grouped,fit(grouped),rng,20)>.95>bootstrap_ari(fit,cloud,fit(cloud),rng,20)


def test_consensus_keeps_groups_most_seeds_agree_on_and_drops_the_rest():
    from ml.research.consensus import consensus
    from ml.research.topics import joined
    truth=np.repeat([0,1,2],[50,30,20])
    rng=np.random.default_rng(0)
    runs=[]
    for seed in range(6):
        labels=rng.permutation(3)[truth]          # group ids differ between seeds
        labels[rng.choice(100,5,replace=False)]=-1
        runs.append(labels)
    runs[0][50:80]=-1                             # one seed misses the second group
    runs[1][truth==2]=np.repeat([3,4],10)         # one seed splits the third group
    runs[2][:5]=5                                 # a group only one seed found
    labels,share=consensus(np.array(runs))
    assert (labels==truth).all() and share.min()>=.5 and share[60]<1
    assert (consensus(np.full((4,10),-1))[0]==-1).all()
    assert joined(['a b','c','d e f','g'],3)==['a b c','d e f g'] and joined(['a'],3)==['a']
