const identity = value => value
const codec = typeSymbol => ({ mode: 'strict', typeSymbol, schema: { parse: identity } })

export const DIRECTION_ADJUST_CONTRIBUTION = {
  package: 'smilexx-input-enhancer',
  descriptors: [{
    id: 'smilexx-input-enhancer#directionAdjust/adjust',
    service: 'directionAdjust',
    namespace: 'directionAdjust',
    method: 'adjust',
    invocation: { kind: 'direct' },
    parameters: [
      { name: 'sessionId', wire: 'sessionId', source: 'json', codec: codec('smilexx-input-enhancer#SessionId') },
      { name: 'itemId', wire: 'itemId', source: 'json', codec: codec('smilexx-input-enhancer#MessageId') },
    ],
    result: codec('smilexx-input-enhancer#DirectionAdjustResult'),
  }],
}
