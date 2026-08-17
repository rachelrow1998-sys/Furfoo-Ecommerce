export const autonomousBehaviours = [
  { state: 'idle', weight: 35 },
  { state: 'sitting', weight: 20 },
  { state: 'looking', weight: 15 },
  { state: 'sniffing', weight: 10 },
  { state: 'walking', weight: 10, moves: true },
  { state: 'stretching', weight: 5 },
  { state: 'sleeping', weight: 5 },
]

export function chooseWeightedBehaviour(previousState) {
  const choices = autonomousBehaviours.filter(item => item.state !== previousState)
  const total = choices.reduce((sum, item) => sum + item.weight, 0)
  let cursor = Math.random() * total
  return choices.find(item => ((cursor -= item.weight) <= 0)) || choices[0]
}

export const behaviourPriority = {
  safety: 80, direct: 70, conversation: 60, guidance: 50,
  section: 40, cursor: 30, autonomous: 20, sleep: 10,
}

