import type { BoardRole } from '@syncboard/shared'

export type DemoUserBlueprint = {
  name: string
  role: BoardRole
}

export type DemoCardBlueprint = {
  title: string
  description: string
}

export type DemoColumnBlueprint = {
  title: string
  cards: DemoCardBlueprint[]
}

export type DemoBoardBlueprint = {
  name: string
  columns: DemoColumnBlueprint[]
}

export type DemoDataset = {
  users: DemoUserBlueprint[]
  boards: DemoBoardBlueprint[]
}

const DESCRIPTORS = [
  'Realtime sync',
  'Cross-team visibility',
  'Quality gate',
  'Performance budget',
  'Security review',
  'Developer onboarding',
  'Automation workflow',
  'Customer feedback',
]

const DETAILS = [
  'Include acceptance criteria and owner.',
  'Add technical notes for implementation.',
  'Attach QA checklist and regression scope.',
  'Capture open questions and risks.',
  'Highlight priority and delivery window.',
  'Document rollout and rollback steps.',
]

function makeCardDescription(boardName: string, columnName: string, index: number) {
  const descriptor = DESCRIPTORS[index % DESCRIPTORS.length]
  const detail = DETAILS[(index + boardName.length + columnName.length) % DETAILS.length]
  return `${descriptor} for ${boardName} / ${columnName}. ${detail}`
}

function makeCards(boardName: string, columnName: string, titles: string[]): DemoCardBlueprint[] {
  return titles.map((title, index) => ({
    title,
    description: makeCardDescription(boardName, columnName, index),
  }))
}

export function createDemoDataset(label: string): DemoDataset {
  const users: DemoUserBlueprint[] = [
    { name: `${label} Owner`, role: 'owner' },
    { name: `${label} Product`, role: 'editor' },
    { name: `${label} Design`, role: 'editor' },
    { name: `${label} QA`, role: 'editor' },
    { name: `${label} Viewer`, role: 'viewer' },
  ]

  const boardNames = [
    `${label} Product Roadmap`,
    `${label} Sprint Delivery`,
    `${label} Engineering Platform`,
    `${label} Marketing Launch`,
    `${label} Incident Response`,
    `${label} Hiring Pipeline`,
  ]

  const boards: DemoBoardBlueprint[] = boardNames.map((boardName, boardIndex) => {
    const columns: DemoColumnBlueprint[] = [
      {
        title: 'Ideas',
        cards: makeCards(boardName, 'Ideas', [
          `Vision alignment #${boardIndex + 1}`,
          `Stakeholder inputs #${boardIndex + 1}`,
          `Opportunity map #${boardIndex + 1}`,
          `Discovery backlog #${boardIndex + 1}`,
        ]),
      },
      {
        title: 'Planned',
        cards: makeCards(boardName, 'Planned', [
          `Scope definition #${boardIndex + 1}`,
          `Technical design #${boardIndex + 1}`,
          `Resourcing plan #${boardIndex + 1}`,
          `Delivery milestones #${boardIndex + 1}`,
        ]),
      },
      {
        title: 'In Progress',
        cards: makeCards(boardName, 'In Progress', [
          `Implementation stream #${boardIndex + 1}`,
          `Integration checks #${boardIndex + 1}`,
          `Cross-team sync #${boardIndex + 1}`,
          `Risk mitigation #${boardIndex + 1}`,
          `Bugfix wave #${boardIndex + 1}`,
        ]),
      },
      {
        title: 'Review',
        cards: makeCards(boardName, 'Review', [
          `QA verification #${boardIndex + 1}`,
          `Product review #${boardIndex + 1}`,
          `Security validation #${boardIndex + 1}`,
        ]),
      },
      {
        title: 'Done',
        cards: makeCards(boardName, 'Done', [
          `Release notes #${boardIndex + 1}`,
          `Retrospective #${boardIndex + 1}`,
          `Metrics snapshot #${boardIndex + 1}`,
        ]),
      },
    ]

    return {
      name: boardName,
      columns,
    }
  })

  return { users, boards }
}
