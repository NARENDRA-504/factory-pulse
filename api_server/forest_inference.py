"""Data-only tree inference. Does not unpickle or import a training environment."""
import math
import struct

def forest_scores(model, values):
    features=model['features'];labels=model['labels'];trees=model['trees']
    if not trees or len(trees)>256 or len(features)!=7 or len(labels)!=3:
        raise ValueError('Invalid model contract')
    x=[]
    for feature in features:
        value=values.get(feature)
        if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):raise ValueError('Finite features required')
        # sklearn tree prediction compares float32 inputs to float64 thresholds.
        x.append(struct.unpack('f',struct.pack('f',value))[0])
    total=[0.0]*len(labels)
    for tree in trees:
        node=0
        for _ in range(40):
            if tree['left'][node]==-1:break
            index=tree['feature'][node]
            if not 0<=index<len(x):raise ValueError('Invalid feature index')
            node=tree['left'][node] if x[index]<=tree['threshold'][node] else tree['right'][node]
            if not 0<=node<len(tree['left']):raise ValueError('Invalid node')
        else:raise ValueError('Tree depth exceeded')
        probability=tree['probabilities'][node]
        if len(probability)!=3 or any(not math.isfinite(v) or not 0<=v<=1 for v in probability) or abs(sum(probability)-1)>.00001:raise ValueError('Invalid leaf')
        for i,p in enumerate(probability):total[i]+=p/len(trees)
    return dict(zip(labels,total))
