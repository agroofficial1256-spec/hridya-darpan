// Generic portable-model runtime: evaluates the JSON export produced by
// backend/ml/export_js.py (logistic regression or random-forest / xgboost
// tree ensembles) without any ML dependency, so Netlify Functions stay small.
// Adding a new algorithm only means adding one `evaluate*` case here plus a
// matching exporter in Python - no change to call sites.

export interface TreeNode {
  leaf: boolean
  value?: number
  feature?: string
  threshold?: number
  left?: number
  right?: number
}

export interface PortableTree {
  nodes: TreeNode[]
}

export interface PortableModel {
  kind: 'logreg' | 'rf' | 'xgb'
  targetId: string
  featureNames: string[]
  coef?: number[]
  intercept?: number
  trees?: PortableTree[]
  calibration: { a: number; b: number }
  scaling: { mean: number[]; std: number[] }
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z))
}

function scale(model: PortableModel, encoded: Record<string, number>): number[] {
  return model.featureNames.map((name, i) => {
    const raw = encoded[name] ?? 0
    return (raw - model.scaling.mean[i]) / (model.scaling.std[i] || 1)
  })
}

/** Returns [leafProbability, path] where path is the list of visited node
 * indices, used afterwards to compute a Saabas-style contribution per split. */
function walkTree(tree: PortableTree, x: number[], featureIndex: Map<string, number>): { value: number; path: number[] } {
  let nodeId = 0
  const path: number[] = []
  // eslint-disable-next-line no-constant-condition
  while (true) {
    path.push(nodeId)
    const node = tree.nodes[nodeId]
    if (node.leaf) return { value: node.value ?? 0, path }
    const idx = featureIndex.get(node.feature!) ?? -1
    const v = idx >= 0 ? x[idx] : 0
    nodeId = v <= (node.threshold ?? 0) ? node.left! : node.right!
  }
}

export interface PredictionResult {
  probability: number
  contributions: { feature: string; contribution: number; featureValue: number }[]
}

export function predict(model: PortableModel, encoded: Record<string, number>): PredictionResult {
  const x = scale(model, encoded)
  const featureIndex = new Map(model.featureNames.map((n, i) => [n, i]))
  const contribTotals = new Map<string, number>()

  let rawScore: number
  if (model.kind === 'logreg') {
    rawScore = (model.intercept ?? 0) + x.reduce((sum, v, i) => sum + v * (model.coef?.[i] ?? 0), 0)
    for (let i = 0; i < x.length; i++) {
      contribTotals.set(model.featureNames[i], x[i] * (model.coef?.[i] ?? 0))
    }
  } else {
    // Random forest: leaves store a 0..1 probability, trees vote by simple
    // average. XGBoost: leaves store additive raw margins, trees combine by
    // summing (then one final sigmoid). Either way we also accumulate a
    // Saabas-style per-split contribution (child expected output minus
    // parent expected output), averaged over trees, for the explanation UI.
    const trees = model.trees ?? []
    let aggregate = 0
    for (const tree of trees) {
      const { value, path } = walkTree(tree, x, featureIndex)
      aggregate += value
      for (let i = 0; i < path.length - 1; i++) {
        const node = tree.nodes[path[i]]
        const nextVal = leafOrSubtreeValue(tree, path[i + 1])
        const curVal = leafOrSubtreeValue(tree, path[i])
        const delta = nextVal - curVal
        if (node.feature) {
          contribTotals.set(node.feature, (contribTotals.get(node.feature) ?? 0) + delta / trees.length)
        }
      }
    }
    // sklearn's CalibratedClassifierCV calibrates directly on predict_proba
    // for estimators with no decision_function (true for both RF and
    // XGBClassifier here), so the "raw score" handed to the sigmoid
    // calibrator below is a 0..1 probability, not a logit.
    rawScore = model.kind === 'xgb' ? sigmoid(aggregate) : trees.length ? aggregate / trees.length : 0
  }

  // sklearn's _SigmoidCalibration.predict is expit(-(a*T + b)).
  const calibrated = sigmoid(-(model.calibration.a * rawScore + model.calibration.b))

  const contributions = Array.from(contribTotals.entries())
    .map(([feature, contribution]) => ({
      feature,
      contribution,
      featureValue: encoded[feature] ?? 0,
    }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 8)

  return { probability: calibrated, contributions }
}

// Memoized mean leaf value reachable from a given node (used to estimate a
// node's "expected output" for the Saabas split-contribution decomposition).
const subtreeCache = new WeakMap<PortableTree, Map<number, number>>()
function leafOrSubtreeValue(tree: PortableTree, nodeId: number): number {
  let cache = subtreeCache.get(tree)
  if (!cache) {
    cache = new Map()
    subtreeCache.set(tree, cache)
  }
  const hit = cache.get(nodeId)
  if (hit !== undefined) return hit
  const node = tree.nodes[nodeId]
  let result: number
  if (node.leaf) {
    result = node.value ?? 0
  } else {
    result = (leafOrSubtreeValue(tree, node.left!) + leafOrSubtreeValue(tree, node.right!)) / 2
  }
  cache.set(nodeId, result)
  return result
}
