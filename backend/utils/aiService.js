/**
 * AI Categorization and Department Suggestion Engine
 * Uses NLP keyword extraction, semantic intent analysis and urgency scoring
 */

const DEPARTMENT_KEYWORDS = {
  IT: {
    name: 'Information Technology',
    category: 'Academics',
    keywords: [
      'pc', 'computer', 'monitor', 'ram', 'cpu', 'display', 'screen', 'keyboard', 'mouse',
      'wifi', 'wi-fi', 'internet', 'network', 'lan', 'router', 'access point', 'connectivity',
      'portal', 'software', 'installation', 'os', 'windows', 'linux', 'server', 'lab pc', 'it lab'
    ]
  },
  COMP: {
    name: 'Computer Engineering',
    category: 'Academics',
    keywords: [
      'coding', 'programming', 'python', 'java', 'c++', 'compiler', 'ide', 'github', 'git',
      'database', 'sql', 'mysql', 'mongodb', 'data structures', 'algo', 'algorithm', 'machine learning',
      'deep learning', 'comp lab', 'practical exam', 'project evaluation'
    ]
  },
  INFRA: {
    name: 'Infrastructure & Maintenance',
    category: 'Infrastructure',
    keywords: [
      'projector', 'bulb', 'light', 'fan', 'ac', 'air conditioner', 'cooling', 'tube light',
      'bench', 'desk', 'chair', 'table', 'blackboard', 'whiteboard', 'door', 'window', 'glass',
      'leak', 'water leak', 'pipe', 'plumbing', 'washroom', 'toilet', 'tap', 'restroom',
      'electricity', 'power', 'switch', 'socket', 'wiring', 'elevator', 'lift', 'stairs', 'cleaning', 'dustbin'
    ]
  },
  TRANS: {
    name: 'Transportation Authority',
    category: 'Transportation',
    keywords: [
      'bus', 'buses', 'route', 'driver', 'conductor', 'pickup', 'drop', 'delay', 'punctual',
      'schedule', 'stop', 'bus pass', 'transport', 'highway', 'traffic', 'swargate', 'katraj',
      'seat', 'late arrival', 'breakdown'
    ]
  },
  EXAM: {
    name: 'Exam Cell',
    category: 'Examinations',
    keywords: [
      'exam', 'test', 'marks', 'marksheet', 'grade', 'grading', 're-evaluation', 'rechecking',
      're-checking', 'photocopy', 'hall ticket', 'admit card', 'timetable', 'schedule', 'backlog',
      'unit test', 'insem', 'endsem', 'result', 'sgpa', 'cgpa', 'prn', 'paper correction'
    ]
  },
  HOSTEL: {
    name: 'Hostel Management',
    category: 'Infrastructure',
    keywords: [
      'hostel', 'room', 'bed', 'warden', 'rector', 'geyser', 'hot water', 'cold water',
      'mess', 'canteen', 'food quality', 'mess food', 'curfew', 'block a', 'block b',
      'hostel bathroom', 'water cooler', 'drinking water', 'hostel room key'
    ]
  }
};

const URGENCY_HIGH_KEYWORDS = [
  'urgent', 'emergency', 'immediate', 'asap', 'exam tomorrow', 'today', 'fire', 'spark',
  'smoke', 'electric shock', 'flooding', 'severe', 'broken glass', 'danger', 'hazard',
  'blue screen', 'tripping', 'cannot take test', 'critical', 'injury'
];

const URGENCY_LOW_KEYWORDS = [
  'suggestion', 'request', 'feedback', 'minor', 'improvement', 'inconvenience',
  'appeal', 'penalty appeal', 'query', 'clarification'
];

/**
 * Predicts the optimal department, category, and priority from grievance text
 */
function analyzeComplaint(title = '', description = '') {
  const combinedText = `${title} ${description}`.toLowerCase();

  const scores = {};
  for (const deptKey of Object.keys(DEPARTMENT_KEYWORDS)) {
    scores[deptKey] = 0;
    const { keywords } = DEPARTMENT_KEYWORDS[deptKey];
    for (const kw of keywords) {
      if (combinedText.includes(kw)) {
        // Words in title have higher weight
        if (title.toLowerCase().includes(kw)) {
          scores[deptKey] += 3;
        } else {
          scores[deptKey] += 1;
        }
      }
    }
  }

  // Determine highest scoring department
  let bestDept = 'IT';
  let highestScore = 0;
  for (const deptKey of Object.keys(scores)) {
    if (scores[deptKey] > highestScore) {
      highestScore = scores[deptKey];
      bestDept = deptKey;
    }
  }

  // Determine Priority
  let detectedPriority = 'Medium';
  let priorityReason = 'Standard response SLA';

  const hasHighUrgency = URGENCY_HIGH_KEYWORDS.some(kw => combinedText.includes(kw));
  const hasLowUrgency = URGENCY_LOW_KEYWORDS.some(kw => combinedText.includes(kw));

  if (hasHighUrgency) {
    detectedPriority = 'High';
    priorityReason = 'Urgent keywords or emergency conditions detected';
  } else if (hasLowUrgency && highestScore <= 2) {
    detectedPriority = 'Low';
    priorityReason = 'General request or non-critical suggestion';
  }

  const deptInfo = DEPARTMENT_KEYWORDS[bestDept];
  const confidence = Math.min(98, Math.max(45, highestScore * 18 + (hasHighUrgency ? 10 : 0)));

  return {
    department: bestDept,
    departmentName: deptInfo.name,
    category: deptInfo.category,
    priority: detectedPriority,
    confidence: confidence,
    explanation: highestScore > 0
      ? `Identified relevant keywords mapped to ${deptInfo.name} (${deptInfo.category}). Priority set to ${detectedPriority}: ${priorityReason}.`
      : 'General grievance pattern. Defaulted to Information Technology with Medium priority.'
  };
}

module.exports = { analyzeComplaint };

